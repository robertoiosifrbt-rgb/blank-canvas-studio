import { describe, expect, it } from 'vitest'

import type { CalendarDay } from '../../repository/items'
import { oldestDay, pastLabel, splitDays } from './split'

const TODAY = '2026-09-04'

const day = (d: string): CalendarDay => ({ day: d, planned: [], done: [] })

describe('splitDays', () => {
  it('keeps today at the top of what is shown', () => {
    const { from } = splitDays(
      [day('2026-08-20'), day(TODAY), day('2026-09-06')],
      TODAY,
    )
    expect(from.map((d) => d.day)).toEqual([TODAY, '2026-09-06'])
  })

  it('folds the past instead of dropping it', () => {
    const { past } = splitDays(
      [day('2026-08-20'), day('2026-09-03'), day(TODAY)],
      TODAY,
    )
    expect(past.map((d) => d.day)).toEqual(['2026-08-20', '2026-09-03'])
  })

  it('loses no day: past and from together are everything given', () => {
    const days = [day('2026-08-20'), day(TODAY), day('2026-09-06')]
    const { past, from } = splitDays(days, TODAY)
    expect(past.length + from.length).toBe(days.length)
  })

  it('puts today in from, never in past', () => {
    const { past, from } = splitDays([day(TODAY)], TODAY)
    expect(past).toEqual([])
    expect(from.map((d) => d.day)).toEqual([TODAY])
  })
})

describe('oldestDay', () => {
  it('is null for an empty list', () => {
    expect(oldestDay([])).toBeNull()
  })

  it('does not trust the order it was given', () => {
    expect(oldestDay([day('2026-09-03'), day('2026-08-20')])).toBe('2026-08-20')
  })
})

describe('pastLabel', () => {
  it('counts one day in the singular', () => {
    expect(pastLabel([day('2026-09-03')], TODAY)).toBe(
      '1 day, the oldest from 3 September',
    )
  })

  it('names the oldest day it is hiding', () => {
    expect(pastLabel([day('2026-08-20'), day('2026-09-03')], TODAY)).toBe(
      '2 days, the oldest from 20 August',
    )
  })
})
