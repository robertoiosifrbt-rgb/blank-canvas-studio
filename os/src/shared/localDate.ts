/**
 * Calendar dates in this app are stored as `YYYY-MM-DD` strings and mean
 * "the day the user was living through", not an instant in time.
 *
 * `new Date().toISOString().slice(0, 10)` gives the UTC day, which is the
 * previous day between 00:00 and 00:59 local time in the UK during BST (and
 * for every timezone ahead of UTC). A workout logged just after midnight
 * would land on the day before. These helpers read the local calendar fields
 * instead, so the default date always matches the phone's clock.
 */
export function toLocalDateString(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayLocal(now: Date = new Date()): string {
  return toLocalDateString(now)
}

/**
 * The Monday of the week `now` falls in, as a calendar date. Weeks start on
 * Monday because that is how a training week is counted, not Sunday as
 * `getDay()` numbers it.
 */
export function startOfWeekLocal(now: Date = new Date()): string {
  const monday = new Date(now)
  const weekday = monday.getDay()
  monday.setDate(monday.getDate() + (weekday === 0 ? -6 : 1 - weekday))
  return toLocalDateString(monday)
}

/** The first day of the month `now` falls in, as a calendar date. */
export function startOfMonthLocal(now: Date = new Date()): string {
  return toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1))
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * `2026-07-15` → `15 July 2026`. Screen readers get the day spoken rather than
 * spelled out digit by digit, and a written-out month never reads as a
 * different date to a different reader the way `07-15` does.
 *
 * Lives here, not in a feature module: the workout calendar and the progress
 * photo gallery both show stored dates, and neither should have to import from
 * the other to say the same thing.
 *
 * Built from the string's own parts on purpose — going through `Date` would
 * reintroduce the timezone shift the helpers above exist to avoid.
 */
export function dayLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day || !MONTH_NAMES[month - 1]) return date
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`
}
