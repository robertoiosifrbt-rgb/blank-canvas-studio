import { describe, expect, it } from 'vitest'

import type { Shift } from './shift'
import { takeHome, takeHomeOfAll } from './takehome'

/** The day the owner showed: £126.45 over 167.4 km, at 20% / 6% / £0.116. */
function day(over: Partial<Shift> = {}): Shift {
  return {
    item_id: 'i1',
    owner: 'me',
    odo_start: 120345,
    odo_end: 120512.4,
    tips: 12.5,
    personal_km: null,
    rate_tax_pct: 20,
    rate_ni_pct: 6,
    rate_fuel_per_km: 0.116,
    rate_vehicle_per_km: 0.116,
    sessions: [],
    earnings: [
      { platform: 'uber_eats', amount: 64.2 },
      { platform: 'deliveroo', amount: 31 },
      { platform: 'just_eat', amount: 18.75 },
    ],
    ...over,
  }
}

describe('takeHome', () => {
  it('takes the reserves off the profit, not off the takings', () => {
    const sum = takeHome(day())
    expect(sum.grossPence).toBe(12645)
    // 167.4 km at £0.232 the kilometre.
    expect(sum.costsPence).toBe(3884)
    expect(sum.profitPence).toBe(8761)
    expect(sum.taxPence).toBe(1752)
    expect(sum.niPence).toBe(526)
    expect(sum.netPence).toBe(6483)
    expect(sum.missing).toEqual([])
  })

  it('says what it could not work out instead of calling it zero', () => {
    const noRates = takeHome(day({ rate_tax_pct: null, rate_ni_pct: null }))
    expect(noRates.taxPence).toBe(0)
    expect(noRates.missing).toContain('rates')

    const noCosts = takeHome(day({ rate_fuel_per_km: null, rate_vehicle_per_km: null }))
    expect(noCosts.costsPence).toBe(0)
    expect(noCosts.missing).toContain('costs')

    const noReading = takeHome(day({ odo_end: null }))
    expect(noReading.costsPence).toBe(0)
    expect(noReading.missing).toContain('kilometres')
  })

  it('reserves nothing on a day that lost money', () => {
    // Two hundred kilometres and almost nothing earned: the costs are more
    // than the takings, and a percentage of a loss is not money coming back.
    const bad = takeHome(
      day({ odo_start: 0, odo_end: 200, tips: null, earnings: [] }),
    )
    expect(bad.profitPence).toBeLessThan(0)
    expect(bad.taxPence).toBe(0)
    expect(bad.niPence).toBe(0)
    expect(bad.netPence).toBe(bad.profitPence)
  })

  it('keeps the rates the shift was worked under, whatever is set now', () => {
    // The pinning is the database's job; this only proves the sum reads the
    // shift and never a setting.
    const october = takeHome(day({ rate_tax_pct: 20 }))
    const january = takeHome(day({ rate_tax_pct: 30 }))
    expect(october.taxPence).toBe(1752)
    expect(january.taxPence).toBe(2628)
  })
})

describe('takeHomeOfAll', () => {
  it('adds the parts up, and carries every gap forward', () => {
    const total = takeHomeOfAll([day(), day({ rate_tax_pct: null, rate_ni_pct: null })])
    expect(total.grossPence).toBe(25290)
    expect(total.taxPence).toBe(1752)
    expect(total.missing).toEqual(['rates'])
  })

  it('is nothing at all over no shifts', () => {
    expect(takeHomeOfAll([])).toEqual({
      grossPence: 0,
      costsPence: 0,
      profitPence: 0,
      taxPence: 0,
      niPence: 0,
      netPence: 0,
      missing: [],
    })
  })
})
