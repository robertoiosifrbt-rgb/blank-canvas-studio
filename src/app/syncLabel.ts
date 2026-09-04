import type { SyncState } from '../items/useItems'

/** HH:MM from the device clock. */
function clockTime(at: Date): string {
  const hours = String(at.getHours()).padStart(2, '0')
  const minutes = String(at.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * What the sync indicator says.
 *
 * It tells the truth — it never says "synced" when it is not. A failure keeps
 * its reason, because the rows on screen then come from the cache.
 */
export function syncLabel(state: SyncState): { text: string; bad: boolean } {
  switch (state.kind) {
    case 'never':
      return { text: 'Not synced yet', bad: false }
    case 'syncing':
      return { text: 'Syncing…', bad: false }
    case 'synced':
      return { text: `Synced at ${clockTime(state.at)}`, bad: false }
    case 'failed':
      return { text: `Not synced: ${state.reason}`, bad: true }
  }
}
