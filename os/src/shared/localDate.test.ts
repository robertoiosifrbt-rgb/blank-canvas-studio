import { describe, expect, it } from 'vitest'
import { toLocalDateString, todayLocal } from './localDate'

// The suite runs with TZ=Europe/London (see vitest.config.ts).
describe('todayLocal', () => {
  it('uses the local calendar day just after midnight during BST', () => {
    // 00:30 on 15 July local time is 23:30 on 14 July in UTC. The old
    // `toISOString().slice(0, 10)` filed this workout under the day before.
    const justAfterMidnight = new Date(2026, 6, 15, 0, 30)

    expect(justAfterMidnight.toISOString().slice(0, 10)).toBe('2026-07-14')
    expect(todayLocal(justAfterMidnight)).toBe('2026-07-15')
  })

  it('agrees with UTC in winter, when London is on GMT', () => {
    const januaryMidnight = new Date(2026, 0, 15, 0, 30)

    expect(januaryMidnight.toISOString().slice(0, 10)).toBe('2026-01-15')
    expect(todayLocal(januaryMidnight)).toBe('2026-01-15')
  })

  it('handles the last minute of a day', () => {
    expect(todayLocal(new Date(2026, 6, 15, 23, 59))).toBe('2026-07-15')
  })

  it('pads months and days to two digits', () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
  })

  it('handles the last day of a year', () => {
    expect(toLocalDateString(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31')
  })
})
