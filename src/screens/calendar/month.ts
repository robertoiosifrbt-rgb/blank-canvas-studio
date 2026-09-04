// The month, laid out in weeks. A grid over the days that already exist.
//
// The grid holds no data of its own: every mark on it is counted straight off
// the CalendarDay list the repository returns. A second place holding "what
// happens on the 12th" would be a second truth able to disagree with the
// first.

import type { CalendarDay } from '../../repository/items'
import { monthDays, monthOf, plusDays, weekdayIndex } from '../../ui/dates'

export type MonthCell = {
  /** The day, as 'YYYY-MM-DD'. */
  day: string
  /** False for the days either side that only fill the week out. */
  inMonth: boolean
  /** How many things are planned for this day. */
  planned: number
  /** How many things were done on this day. */
  done: number
}

/** Weeks of seven, Monday first. */
export type MonthWeek = MonthCell[]

const DAYS_IN_WEEK = 7

/**
 * The days of the month, padded either side until every week is whole.
 *
 * The padding days are real days, not blanks: tapping the 31st of last month
 * from the edge of this one has to land on that day, not on nothing.
 */
export function monthCells(month: string): { day: string; inMonth: boolean }[] {
  const days = monthDays(month)
  const first = days[0]
  const last = days[days.length - 1]
  if (first === undefined || last === undefined) {
    throw new Error(`Not a month: ${month}`)
  }

  const before = weekdayIndex(first)
  const after = DAYS_IN_WEEK - 1 - weekdayIndex(last)

  const cells: { day: string; inMonth: boolean }[] = []
  for (let i = before; i > 0; i -= 1) {
    cells.push({ day: plusDays(first, -i), inMonth: false })
  }
  for (const day of days) cells.push({ day, inMonth: true })
  for (let i = 1; i <= after; i += 1) {
    cells.push({ day: plusDays(last, i), inMonth: false })
  }
  return cells
}

/** The month as weeks, each cell carrying what that day holds. */
export function monthGrid(
  month: string,
  days: readonly CalendarDay[],
): MonthWeek[] {
  const byDay = new Map(days.map((day) => [day.day, day]))

  const cells: MonthCell[] = monthCells(month).map((cell) => {
    const day = byDay.get(cell.day)
    return {
      ...cell,
      planned: day?.planned.length ?? 0,
      done: day?.done.length ?? 0,
    }
  })

  const weeks: MonthWeek[] = []
  for (let i = 0; i < cells.length; i += DAYS_IN_WEEK) {
    weeks.push(cells.slice(i, i + DAYS_IN_WEEK))
  }
  return weeks
}

/** The day to open a month on: today when it falls in it, otherwise the 1st. */
export function openingDay(month: string, today: string): string {
  if (monthOf(today) === month) return today
  const first = monthDays(month)[0]
  if (first === undefined) throw new Error(`Not a month: ${month}`)
  return first
}
