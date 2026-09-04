import { describe, expect, it } from 'vitest'

import { syncLabel } from './syncLabel'

describe('syncLabel', () => {
  it('does not claim anything before the first sync', () => {
    expect(syncLabel({ kind: 'never' })).toEqual({
      text: 'Not synced yet',
      bad: false,
    })
  })

  it('says it is working while it works', () => {
    expect(syncLabel({ kind: 'syncing' }).text).toBe('Syncing…')
  })

  it('says when it last succeeded, from the device clock', () => {
    const at = new Date(2026, 8, 4, 19, 5)
    expect(syncLabel({ kind: 'synced', at, fetched: 3 }).text).toBe('Synced at 19:05')
  })

  it('never says synced when it is not, and keeps the reason', () => {
    const label = syncLabel({ kind: 'failed', reason: 'Fetching rows: no network' })
    expect(label.text).toBe('Not synced: Fetching rows: no network')
    expect(label.bad).toBe(true)
    expect(label.text).not.toContain('Synced at')
  })
})
