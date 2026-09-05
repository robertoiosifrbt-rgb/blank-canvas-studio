import { describe, expect, it } from 'vitest'

import { taxYearOf } from './taxyear'

describe('taxYearOf', () => {
  it('starts a year on 6 April', () => {
    expect(taxYearOf('2026-04-06')).toEqual({
      from: '2026-04-06',
      to: '2027-04-05',
      label: '2026/27',
    })
  })

  it('puts 5 April in the year that is ending', () => {
    expect(taxYearOf('2026-04-05').label).toBe('2025/26')
  })

  it('puts January in the year that started last April', () => {
    expect(taxYearOf('2027-01-31').from).toBe('2026-04-06')
  })

  it('keeps both digits when the century turns', () => {
    expect(taxYearOf('2099-06-01').label).toBe('2099/00')
  })
})
