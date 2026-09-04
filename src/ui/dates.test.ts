import { describe, expect, it } from 'vitest'

import { dayOf, formatDay, formatWeekday, minusDays } from './dates'

const TODAY = '2026-09-04'

describe('formatDay', () => {
  it('writes day and month, without the year, inside the current year', () => {
    expect(formatDay('2026-08-20', TODAY)).toBe('20 August')
    expect(formatDay('2026-01-05', TODAY)).toBe('5 January')
    expect(formatDay('2026-12-31', TODAY)).toBe('31 December')
  })

  it('adds the year when it falls in another one', () => {
    expect(formatDay('2025-08-20', TODAY)).toBe('20 August 2025')
  })

  it('refuses anything that is not a day', () => {
    expect(() => formatDay('2026-08', TODAY)).toThrow('Not a day')
  })
})

describe('formatWeekday', () => {
  it('puts the weekday in front', () => {
    expect(formatWeekday('2026-09-04', TODAY)).toBe('Friday, 4 September')
    expect(formatWeekday('2026-09-05', TODAY)).toBe('Saturday, 5 September')
    expect(formatWeekday('2026-09-07', TODAY)).toBe('Monday, 7 September')
  })
})

describe('minusDays', () => {
  it('crosses the end of a month and of a year', () => {
    expect(minusDays('2026-09-04', 7)).toBe('2026-08-28')
    expect(minusDays('2026-09-01', 1)).toBe('2026-08-31')
    expect(minusDays('2026-01-01', 1)).toBe('2025-12-31')
  })

  it('does not shift by a day because of a timezone', () => {
    expect(minusDays('2026-03-30', 1)).toBe('2026-03-29')
    expect(minusDays('2026-10-26', 1)).toBe('2026-10-25')
    expect(minusDays('2026-09-04', 0)).toBe('2026-09-04')
  })
})

describe('dayOf', () => {
  it('takes the day out of a timestamp', () => {
    expect(dayOf('2026-08-12T10:00:00+00:00')).toBe('2026-08-12')
  })
})
