import { beforeAll, describe, expect, it, vi } from 'vitest'

import { dayOf } from './dates'

// Node re-reads TZ when it changes, and this file needs one that is not UTC:
// where the two agree, a day derived in UTC and a day derived locally look
// identical, and the test would pass over the very bug it is here to catch.
beforeAll(() => {
  vi.stubEnv('TZ', 'Europe/Bucharest')
})

describe('dayOf, away from UTC', () => {
  it('gives the day you were on, not the day UTC was on', () => {
    // 22:30 UTC is half past one the next morning in Bucharest, in summer.
    expect(dayOf('2026-08-11T22:30:00+00:00')).toBe('2026-08-12')
  })

  it('agrees with UTC in the middle of the day', () => {
    expect(dayOf('2026-08-12T10:00:00+00:00')).toBe('2026-08-12')
  })

  it('crosses a month end the same way', () => {
    expect(dayOf('2026-08-31T21:30:00+00:00')).toBe('2026-09-01')
  })

  it('refuses something that is not a timestamp', () => {
    expect(() => dayOf('not a timestamp')).toThrow()
  })
})
