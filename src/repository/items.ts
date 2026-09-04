// The face the screens see. They ask and receive; Supabase is never visible.
//
//     UI → repository → Supabase

import { currentSession } from './auth'
import type { Session } from './auth'
import { exportFile } from './export'
import type { ExportFile } from './export'
import { forCalendar, forToday } from './filters'
import type { CalendarDay, TodayGroups } from './filters'
import { localToday } from './item'
import type { Item, Patch } from './item'
import { supabaseSource, supabaseWriter } from './source'
import { store } from './store'
import { sync } from './sync'
import type { SyncResult } from './sync'
import { applyPatch, create, softDelete } from './write'

export type { Item, Patch } from './item'
// The filters live here, in one place; the screens call them over the snapshot
// they already hold instead of re-reading the cache for every group.
export { forCalendar, forToday } from './filters'
export { localToday } from './item'
export type { CalendarDay, TodayGroups } from './filters'
export type { SyncResult } from './sync'
export type { ExportFile } from './export'
export { Conflict } from './write'

/**
 * Checks that the requested namespace really belongs to the user signed in
 * right now.
 *
 * The cache is never read without the current user: otherwise signing out of A
 * and into B would show, if only for a moment, A's data.
 */
export function assertAccount(owner: string, session: Session | null): void {
  if (session === null) {
    throw new Error('Nobody is signed in. The cache is not read.')
  }
  if (session.userId !== owner) {
    throw new Error(`The requested cache belongs to ${owner}, but the current account is another.`)
  }
}

async function requireAccount(owner: string): Promise<void> {
  assertAccount(owner, await currentSession())
}

/** Fetches what changed and puts it in the cache. The first time, everything. */
export async function syncAccount(owner: string): Promise<SyncResult> {
  await requireAccount(owner)
  return sync(owner, supabaseSource(), store)
}

/** Everything cached for this account, deleted rows included. */
export async function all(owner: string): Promise<Item[]> {
  await requireAccount(owner)
  return store.readAll(owner)
}

/** What you have to do now. A filter over the snapshot, not a new query. */
export async function today(owner: string, now: Date): Promise<TodayGroups> {
  await requireAccount(owner)
  return forToday(await store.readAll(owner), localToday(now))
}

/** The days, with what you planned and what you did. */
export async function calendar(owner: string): Promise<CalendarDay[]> {
  await requireAccount(owner)
  return forCalendar(await store.readAll(owner))
}

/** Capture: a title, nothing else. */
export async function capture(owner: string, title: string): Promise<Item> {
  await requireAccount(owner)
  return cache(owner, await create(supabaseWriter(owner), title))
}

/** Changes an item, with a version check. Throws Conflict if it will not hold. */
export async function update(
  owner: string,
  item: Item,
  patch: Patch,
  now: Date,
): Promise<Item> {
  await requireAccount(owner)
  return cache(
    owner,
    await applyPatch(supabaseWriter(owner), item, patch, localToday(now)),
  )
}

/** Deleting is an UPDATE on deleted_at. The row stays, so sync can carry it. */
export async function discard(owner: string, item: Item, now: Date): Promise<Item> {
  await requireAccount(owner)
  return cache(
    owner,
    await softDelete(supabaseWriter(owner), item, now, localToday(now)),
  )
}

/** "Download everything": the entire snapshot, as a file. */
export async function exportAll(owner: string, now: Date): Promise<ExportFile> {
  await requireAccount(owner)
  const [items, cursor] = await Promise.all([
    store.readAll(owner),
    store.cursor(owner),
  ])
  return exportFile(owner, items, cursor, now)
}

/**
 * The row the server returned goes into the cache straight away.
 *
 * The cursor does not move: this row will come back on the next delta anyway,
 * and a cursor moved on a single write could skip past what somebody else
 * wrote in the meantime.
 */
async function cache(owner: string, item: Item): Promise<Item> {
  await store.upsert(owner, [item], null)
  return item
}
