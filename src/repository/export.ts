// The export: the one thing in the whole plan that gives you control that
// depends on nobody. One button, one file on your own phone.

import { localToday } from './item'
import type { Item } from './item'

export type ExportFile = {
  name: string
  /** The whole content, as text. */
  contents: string
}

/**
 * The entire snapshot, as a file.
 *
 * It includes the deleted rows and the point it is synced through: a file that
 * did not say how fresh it is would promise more than it knows.
 */
export function exportFile(
  user: string,
  items: readonly Item[],
  cursor: string | null,
  now: Date,
): ExportFile {
  const contents = JSON.stringify(
    {
      app: 'life-control-centre',
      formatVersion: 1,
      user,
      exportedAt: now.toISOString(),
      syncedThrough: cursor,
      items,
    },
    null,
    2,
  )

  // The local day, not the UTC one: a file downloaded late at night must not
  // be named after tomorrow. The contents already say the exact moment, with
  // its offset, in exportedAt.
  const day = localToday(now)
  return { name: `life-control-centre-${day}.json`, contents }
}
