// A snapshot, not a per-query cache.
//
// The single most important rule in the whole plan lives here: a delta upserts
// row by row and does NOT replace anything, and an empty delta means "nothing
// changed", not "empty the cache". A partial answer is never treated as the
// whole truth.

import { fromRow } from './item'
import type { Item } from './item'
import type { Store } from './store'

/** Supabase returns at most 1000 rows per request by default. */
export const PAGE = 1000

export type Source = {
  /**
   * A page of rows, including the ones with deleted_at — that is why we keep
   * them. `sinceCursor === null` asks for everything; otherwise it asks for
   * `updated_at >= sinceCursor`.
   */
  page(options: {
    from: number
    to: number
    sinceCursor: string | null
  }): Promise<unknown[]>
}

export type SyncResult = {
  kind: 'full' | 'delta'
  fetched: number
  cursor: string | null
}

/**
 * Every page, until one comes back shorter than the maximum.
 *
 * Without pagination, "it fetches everything" becomes false at the 1001st item
 * — and it becomes false silently, which is worse.
 */
async function fetchAll(source: Source, sinceCursor: string | null): Promise<Item[]> {
  const items: Item[] = []
  for (let from = 0; ; from += PAGE) {
    const rows = await source.page({ from, to: from + PAGE - 1, sinceCursor })
    for (const row of rows) items.push(fromRow(row))
    if (rows.length < PAGE) return items
  }
}

/**
 * The newest updated_at among the fetched rows, or null if none came back.
 *
 * The cursor comes from the server, never from the phone's clock: it is the
 * very value the database wrote through the trigger.
 */
export function newest(items: readonly Item[]): string | null {
  let cursor: string | null = null
  let best = -Infinity
  for (const item of items) {
    const at = Date.parse(item.updated_at)
    if (Number.isNaN(at)) throw new Error(`Invalid updated_at: ${item.updated_at}`)
    if (at > best) {
      best = at
      cursor = item.updated_at
    }
  }
  return cursor
}

/**
 * Fetches what changed and puts it in the cache.
 *
 * Any failure while fetching is thrown before the cache is touched: a failed
 * fetch must not damage what was already good.
 */
export async function sync(
  owner: string,
  source: Source,
  store: Store,
): Promise<SyncResult> {
  const previousCursor = await cursorIfAny(owner, store)

  if (previousCursor === null) {
    // First time on this account: a full snapshot.
    const items = await fetchAll(source, null)
    const cursor = newest(items)
    // A complete, successful snapshot replaces the cache even if it is empty —
    // empty can be legitimate, you deleted your last item.
    await store.replaceSnapshot(owner, items, cursor)
    return { kind: 'full', fetched: items.length, cursor }
  }

  // The cursor is inclusive on purpose, not clever: because the upsert is
  // idempotent, a row fetched twice breaks nothing. That is how the problem of
  // two changes sharing an updated_at disappears, without a compound cursor.
  const items = await fetchAll(source, previousCursor)
  const nextCursor = newest(items)
  // Upsert row by row. It replaces nothing, so an empty delta leaves the cache
  // exactly as it was.
  await store.upsert(owner, items, nextCursor)
  return { kind: 'delta', fetched: items.length, cursor: nextCursor ?? previousCursor }
}

/** A cache that is uninitialised or unreadable counts as a first visit. */
async function cursorIfAny(owner: string, store: Store): Promise<string | null> {
  try {
    return await store.cursor(owner)
  } catch {
    return null
  }
}
