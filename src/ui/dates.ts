// Dates, written out. One place, so "20 August" looks the same everywhere.

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

function parts(day: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (match === null) throw new Error(`Not a day: ${day}`)
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

/**
 * "20 August", or "20 August 2025" when it falls in another year than today.
 *
 * The year appears only when leaving it out could mislead.
 */
export function formatDay(day: string, today: string): string {
  const { year, month, day: date } = parts(day)
  const monthName = MONTHS[month - 1]
  if (monthName === undefined) throw new Error(`Invalid month: ${day}`)

  return year === parts(today).year
    ? `${date} ${monthName}`
    : `${date} ${monthName} ${year}`
}

/** "Friday, 4 September" — the heading of a day in the Calendar. */
export function formatWeekday(day: string, today: string): string {
  const { year, month, day: date } = parts(day)
  // Noon UTC: far enough from midnight that a timezone cannot shift the day.
  const name = WEEKDAYS[new Date(Date.UTC(year, month - 1, date, 12)).getUTCDay()]
  if (name === undefined) throw new Error(`Invalid day: ${day}`)
  return `${name}, ${formatDay(day, today)}`
}

/** The day `days` days before the given one, as 'YYYY-MM-DD'. */
export function minusDays(day: string, days: number): string {
  const { year, month, day: date } = parts(day)
  const at = new Date(Date.UTC(year, month - 1, date, 12))
  at.setUTCDate(at.getUTCDate() - days)
  const y = at.getUTCFullYear()
  const m = String(at.getUTCMonth() + 1).padStart(2, '0')
  const d = String(at.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** The day out of a timestamp, as 'YYYY-MM-DD'. */
export function dayOf(timestamp: string): string {
  return timestamp.slice(0, 10)
}

function monthParts(month: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (match === null) throw new Error(`Not a month: ${month}`)
  return { year: Number(match[1]), month: Number(match[2]) }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The month a day falls in, as 'YYYY-MM'. */
export function monthOf(day: string): string {
  const { year, month } = parts(day)
  return `${year}-${pad(month)}`
}

/** The month `by` months away, as 'YYYY-MM'. Negative goes back. */
export function shiftMonth(month: string, by: number): string {
  const { year, month: m } = monthParts(month)
  const at = new Date(Date.UTC(year, m - 1 + by, 1, 12))
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}`
}

/** "September 2026" — the heading above the grid. */
export function formatMonth(month: string): string {
  const { year, month: m } = monthParts(month)
  const name = MONTHS[m - 1]
  if (name === undefined) throw new Error(`Invalid month: ${month}`)
  return `${name} ${year}`
}

/** Every day of the month, in order, as 'YYYY-MM-DD'. */
export function monthDays(month: string): string[] {
  const { year, month: m } = monthParts(month)
  const days: string[] = []
  const at = new Date(Date.UTC(year, m - 1, 1, 12))
  while (at.getUTCMonth() === m - 1) {
    days.push(`${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`)
    at.setUTCDate(at.getUTCDate() + 1)
  }
  return days
}

/** The day `days` days after the given one, as 'YYYY-MM-DD'. */
export function plusDays(day: string, days: number): string {
  return minusDays(day, -days)
}

/**
 * Which column the day sits in, with the week starting on Monday: 0 for
 * Monday, 6 for Sunday.
 */
export function weekdayIndex(day: string): number {
  const { year, month, day: date } = parts(day)
  const sunday = new Date(Date.UTC(year, month - 1, date, 12)).getUTCDay()
  return (sunday + 6) % 7
}
