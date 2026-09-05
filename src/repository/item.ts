// The shape of an item, and the two rules that must never be written twice:
// what day it is today, and when done_at gets set.
//
// The field names are the column names from the database, not translations. A
// second vocabulary for the same thing is a place where mistakes hide, and a
// patch has to line up with the columns without any conversion.

export type State = 'inbox' | 'active' | 'done'
export type Kind = 'task' | 'letter'

export type Item = {
  id: string
  owner: string
  kind: Kind | null
  state: State
  title: string
  /** What you planned. A date, not a date and time. */
  due: string | null
  /** What actually happened: the day you ticked it off. */
  done_at: string | null
  version: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/**
 * What a client is allowed to change.
 *
 * The list is exactly the column list in `grant update` — id, owner, version,
 * created_at and updated_at do not appear, because the database refuses them
 * anyway. Here the type refuses them earlier.
 */
export type Patch = Partial<
  Pick<Item, 'kind' | 'state' | 'title' | 'due' | 'done_at' | 'deleted_at'>
>

const STATES: readonly string[] = ['inbox', 'active', 'done']
const KINDS: readonly string[] = ['task', 'letter']

function requiredText(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Row without ${key}`)
  }
  return value
}

function optionalText(
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

function optionalDay(row: Record<string, unknown>, key: string): string | null {
  const value = optionalText(row, key)
  if (value !== null && !isDay(value)) {
    throw new Error(`${key} is not a day: ${value}`)
  }
  return value
}

function requiredMoment(row: Record<string, unknown>, key: string): string {
  const value = requiredText(row, key)
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${key} is not a moment in time: ${value}`)
  }
  return value
}

/**
 * A row that came from the server, checked.
 *
 * A partial answer is never treated as the whole truth: a row missing a field
 * does not enter the cache as half an item.
 *
 * It asks of a row exactly what the database asks of it, and for a reason
 * beyond tidiness: the same check decides whether a cache is worth keeping. A
 * check that lets a broken row through declares that cache good, so the
 * rebuild never runs, and the row goes on to break a screen somewhere far from
 * where it came in.
 */
export function fromRow(row: unknown): Item {
  if (typeof row !== 'object' || row === null) {
    throw new Error('The row is not an object')
  }
  const raw = row as Record<string, unknown>

  const state = requiredText(raw, 'state')
  if (!STATES.includes(state)) throw new Error(`Unknown state: ${state}`)

  const kind = optionalText(raw, 'kind')
  if (kind !== null && !KINDS.includes(kind)) {
    throw new Error(`Unknown kind: ${kind}`)
  }

  // The constraint goes both ways in the database, so it goes both ways here:
  // not only "no leaving the inbox without a kind", but "in the inbox there is
  // no kind" — otherwise the state and the kind can contradict each other.
  if ((state === 'inbox') !== (kind === null)) {
    throw new Error(`State ${state} does not go with kind ${kind ?? 'null'}`)
  }

  const version = raw['version']
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    throw new Error('Row without version')
  }
  // The trigger writes 1 on insert and adds one on every update. Nothing the
  // database produces is below that.
  if (version < 1) throw new Error(`Version below one: ${version}`)

  const title = requiredText(raw, 'title')
  if (title.trim() === '') throw new Error('Title of nothing but spaces')

  return {
    id: requiredText(raw, 'id'),
    owner: requiredText(raw, 'owner'),
    kind: kind as Kind | null,
    state: state as State,
    title,
    due: optionalDay(raw, 'due'),
    done_at: optionalDay(raw, 'done_at'),
    version,
    created_at: requiredMoment(raw, 'created_at'),
    updated_at: requiredMoment(raw, 'updated_at'),
    deleted_at: optionalText(raw, 'deleted_at'),
  }
}

/**
 * Today, from the device clock.
 *
 * Not from the database: `current_date` depends on the PostgreSQL session
 * timezone, and "today" is the day the person is in, not the server.
 */
export function localToday(now: Date): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * The patch, with done_at set by the repository — the only place that decides.
 *
 * When an item becomes done, done_at takes the local day. When it leaves done,
 * it is cleared. A done_at passed explicitly is respected: the item sheet is
 * allowed to correct the day.
 */
export function withDoneAt(item: Item, patch: Patch, today: string): Patch {
  if ('done_at' in patch) return patch

  const nextState = patch.state ?? item.state
  if (nextState === 'done' && item.state !== 'done') {
    return { ...patch, done_at: today }
  }
  if (nextState !== 'done' && item.state === 'done') {
    return { ...patch, done_at: null }
  }
  return patch
}
