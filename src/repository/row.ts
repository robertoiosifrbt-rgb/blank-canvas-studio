// What every synced row has, and the checks that read one.
//
// Items and areas are different things, but they are stamped by the same
// trigger and travel by the same cursor, so what makes a row trustworthy is
// written once, here, rather than once per table.

/** The part of a row the cache and the sync work against, whatever the table. */
export type Row = {
  id: string
  owner: string
  version: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export function requiredText(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Row without ${key}`)
  }
  return value
}

export function optionalText(
  row: Record<string, unknown>,
  key: string,
): string | null {
  const value = row[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error(`${key} is not text`)
  return value
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Whether the text is a real calendar day, as 'YYYY-MM-DD'.
 *
 * The shape is not enough: '2026-02-31' has the shape and is not a day. A
 * date column can never hold one, so a row carrying one did not come from the
 * database as it stands.
 */
export function isDay(text: string): boolean {
  const match = DAY.exec(text)
  if (match === null) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  // Noon UTC: far enough from midnight that nothing can shift the day.
  const at = new Date(Date.UTC(year, month - 1, day, 12))
  return (
    at.getUTCFullYear() === year &&
    at.getUTCMonth() === month - 1 &&
    at.getUTCDate() === day
  )
}

export function optionalDay(
  row: Record<string, unknown>,
  key: string,
): string | null {
  const value = optionalText(row, key)
  if (value !== null && !isDay(value)) {
    throw new Error(`${key} is not a day: ${value}`)
  }
  return value
}

export function requiredMoment(row: Record<string, unknown>, key: string): string {
  const value = requiredText(row, key)
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${key} is not a moment in time: ${value}`)
  }
  return value
}

/**
 * The stamps every table carries, checked the same way for all of them.
 *
 * The trigger writes 1 on insert and adds one on every update, so nothing the
 * database produces is below that. A row that says otherwise was not written
 * by the database as it stands now.
 */
export function stampsOf(raw: Record<string, unknown>): Omit<Row, 'id' | 'owner'> {
  const version = raw['version']
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    throw new Error('Row without version')
  }
  if (version < 1) throw new Error(`Version below one: ${version}`)

  return {
    version,
    created_at: requiredMoment(raw, 'created_at'),
    updated_at: requiredMoment(raw, 'updated_at'),
    deleted_at: optionalText(raw, 'deleted_at'),
  }
}

/** A row is an object before it is anything else. */
export function asRecord(row: unknown): Record<string, unknown> {
  if (typeof row !== 'object' || row === null) {
    throw new Error('The row is not an object')
  }
  return row as Record<string, unknown>
}
