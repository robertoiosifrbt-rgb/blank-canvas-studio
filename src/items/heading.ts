import type { Item } from '../repository/items'

/**
 * What the sheet calls the thing you opened.
 *
 * The kind, not just the state. A task is something you do; a letter comes to
 * you and wants an answer — the plan keeps them as the only two kinds on
 * purpose. Naming both "Task" hides that difference in the one place you are
 * actually working on the thing.
 *
 * Nothing captured has a kind yet, and that is the question the sheet asks.
 */
export function headingFor(item: Item): string {
  if (item.state === 'inbox') return 'What is this?'
  const done = item.state === 'done'
  if (item.kind === 'letter') return done ? 'Letter, answered' : 'Letter'
  // A shift is not done or undone the way a task is — it is a day that
  // happened. What it needs saying about it is on its own sheet.
  if (item.kind === 'shift') return 'Shift'
  return done ? 'Task, done' : 'Task'
}
