// Writing: row by row, not rewriting everything.
//
// The version check is atomic, in a single conditional UPDATE. Not "read 4,
// check in JavaScript, write 5" — two devices can pass that check at the same
// time.

import { fromRow, withDoneAt } from './item'
import type { Item, Patch } from './item'

export type Writer = {
  /** Inserts a new row. The owner is set by the database, from auth.uid(). */
  insert(values: { title: string }): Promise<unknown>
  /**
   * update items set <patch>
   * where id = :id and owner = auth.uid() and version = :version
   *
   * Returns the affected rows: one, or none if the version no longer matches.
   */
  update(id: string, version: number, patch: Patch): Promise<unknown[]>
  /** The current row, for a single retry. `null` = it no longer exists. */
  read(id: string): Promise<unknown>
}

/**
 * The patch could not be written, not even after the retry.
 *
 * It carries the item and the patch so the screen can keep them visibly
 * unsaved. Nothing is persisted locally: a persisted draft is an outbox, and
 * an outbox at step 4 is the sync built twice. The smaller promise is the true
 * one — if you close the app, you lose that edit.
 */
export class Conflict extends Error {
  readonly item: Item
  readonly patch: Patch

  constructor(item: Item, patch: Patch, message: string) {
    super(message)
    this.name = 'Conflict'
    this.item = item
    this.patch = patch
  }
}

/**
 * Capture: writes the title and nothing else.
 *
 * No date, no questions: state='inbox' and kind=null come from the database.
 * The title goes exactly as it was typed — what the database can guarantee is
 * not checked here.
 */
export async function create(writer: Writer, title: string): Promise<Item> {
  return fromRow(await writer.insert({ title }))
}

/**
 * Applies a patch, with a single retry over the new version.
 *
 * The patch is only the changed fields. Otherwise the phone changing due would
 * write over a title changed on the laptop.
 */
export async function applyPatch(
  writer: Writer,
  item: Item,
  patch: Patch,
  today: string,
): Promise<Item> {
  const toWrite = withDoneAt(item, patch, today)

  const first = await writer.update(item.id, item.version, toWrite)
  if (first.length === 1) return fromRow(first[0])

  // Zero rows affected: re-read the row and re-apply the same patch over the
  // new version. Once only.
  const current = await writer.read(item.id)
  if (current === null) {
    throw new Conflict(item, toWrite, 'That row is not there any more.')
  }
  const fresh = fromRow(current)

  const second = await writer.update(fresh.id, fresh.version, toWrite)
  if (second.length === 1) return fromRow(second[0])

  // The second UPDATE also affected zero rows: it stops.
  throw new Conflict(
    fresh,
    toWrite,
    'Someone changed this row at the same time. Not saved.',
  )
}

/** Deleting is an UPDATE on deleted_at. The client has no DELETE. */
export function softDelete(
  writer: Writer,
  item: Item,
  now: Date,
  today: string,
): Promise<Item> {
  return applyPatch(writer, item, { deleted_at: now.toISOString() }, today)
}
