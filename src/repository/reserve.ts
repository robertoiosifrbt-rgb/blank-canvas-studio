// What a stretch of work owes, worked out where it lands in the year.
//
// The flat percentage this replaces was a guess dressed as an answer. It could
// not know that the first slice of profit is untaxed, that Class 4 stops
// climbing above a threshold, or where in the bands a day happens to fall — so
// it reserved too much in April and too little in March, and the difference
// turned up in January.
//
// A day is worth what it adds. The reserve for any slice of the year is the
// bill with it, less the bill without it: what the year owes because those
// shifts happened. Early in the year that is nothing, because the allowance
// has not been used up. Later it is a fifth, then more. Both are true, and a
// single percentage cannot be both.
//
// Sliced this way, the parts add up to the year. A month's reserve plus every
// other month's is the year's bill, with nothing left over and nothing counted
// twice — which is what makes it safe to show the same figure on a day, a
// month and a year without them disagreeing.

import { taxBill } from './hmrc'
import type { Income, TaxFigures } from './hmrc'

/** What a slice of the year's profit costs, split the way HMRC splits it. */
export type Reserve = {
  /** Income tax the slice adds to the year. */
  taxPence: number
  /** Class 4 National Insurance the slice adds. */
  niPence: number
  /** Both together. */
  totalPence: number
}

const NOTHING: Reserve = { taxPence: 0, niPence: 0, totalPence: 0 }

/**
 * What a slice of profit adds to the year's bill.
 *
 * `before` is the trading profit of the year up to the slice; `slice` is the
 * profit of the slice itself. A slice that lost money owes nothing on it: the
 * bill cannot go below what the year already owed, and handing money back is
 * not how any of this works.
 */
export function reserveFor(
  figures: TaxFigures,
  income: Income,
  beforePence: number,
  slicePence: number,
): Reserve {
  if (slicePence <= 0) return NOTHING

  const without = taxBill(figures, { ...income, tradingPence: Math.max(0, beforePence) })
  const with_ = taxBill(figures, {
    ...income,
    tradingPence: Math.max(0, beforePence) + slicePence,
  })

  const taxPence = Math.max(0, with_.incomeTaxPence - without.incomeTaxPence)
  const niPence = Math.max(0, with_.class4Pence - without.class4Pence)
  return { taxPence, niPence, totalPence: taxPence + niPence }
}
