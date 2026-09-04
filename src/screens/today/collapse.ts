// Collapsing, with numbers instead of interpretation.
//
// Not a wall of red, but it does not hide a deadline that matters either:
// whatever is overdue within the last seven days stays expanded, the rest is
// counted.

import type { Item } from '../../repository/items'
import { dayOf, formatDay, minusDays } from '../../ui/dates'

/** Overdue items from the last this-many days stay expanded. */
export const EXPANDED_DAYS = 7

/** "1 item" / "14 items". */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

export type SplitOverdue = {
  /** Due within the last seven days. A task overdue yesterday must be seen. */
  recent: Item[]
  /** Older than seven days. Counted, not listed. */
  old: Item[]
}

export function splitOverdue(
  overdue: readonly Item[],
  today: string,
): SplitOverdue {
  const edge = minusDays(today, EXPANDED_DAYS)
  return {
    recent: overdue.filter((item) => item.due !== null && item.due >= edge),
    old: overdue.filter((item) => item.due !== null && item.due < edge),
  }
}

/** The oldest due date in the list, or null for an empty list. */
export function oldestDue(items: readonly Item[]): string | null {
  let oldest: string | null = null
  for (const item of items) {
    if (item.due === null) continue
    if (oldest === null || item.due < oldest) oldest = item.due
  }
  return oldest
}

/** The day the oldest item in the list was written. */
export function oldestCreated(items: readonly Item[]): string | null {
  let oldest: string | null = null
  for (const item of items) {
    const day = dayOf(item.created_at)
    if (oldest === null || day < oldest) oldest = day
  }
  return oldest
}

/** "12 overdue, the oldest from 20 August". */
export function oldOverdueLabel(old: readonly Item[], today: string): string {
  const count = `${old.length} overdue`
  const oldest = oldestDue(old)
  return oldest === null ? count : `${count}, the oldest from ${formatDay(oldest, today)}`
}

/** "14 things, the oldest from 12 August". */
export function undatedLabel(items: readonly Item[], today: string): string {
  const count = plural(items.length, 'thing', 'things')
  const oldest = oldestCreated(items)
  return oldest === null ? count : `${count}, the oldest from ${formatDay(oldest, today)}`
}
