import { describe, expect, it } from 'vitest'
import { currentMonth, dayLabel, monthGrid, monthLabel, monthOf, shiftMonth } from './calendarMonth'

const inMonth = (month: string) => monthGrid(month).filter((day) => day.inMonth)

describe('monthOf / currentMonth', () => {
  it('takes the month off a date', () => {
    expect(monthOf('2026-08-12')).toBe('2026-08')
  })

  it('reads the local month, not the UTC one', () => {
    // Just after midnight: `toISOString()` would still say the day before, and
    // on the first of the month that is the wrong month entirely.
    expect(currentMonth(new Date(2026, 8, 1, 0, 30))).toBe('2026-09')
  })
})

describe('monthLabel', () => {
  it('spells the month out', () => {
    expect(monthLabel('2026-08')).toBe('August 2026')
    expect(monthLabel('2025-05')).toBe('May 2025')
  })
})

describe('dayLabel', () => {
  it('spells a day out for a screen reader', () => {
    expect(dayLabel('2026-07-15')).toBe('15 July 2026')
    expect(dayLabel('2026-01-01')).toBe('1 January 2026')
  })
})

describe('shiftMonth', () => {
  it('moves forward and back', () => {
    expect(shiftMonth('2026-08', 1)).toBe('2026-09')
    expect(shiftMonth('2026-08', -1)).toBe('2026-07')
  })

  it('rolls over the year', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})

describe('monthGrid', () => {
  it('holds every day of the month', () => {
    expect(inMonth('2026-08')).toHaveLength(31)
    expect(inMonth('2026-02')).toHaveLength(28)
    expect(inMonth('2026-04')).toHaveLength(30)
  })

  it('knows a leap year', () => {
    expect(inMonth('2028-02')).toHaveLength(29)
  })

  it('is made of whole weeks', () => {
    for (const month of ['2026-01', '2026-02', '2026-08', '2027-05']) {
      expect(monthGrid(month).length % 7).toBe(0)
    }
  })

  /*
   * getDay() counts from Sunday. Weeks here start on Monday, which is the
   * off-by-one every hand-rolled calendar gets wrong: a month starting on a
   * Sunday needs six filler days in front of it, not none.
   */
  it('starts every week on a Monday', () => {
    for (const month of ['2026-01', '2026-03', '2026-08', '2026-11']) {
      const grid = monthGrid(month)
      for (let i = 0; i < grid.length; i += 7) {
        expect(new Date(`${grid[i].date}T12:00:00`).getDay()).toBe(1)
      }
    }
  })

  it('pads a month that starts on a Sunday with a full week in front', () => {
    // 1 February 2026 is a Sunday.
    const grid = monthGrid('2026-02')
    expect(grid[0].date).toBe('2026-01-26')
    expect(grid.filter((day) => !day.inMonth && day.date < '2026-02-01')).toHaveLength(6)
  })

  it('needs no padding when a month starts on a Monday', () => {
    // 1 June 2026 is a Monday.
    expect(monthGrid('2026-06')[0]).toEqual({ date: '2026-06-01', dayOfMonth: 1, inMonth: true })
  })

  it('runs its days in order, with no gaps or repeats', () => {
    const grid = monthGrid('2026-08')
    const dates = grid.map((day) => day.date)

    expect(new Set(dates).size).toBe(dates.length)
    expect([...dates].sort()).toEqual(dates)
  })

  /* A fixed six-row grid leaves an empty trailing week most months. */
  it('adds no week beyond the ones the month reaches into', () => {
    // February 2026 is exactly four weeks once padded: Sun 1 to Sat 28.
    expect(monthGrid('2026-02')).toHaveLength(35)
    expect(monthGrid('2026-06')).toHaveLength(35)
  })

  it('marks the filler days as outside the month', () => {
    for (const day of monthGrid('2026-08')) {
      expect(day.inMonth).toBe(day.date.startsWith('2026-08'))
    }
  })
})
