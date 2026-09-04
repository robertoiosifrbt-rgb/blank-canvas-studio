// The Calendar opens at today. What is behind it is folded, never dropped.
//
// Dropping the past would take everything finished off the last screen that
// still shows it — done_at exists precisely so that nothing finished
// disappears from every screen, and the plan allows no flow without an exit.

import type { CalendarDay } from '../../repository/items'
import { formatDay } from '../../ui/dates'
import { plural } from '../../ui/plural'

export type SplitDays = {
  /** Days before today. Counted, not listed, until you ask for them. */
  past: CalendarDay[]
  /** Today and everything after it. */
  from: CalendarDay[]
}

/**
 * Today at the top.
 *
 * Without this the days pile up oldest-first and today sinks further out of
 * reach with every week that passes — the screen that answers "what now"
 * becomes the one you have to scroll for.
 */
export function splitDays(
  days: readonly CalendarDay[],
  today: string,
): SplitDays {
  return {
    past: days.filter((day) => day.day < today),
    from: days.filter((day) => day.day >= today),
  }
}

/** The oldest day in the list, or null for an empty list. */
export function oldestDay(days: readonly CalendarDay[]): string | null {
  let oldest: string | null = null
  for (const day of days) {
    if (oldest === null || day.day < oldest) oldest = day.day
  }
  return oldest
}

/** "12 days, the oldest from 20 August". */
export function pastLabel(past: readonly CalendarDay[], today: string): string {
  const count = plural(past.length, 'day', 'days')
  const oldest = oldestDay(past)
  return oldest === null
    ? count
    : `${count}, the oldest from ${formatDay(oldest, today)}`
}
