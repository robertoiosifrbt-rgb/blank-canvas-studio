import { describe, expect, it } from 'vitest'

import { untilMidnight } from './today'

const HOUR = 60 * 60 * 1000

describe('untilMidnight', () => {
  it('is an hour before one in the morning', () => {
    expect(untilMidnight(new Date(2026, 8, 4, 23, 0, 0, 0))).toBe(HOUR)
  })

  it('is a whole day at midnight exactly, never zero', () => {
    expect(untilMidnight(new Date(2026, 8, 4, 0, 0, 0, 0))).toBe(24 * HOUR)
  })

  it('counts the seconds too, so it does not fire a minute early', () => {
    expect(untilMidnight(new Date(2026, 8, 4, 23, 59, 59, 500))).toBe(500)
  })

  it('crosses a month end', () => {
    expect(untilMidnight(new Date(2026, 8, 30, 22, 0, 0, 0))).toBe(2 * HOUR)
  })

  it('crosses a year end', () => {
    expect(untilMidnight(new Date(2026, 11, 31, 22, 0, 0, 0))).toBe(2 * HOUR)
  })

  it('is always ahead, never behind', () => {
    for (const hour of [0, 1, 6, 12, 18, 23]) {
      expect(untilMidnight(new Date(2026, 8, 4, hour, 30))).toBeGreaterThan(0)
    }
  })
})
