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
  poaThresholdPence: 100_000,
  class2SmallProfitsPence: 675_000,
  class2YearPence: 17_940,
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
  paidOnAccountPence: 0,
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

  it('offers Class 2 only below the small profits threshold', () => {
    // £5,000 of profit is under the threshold, so the year does not count on
    // its own and a full year of Class 2 is worth having.
    const small = taxBill(FIGURES, { ...NOTHING, tradingPence: 500_000 })
    expect(small.class2OfferedPence).toBe(17_940)
    // £30,000 is over it: the year counts already, so there is nothing to buy.
    const plenty = taxBill(FIGURES, { ...NOTHING, tradingPence: 3_000_000 })
    expect(plenty.class2OfferedPence).toBe(0)
  })

  it('never puts Class 2 on the bill', () => {
    // It is offered at a price, not asked for. Adding it would reserve money
    // HMRC is not going to ask for.
    const bill = taxBill(FIGURES, { ...NOTHING, tradingPence: 500_000 })
    expect(bill.class2OfferedPence).toBeGreaterThan(0)
    expect(bill.totalDuePence).toBe(bill.incomeTaxPence + bill.class4Pence)
  })

  it('offers nothing to a year with no trading at all', () => {
    const wages = taxBill(FIGURES, { ...NOTHING, employmentPence: 500_000 })
    expect(wages.class2OfferedPence).toBe(0)
  })

  it('asks for instalments once the bill is over the threshold', () => {
    // £30,000 of profit leaves £4,531.80 to find, well over £1,000.
    const bill = taxBill(FIGURES, { ...NOTHING, tradingPence: 3_000_000 })
    expect(bill.instalmentsAsked).toBe(true)
    expect(bill.instalmentPence).toBe(Math.round(bill.toFindPence / 2))
  })

  it('asks for none on a bill under the threshold', () => {
    // £13,000 of profit: a few pounds over the allowance, and nothing like a
    // thousand to find.
    const bill = taxBill(FIGURES, { ...NOTHING, tradingPence: 1_300_000 })
    expect(bill.instalmentsAsked).toBe(false)
    expect(bill.instalmentPence).toBe(0)
  })

  it('asks for none when four fifths was taken at source', () => {
    // An £80,000 wage that PAYE has nearly settled, and £2,000 of profit on
    // top. Over £1,000 is still to find, but HMRC has had 94% of the bill
    // already, so it does not ask for instalments as well.
    const bill = taxBill(FIGURES, {
      ...NOTHING,
      employmentPence: 8_000_000,
      employmentTaxPaidPence: 1_900_000,
      tradingPence: 200_000,
    })
    expect(bill.toFindPence).toBeGreaterThan(FIGURES.poaThresholdPence)
    expect(bill.instalmentsAsked).toBe(false)
  })

  it('takes the instalments already paid off what is left to settle', () => {
    const owed = taxBill(FIGURES, { ...NOTHING, tradingPence: 3_000_000 })
    const part = taxBill(FIGURES, {
      ...NOTHING,
      tradingPence: 3_000_000,
      paidOnAccountPence: 200_000,
    })
    expect(part.balancingPence).toBe(owed.toFindPence - 200_000)
    // What the year itself owes has not changed, only what is left to hand over.
    expect(part.toFindPence).toBe(owed.toFindPence)
  })

  it('never asks for less than nothing when the instalments overshot', () => {
    const bill = taxBill(FIGURES, {
      ...NOTHING,
      tradingPence: 3_000_000,
      paidOnAccountPence: 9_000_000,
    })
    expect(bill.balancingPence).toBe(0)
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
