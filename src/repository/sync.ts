// A snapshot, not a per-query cache.
//
// The single most important rule in the whole plan lives here: a delta upserts
// row by row and does NOT replace anything, and an empty delta means "nothing
// changed", not "empty the cache". A partial answer is never treated as the
// whole truth.

import type { Row } from './row'
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
async function fetchAll<T extends Row>(
  source: Source,
  parse: (row: unknown) => T,
  sinceCursor: string | null,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const page = await source.page({ from, to: from + PAGE - 1, sinceCursor })
    for (const row of page) rows.push(parse(row))
    if (page.length < PAGE) return rows
  }
}

/**
 * The newest updated_at among the fetched rows, or null if none came back.
 *
 * The cursor comes from the server, never from the phone's clock: it is the
 * very value the database wrote through the trigger.
 */
export function newest(rows: readonly Row[]): string | null {
  let cursor: string | null = null
  let best = -Infinity
  for (const row of rows) {
    const at = Date.parse(row.updated_at)
    if (Number.isNaN(at)) throw new Error(`Invalid updated_at: ${row.updated_at}`)
    if (at > best) {
      best = at
      cursor = row.updated_at
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
export async function sync<T extends Row>(
  owner: string,
  source: Source,
  store: Store<T>,
  parse: (row: unknown) => T,
): Promise<SyncResult> {
  const previousCursor = await usableCursor(owner, store)

  if (previousCursor === null) {
    // First time on this account: a full snapshot.
    const rows = await fetchAll(source, parse, null)
    const cursor = newest(rows)
    // A complete, successful snapshot replaces the cache even if it is empty —
    // empty can be legitimate, you deleted your last item.
    await store.replaceSnapshot(owner, rows, cursor)
    return { kind: 'full', fetched: rows.length, cursor }
  }

  // The cursor is inclusive on purpose, not clever: because the upsert is
  // idempotent, a row fetched twice breaks nothing. That is how the problem of
  // two changes sharing an updated_at disappears, without a compound cursor.
  const rows = await fetchAll(source, parse, previousCursor)
  const nextCursor = newest(rows)
  // Upsert row by row. It replaces nothing, so an empty delta leaves the cache
  // exactly as it was.
  await store.upsert(owner, rows, nextCursor)
  return { kind: 'delta', fetched: rows.length, cursor: nextCursor ?? previousCursor }
}

/**
 * The cursor, but only if the cache it belongs to can still be read.
 *
 * A cache that is uninitialised, unreadable, or holding a single row this
 * version can no longer parse counts as a first visit — and a first visit
 * takes a full snapshot, which replaces every row this owner has.
 *
 * The row check is the point. Without it, one row written by an older version
 * pins the account for good: the cursor is still valid, so every sync takes
 * the delta path, and a delta upserts only what changed on the server. The bad
 * row is never touched, readAll keeps throwing, and every open fails the same
 * way with no way out but clearing the browser's storage by hand.
 */
async function usableCursor<T extends Row>(
  owner: string,
  store: Store<T>,
): Promise<string | null> {
  try {
    const cursor = await store.cursor(owner)
    if (cursor === null) return null
    // Reading it is the only way to know it can be read.
    await store.readAll(owner)
    return cursor
  } catch {
    return null
  }
}
