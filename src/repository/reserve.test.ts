import { describe, expect, it } from 'vitest'

import { taxBill } from './hmrc'
import type { Income, TaxFigures } from './hmrc'
import { reserveFor } from './reserve'

const FIGURES: TaxFigures = {
  personalAllowancePence: 1_257_000,
  taperFromPence: 10_000_000,
  basicBandPence: 3_770_000,
  higherBandToPence: 12_514_000,
  basicPct: 20,
  higherPct: 40,
  additionalPct: 45,
  dividendAllowancePence: 50_000,
  dividendBasicPct: 8.75,
  dividendHigherPct: 33.75,
  dividendAdditionalPct: 39.35,
  poaThresholdPence: 100_000,
  class2SmallProfitsPence: 675_000,
  class2YearPence: 17_940,
  class4FromPence: 1_257_000,
  class4ToPence: 5_027_000,
  class4MainPct: 6,
  class4UpperPct: 2,
}

const NO_OTHER_INCOME: Income = {
  tradingPence: 0,
  employmentPence: 0,
  employmentTaxPaidPence: 0,
  dividendsPence: 0,
  paidOnAccountPence: 0,
}

describe('reserveFor', () => {
  it('asks nothing of a day inside the allowance', () => {
    // The first £12,570 of the year is untaxed, so a day early in it owes
    // nothing — which a flat percentage could never say.
    const reserve = reserveFor(FIGURES, NO_OTHER_INCOME, 0, 10_000_00)
    expect(reserve.totalPence).toBe(0)
  })

  it('asks the basic rate of a day past the allowance', () => {
    // The year is already over the allowance, so the whole of this £100 is
    // taxed at 20% and pays 6% Class 4.
    const reserve = reserveFor(FIGURES, NO_OTHER_INCOME, 2_000_000, 10_000)
    expect(reserve.taxPence).toBe(2_000)
    expect(reserve.niPence).toBe(600)
  })

  it('asks more of the same day later in the year', () => {
    const early = reserveFor(FIGURES, NO_OTHER_INCOME, 0, 10_000)
    const later = reserveFor(FIGURES, NO_OTHER_INCOME, 6_000_000, 10_000)
    expect(later.totalPence).toBeGreaterThan(early.totalPence)
  })

  it('asks nothing of a day that lost money', () => {
    expect(reserveFor(FIGURES, NO_OTHER_INCOME, 2_000_000, -5_000)).toEqual({
      taxPence: 0,
      niPence: 0,
      totalPence: 0,
    })
  })

  it('adds up to the year, however it is sliced', () => {
    // Three slices of a £36,000 year, and the whole of it. The parts are the
    // year: nothing left over, nothing counted twice.
    const slices = [1_200_000, 1_200_000, 1_200_000]
    let before = 0
    let parts = 0
    for (const slice of slices) {
      parts += reserveFor(FIGURES, NO_OTHER_INCOME, before, slice).totalPence
      before += slice
    }
    const whole = taxBill(FIGURES, { ...NO_OTHER_INCOME, tradingPence: 3_600_000 })
    expect(parts).toBe(whole.incomeTaxPence + whole.class4Pence)
  })

  it('starts a self-employed day higher when there is already a wage', () => {
    // A wage has used the allowance up, so the first pound of profit is taxed.
    const wages: Income = { ...NO_OTHER_INCOME, employmentPence: 3_000_000 }
    const withWage = reserveFor(FIGURES, wages, 0, 10_000)
    const alone = reserveFor(FIGURES, NO_OTHER_INCOME, 0, 10_000)
    expect(withWage.totalPence).toBeGreaterThan(alone.totalPence)
  })
})
