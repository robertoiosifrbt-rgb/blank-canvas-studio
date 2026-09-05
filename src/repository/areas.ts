// The areas, as the screens ask for them.
//
// Separate from items.ts because they are a separate table with a cursor of
// its own, not because they are a separate layer: the rule still holds, the
// UI never sees Supabase.

import { currentSession } from './auth'
import { fromRow } from './area'
import type { Area, AreaPatch } from './area'
import { supabaseWriter } from './source'
import { areaStore } from './store'
import { writeChecked } from './write'

const AREAS = 'areas'

async function requireAccount(owner: string): Promise<void> {
  const session = await currentSession()
  if (session === null) {
    throw new Error('Nobody is signed in. The cache is not read.')
  }
  if (session.userId !== owner) {
    throw new Error('The requested cache belongs to another account.')
  }
}

/** Everything cached for this account, deleted areas included. */
export async function areasOf(owner: string): Promise<Area[]> {
  await requireAccount(owner)
  return areaStore.readAll(owner)
}

/**
 * A new area, under a parent or at the root.
 *
 * The name goes as it was typed. Blank names, cycles and another user's
 * parent are all refused by the database, which is where they can actually be
 * refused — a check here would be a second opinion, and the plan has one
 * place for each rule.
 */
export async function createArea(
  owner: string,
  name: string,
  parent_id: string | null,
): Promise<Area> {
  await requireAccount(owner)
  const writer = supabaseWriter<AreaPatch>(AREAS, owner)
  return cache(owner, fromRow(await writer.insert({ name, parent_id })))
}

/** Renames or re-hangs an area, with the same version check items get. */
export async function updateArea(
  owner: string,
  area: Area,
  patch: AreaPatch,
): Promise<Area> {
  await requireAccount(owner)
  const writer = supabaseWriter<AreaPatch>(AREAS, owner)
  return cache(owner, await writeChecked(writer, area, patch, fromRow))
}

/**
 * Deleting is an UPDATE on deleted_at, as everywhere else.
 *
 * What hangs under it is left alone on purpose. The tree hides a branch whose
 * parent is gone rather than lifting it to the root, so nothing is silently
 * reparented — and nothing is destroyed either, so putting the parent back
 * brings the branch back with it.
 */
export function discardArea(owner: string, area: Area, now: Date): Promise<Area> {
  return updateArea(owner, area, { deleted_at: now.toISOString() })
}

async function cache(owner: string, area: Area): Promise<Area> {
  // The cursor does not move: this row comes back on the next delta anyway,
  // and a cursor moved on one write can skip what somebody else wrote.
  await areaStore.upsert(owner, [area], null)
  return area
}
