// The shape of a shift: the readings, the sessions, and what each platform
// paid.
//
// It is one object here and three tables in the database, because that is
// what it is: nothing ever asks for a session on its own, only ever for the
// sessions of a shift. Holding it as one thing is what lets the cache replace
// a shift's parts wholesale, which is the sync strategy the migration
// declares.

import { asRecord, optionalNumber, optionalText, requiredText } from './row'

/** The three the owner drives for. The same three the check constraint names. */
export const PLATFORMS = ['uber_eats', 'deliveroo', 'just_eat'] as const
export type Platform = (typeof PLATFORMS)[number]

/** What the platform is called on screen. */
export const PLATFORM_NAMES: Record<Platform, string> = {
  uber_eats: 'Uber Eats',
  deliveroo: 'Deliveroo',
  just_eat: 'Just Eat',
}

export type ShiftSession = {
  id: string
  /** A moment, not a clock time: a session can run past midnight. */
  started_at: string
  /** Empty while you are still out. */
  ended_at: string | null
}

export type ShiftEarning = { platform: Platform; amount: number }

export type Shift = {
  item_id: string
  owner: string
  /** The odometer as read. Kilometres are the difference, worked out below. */
  odo_start: number | null
  odo_end: number | null
  tips: number | null
  /**
   * The rates this shift was worked under, written by the database and never
   * by a client. Null means they were not set yet when it was written down.
   */
  rate_tax_pct: number | null
  rate_ni_pct: number | null
  rate_fuel_per_km: number | null
  rate_vehicle_per_km: number | null
  sessions: ShiftSession[]
  earnings: ShiftEarning[]
}

export type ShiftPatch = Partial<Pick<Shift, 'odo_start' | 'odo_end' | 'tips'>>

function requiredMomentText(raw: Record<string, unknown>, key: string): string {
  const value = requiredText(raw, key)
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${key} is not a moment in time: ${value}`)
  }
  return value
}

export function sessionFromRow(row: unknown): ShiftSession {
  const raw = asRecord(row)
  const started_at = requiredMomentText(raw, 'started_at')
  const ended_at = optionalText(raw, 'ended_at')
  if (ended_at !== null && Number.isNaN(Date.parse(ended_at))) {
    throw new Error(`ended_at is not a moment in time: ${ended_at}`)
  }
  // The database refuses this, so a row carrying it did not come from there.
  if (ended_at !== null && Date.parse(ended_at) <= Date.parse(started_at)) {
    throw new Error('A session that ends before it starts')
  }
  return { id: requiredText(raw, 'id'), started_at, ended_at }
}

export function earningFromRow(row: unknown): ShiftEarning {
  const raw = asRecord(row)
  const platform = requiredText(raw, 'platform')
  if (!(PLATFORMS as readonly string[]).includes(platform)) {
    throw new Error(`Unknown platform: ${platform}`)
  }
  const amount = optionalNumber(raw, 'amount')
  if (amount === null) throw new Error('Earning without an amount')
  if (amount < 0) throw new Error(`A platform paid less than nothing: ${amount}`)
  return { platform: platform as Platform, amount }
}

export function shiftFromRow(
  row: unknown,
  sessions: ShiftSession[],
  earnings: ShiftEarning[],
): Shift {
  const raw = asRecord(row)
  const odo_start = optionalNumber(raw, 'odo_start')
  const odo_end = optionalNumber(raw, 'odo_end')
  if (odo_start !== null && odo_end !== null && odo_end < odo_start) {
    throw new Error('The odometer runs backwards')
  }
  return {
    item_id: requiredText(raw, 'item_id'),
    owner: requiredText(raw, 'owner'),
    odo_start,
    odo_end,
    tips: optionalNumber(raw, 'tips'),
    rate_tax_pct: optionalNumber(raw, 'rate_tax_pct'),
    rate_ni_pct: optionalNumber(raw, 'rate_ni_pct'),
    rate_fuel_per_km: optionalNumber(raw, 'rate_fuel_per_km'),
    rate_vehicle_per_km: optionalNumber(raw, 'rate_vehicle_per_km'),
    sessions,
    earnings,
  }
}

/**
 * Kilometres driven: the difference, not a stored number.
 *
 * Null until both readings are there. A shift with only a start has not
 * driven zero kilometres — it has driven an unknown number, and showing zero
 * would be the screen making something up.
 */
export function kilometres(shift: Shift): number | null {
  if (shift.odo_start === null || shift.odo_end === null) return null
  return shift.odo_end - shift.odo_start
}

/**
 * Minutes worked, over every session that has finished.
 *
 * A session still running is left out rather than counted up to now: a total
 * that grows while you look at it cannot be checked against anything, and the
 * screen says separately that one is open.
 */
export function minutesWorked(shift: Shift): number {
  let total = 0
  for (const session of shift.sessions) {
    if (session.ended_at === null) continue
    total += (Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60000
  }
  return Math.round(total)
}

/** Whether a session is still open — you are out now. */
export function isOut(shift: Shift): boolean {
  return shift.sessions.some((session) => session.ended_at === null)
}

/**
 * What the shift made: the platforms and the tips together.
 *
 * In pence, so the addition is exact. Money added as floating point drifts,
 * and it drifts in the direction nobody notices until a month is out.
 */
export function earnedPence(shift: Shift): number {
  let total = shift.tips === null ? 0 : Math.round(shift.tips * 100)
  for (const earning of shift.earnings) total += Math.round(earning.amount * 100)
  return total
}
