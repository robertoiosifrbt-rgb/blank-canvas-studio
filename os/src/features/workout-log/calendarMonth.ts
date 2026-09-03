import { MONTH_NAMES, toLocalDateString } from '../../shared/localDate'

/**
 * The month grid behind the workout calendar.
 *
 * A month is a `YYYY-MM` string rather than a pair of numbers: it sorts, it
 * compares, and there is no month-is-zero-indexed trap to fall into. Days are
 * `YYYY-MM-DD`, the same shape sessions already store, so a day matches a
 * session by string equality and no timezone gets involved.
 */

export interface CalendarDay {
  /** `YYYY-MM-DD`. */
  date: string
  dayOfMonth: number
  /** False for the days either side that fill out the first and last weeks. */
  inMonth: boolean
}

/** Monday first: a training week starts on Monday, not on Sunday. */
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function currentMonth(now: Date = new Date()): string {
  return monthOf(toLocalDateString(now))
}

function parts(month: string): { year: number; monthIndex: number } {
  const [year, monthNumber] = month.split('-').map(Number)
  return { year, monthIndex: monthNumber - 1 }
}

/** `2026-08` → `August 2026`. */
export function monthLabel(month: string): string {
  const { year, monthIndex } = parts(month)
  return `${MONTH_NAMES[monthIndex]} ${year}`
}

/** Moves by whole months; `Date` handles the year rolling over. */
export function shiftMonth(month: string, delta: number): string {
  const { year, monthIndex } = parts(month)
  const moved = new Date(year, monthIndex + delta, 1)
  return monthOf(toLocalDateString(moved))
}

/**
 * Every day of the month, plus the days either side needed to fill whole
 * Monday-to-Sunday weeks. Only as many weeks as the month actually spans — a
 * fixed six-row grid leaves an empty row most months.
 */
export function monthGrid(month: string): CalendarDay[] {
  const { year, monthIndex } = parts(month)
  const first = new Date(year, monthIndex, 1)
  // getDay() is Sunday-first; this is how far back Monday is.
  const leading = (first.getDay() + 6) % 7

  const cursor = new Date(year, monthIndex, 1 - leading)
  const days: CalendarDay[] = []
  do {
    for (let i = 0; i < 7; i += 1) {
      days.push({
        date: toLocalDateString(cursor),
        dayOfMonth: cursor.getDate(),
        inMonth: cursor.getMonth() === monthIndex,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    // Stop once the week just written has carried us past the month.
  } while (cursor.getMonth() === monthIndex && cursor.getFullYear() === year)

  return days
}

/* Re-exported so the calendar's own imports read as one module; the
   implementation is shared with the photo gallery. See shared/localDate.ts. */
export { dayLabel } from '../../shared/localDate'
