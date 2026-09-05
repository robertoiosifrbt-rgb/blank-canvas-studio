// The only place that actually talks to Supabase.
//
// The rest of the repository works against the Source and Writer interfaces,
// so the sync and write logic can be checked without a network.

import { supabase } from './supabase'
import type { Source } from './sync'
import type { Writer } from './write'

const ALL = '*'

function fail(operation: string, error: { message: string }): never {
  throw new Error(`${operation}: ${error.message}`)
}

/**
 * The user's rows, paginated.
 *
 * It fetches the rows with deleted_at as well — that is why we keep them:
 * without them, an item deleted on the phone would stay forever in the
 * laptop's cache.
 */
export function supabaseSource(table: string): Source {
  return {
    async page({ from, to, sinceCursor }) {
      let query = supabase()
        .from(table)
        .select(ALL)
        // A stable order, otherwise pagination can skip or repeat rows.
        .order('id', { ascending: true })
        .range(from, to)

      if (sinceCursor !== null) {
        // Inclusive on purpose: the upsert is idempotent, so a row fetched
        // twice breaks nothing, and this way a second change sharing an
        // updated_at is not lost.
        query = query.gte('updated_at', sinceCursor)
      }

      // Without types generated from the schema, PostgREST returns `any`. It
      // goes through `unknown` on purpose: the only thing that validates a row
      // is fromRow.
      const response = await query
      if (response.error !== null) fail('Fetching rows', response.error)
      return response.data as unknown[]
    },
  }
}

/**
 * The writes, row by row.
 *
 * `owner` is put in the conditions as well, even though the RLS policy already
 * enforces it: if the policy were ever wrong, the condition still stands.
 */
export function supabaseWriter<P extends object>(
  table: string,
  owner: string,
): Writer<P> {
  return {
    async insert(values) {
      const response = await supabase()
        .from(table)
        .insert(values)
        .select(ALL)
        .single()
      if (response.error !== null) fail('Writing the new row', response.error)
      return response.data as unknown
    },

    async update(id: string, version: number, patch: P) {
      // update <table> set <patch>
      // where id = :id and owner = auth.uid() and version = :version
      const response = await supabase()
        .from(table)
        .update(patch)
        .eq('id', id)
        .eq('owner', owner)
        .eq('version', version)
        .select(ALL)
      if (response.error !== null) fail('Updating the row', response.error)
      return response.data as unknown[]
    },

    /**
     * The row as it is now, for the one retry.
     *
     * A deleted row is not found on purpose. Deleting is a soft delete, so the
     * row is still in the table — and without this the retry re-reads it,
     * writes the patch over it, and reports success, while deleted_at stays
     * set and every screen keeps hiding it. You would be told it saved, and
     * the thing would be nowhere. applyPatch already has the honest answer for
     * a row that is gone: it stops with "That row is not there any more."
     */
    async read(id: string) {
      const response = await supabase()
        .from(table)
        .select(ALL)
        .eq('id', id)
        .eq('owner', owner)
        .is('deleted_at', null)
        .maybeSingle()
      if (response.error !== null) fail('Re-reading the row', response.error)
      return response.data as unknown
    },
  }
}
