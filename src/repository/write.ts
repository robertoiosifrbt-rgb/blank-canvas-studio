// Writing: row by row, not rewriting everything.
//
// The version check is atomic, in a single conditional UPDATE. Not "read 4,
// check in JavaScript, write 5" — two devices can pass that check at the same
// time.

import { fromRow, withDoneAt } from './item'
import type { Item, Patch } from './item'
import type { Row } from './row'

export type Writer<P extends object> = {
  /** Inserts a new row. The owner is set by the database, from auth.uid(). */
  insert(values: Record<string, unknown>): Promise<unknown>
  /**
   * update <table> set <patch>
   * where id = :id and owner = auth.uid() and version = :version
   *
   * Returns the affected rows: one, or none if the version no longer matches.
   */
  update(id: string, version: number, patch: P): Promise<unknown[]>
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
export class Conflict<T extends Row = Item, P extends object = Patch> extends Error {
  readonly item: T
  readonly patch: P

  constructor(item: T, patch: P, message: string) {
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
export async function create(writer: Writer<Patch>, title: string): Promise<Item> {
  return fromRow(await writer.insert({ title }))
}

/**
 * Applies a patch, with a single retry over the new version.
 *
 * The patch is only the changed fields. Otherwise the phone changing due would
 * write over a title changed on the laptop.
 */
export async function applyPatch(
  writer: Writer<Patch>,
  item: Item,
  patch: Patch,
  today: string,
): Promise<Item> {
  return writeChecked(writer, item, withDoneAt(item, patch, today), fromRow)
}

/**
 * The version check itself, for any table stamped by the same trigger.
 *
 * Items and areas differ in what a patch means, not in what happens when two
 * devices write at once, so the answer to that is written once. The retry is
 * single on purpose: a loop here is an outbox, and an outbox is step 7.
 */
export async function writeChecked<T extends Row, P extends object>(
  writer: Writer<P>,
  row: T,
  patch: P,
  parse: (raw: unknown) => T,
): Promise<T> {
  const first = await writer.update(row.id, row.version, patch)
  if (first.length === 1) return parse(first[0])

  // Zero rows affected: re-read the row and re-apply the same patch over the
  // new version. Once only.
  const current = await writer.read(row.id)
  if (current === null) {
    throw new Conflict<T, P>(row, patch, 'That row is not there any more.')
  }
  const fresh = parse(current)

  const second = await writer.update(fresh.id, fresh.version, patch)
  if (second.length === 1) return parse(second[0])

  // The second UPDATE also affected zero rows: it stops.
  throw new Conflict<T, P>(
    fresh,
    patch,
    'Someone changed this row at the same time. Not saved.',
  )
}

/**
 * Whether a conflict came from an item write, rather than an area one.
 *
 * `instanceof` alone cannot say: the class carries whichever row it was built
 * with, so narrowing it stops at "some row". This asks the row what it is —
 * only an item has a state — which is the truthful question, and the only one
 * that stays right when a third table joins.
 */
export function isItemConflict(error: unknown): error is Conflict<Item, Patch> {
  return error instanceof Conflict && 'state' in error.item
}

/** Deleting is an UPDATE on deleted_at. The client has no DELETE. */
export function softDelete(
  writer: Writer<Patch>,
  item: Item,
  now: Date,
  today: string,
): Promise<Item> {
  return applyPatch(writer, item, { deleted_at: now.toISOString() }, today)
}
