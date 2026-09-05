import { describe, expect, it } from 'vitest'

import { taxBill } from './hmrc'
import type { Income, TaxFigures } from './hmrc'

// Figures a person would type in, from what HMRC publishes. They are here as
// numbers to test the arithmetic against, not as anything the code believes.
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
  class4FromPence: 1_257_000,
  class4ToPence: 5_027_000,
  class4MainPct: 6,
  class4UpperPct: 2,
}

const NOTHING: Income = {
  tradingPence: 0,
  employmentPence: 0,
  employmentTaxPaidPence: 0,
  dividendsPence: 0,
}

describe('taxBill', () => {
  it('owes nothing on a year with no income', () => {
    expect(taxBill(FIGURES, NOTHING).totalDuePence).toBe(0)
  })

  it('leaves the allowance untaxed', () => {
    const bill = taxBill(FIGURES, { ...NOTHING, tradingPence: 1_257_000 })
    expect(bill.incomeTaxPence).toBe(0)
    expect(bill.class4Pence).toBe(0)
  })

  it('taxes a delivery year at the basic rate, with Class 4 on top', () => {
    // £30,000 profit: £17,430 taxable at 20%, and the same £17,430 at 6%.
    const bill = taxBill(FIGURES, { ...NOTHING, tradingPence: 3_000_000 })
    expect(bill.incomeTaxPence).toBe(348_600)
    expect(bill.class4Pence).toBe(104_580)
    expect(bill.totalDuePence).toBe(453_180)
  })

  it('puts dividends on top of the profit, and charges them no Class 4', () => {
    // £20,000 profit and £10,000 of dividends. The allowance goes against the
    // profit, so £7,430 is taxed at 20%. Of the dividends, £500 is free and
    // £9,500 sits inside the basic band at 8.75%.
    const bill = taxBill(FIGURES, {
      ...NOTHING,
      tradingPence: 2_000_000,
      dividendsPence: 1_000_000,
    })
    expect(bill.incomeTaxPence).toBe(148_600)
    expect(bill.dividendTaxPence).toBe(83_125)
    expect(bill.class4Pence).toBe(44_580)
  })

  it('shrinks the allowance by £1 for every £2 over the threshold', () => {
    // £110,000 of income is £10,000 over, so £5,000 of allowance goes.
    const bill = taxBill(FIGURES, { ...NOTHING, employmentPence: 11_000_000 })
    expect(bill.allowancePence).toBe(757_000)
  })

  it('takes the allowance away entirely well past the threshold', () => {
    const bill = taxBill(FIGURES, { ...NOTHING, employmentPence: 20_000_000 })
    expect(bill.allowancePence).toBe(0)
  })

  it('does not reserve what PAYE has already handed over', () => {
    const wages = { ...NOTHING, employmentPence: 3_000_000 }
    const bill = taxBill(FIGURES, wages)
    const paid = taxBill(FIGURES, { ...wages, employmentTaxPaidPence: 348_600 })
    expect(bill.toFindPence).toBe(348_600)
    expect(paid.toFindPence).toBe(0)
  })

  it('never asks for less than nothing when PAYE overpaid', () => {
    const bill = taxBill(FIGURES, {
      ...NOTHING,
      employmentPence: 1_500_000,
      employmentTaxPaidPence: 900_000,
    })
    expect(bill.toFindPence).toBe(0)
  })

  it('charges the upper Class 4 rate above the upper limit', () => {
    // £60,000 of profit: £37,700 of it between the two limits at 6%, and
    // £9,730 above the upper limit at 2%.
    const bill = taxBill(FIGURES, { ...NOTHING, tradingPence: 6_000_000 })
    expect(bill.class4Pence).toBe(226_200 + 19_460)
  })

  it('is the same bill whichever module the income came from', () => {
    // One allowance, one set of bands. £30,000 of wages and £30,000 of profit
    // owe the same income tax as £60,000 of either, which is the whole reason
    // this cannot be worked out a module at a time and added up.
    const split = taxBill(FIGURES, {
      ...NOTHING,
      tradingPence: 3_000_000,
      employmentPence: 3_000_000,
    })
    const whole = taxBill(FIGURES, { ...NOTHING, employmentPence: 6_000_000 })
    expect(split.incomeTaxPence).toBe(whole.incomeTaxPence)
  })
})
