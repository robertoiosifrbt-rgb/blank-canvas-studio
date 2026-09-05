// What the whole year owes, across every kind of income there is.
//
// This is the thing a flat percentage could never be. A reserve of 20% does
// not know that the first slice of profit is not taxed at all, that National
// Insurance stops rising above a threshold, or that a dividend is taxed at its
// own rates and pays no National Insurance whatsoever. It reserves too much
// early in the year and too little late.
//
// It also cannot be worked out one module at a time and added up. There is one
// personal allowance for the whole person, and where it lands changes the
// answer: spend it against trading profit and the dividends move up a band.
// Three separate sums, each correct on its own, come to the wrong total.
//
// The figures are not written down here. Allowances, thresholds and rates
// change every April, and a number baked into this file would go quietly wrong
// on the sixth and cost real money. They are the owner's to set, from what
// HMRC publishes, and this only does the arithmetic.

/** The year's numbers, all in pence except the rates, which are percents. */
export type TaxFigures = {
  /** Tax-free on all income. */
  personalAllowancePence: number
  /** Above this, the allowance falls by £1 for every £2 of income. */
  taperFromPence: number

  /** How much taxable income is taxed at the basic rate. */
  basicBandPence: number
  /** Taxable income above this is taxed at the additional rate. */
  higherBandToPence: number
  basicPct: number
  higherPct: number
  additionalPct: number

  /** Tax-free on dividends, on top of the personal allowance. */
  dividendAllowancePence: number
  dividendBasicPct: number
  dividendHigherPct: number
  dividendAdditionalPct: number

  /** Class 4 National Insurance, paid on trading profit alone. */
  class4FromPence: number
  class4ToPence: number
  class4MainPct: number
  class4UpperPct: number
}

/** What came in over the year, by the way it is taxed. */
export type Income = {
  /** Profit from self-employment: takings less the costs of earning them. */
  tradingPence: number
  /** Wages, before tax. */
  employmentPence: number
  /** Tax already taken off those wages under PAYE. */
  employmentTaxPaidPence: number
  /** Dividends from a company, as received. */
  dividendsPence: number
}

export type TaxBill = {
  totalIncomePence: number
  /** What is left of the personal allowance after the taper. */
  allowancePence: number
  incomeTaxPence: number
  dividendTaxPence: number
  class4Pence: number
  /** Everything owed for the year, before anything already paid. */
  totalDuePence: number
  /** Owed less what PAYE has already taken. What to have ready. */
  toFindPence: number
}

function pct(pence: number, percent: number): number {
  return Math.round((pence * percent) / 100)
}

/** How much of the range [start, start + length] lies between `from` and `to`. */
function inBand(start: number, length: number, from: number, to: number): number {
  return Math.max(0, Math.min(start + length, to) - Math.max(start, from))
}

/**
 * The year's bill.
 *
 * The order is the order HMRC works in, and it is not decorative: the personal
 * allowance goes against wages and trading profit first, dividends sit on top
 * of everything else, and Class 4 sees trading profit and nothing else.
 */
export function taxBill(figures: TaxFigures, income: Income): TaxBill {
  const { tradingPence, employmentPence, dividendsPence } = income
  const totalIncomePence = tradingPence + employmentPence + dividendsPence

  // The allowance shrinks by £1 for every £2 over the threshold, and can
  // vanish entirely. Nothing here goes negative.
  const over = Math.max(0, totalIncomePence - figures.taperFromPence)
  const allowancePence = Math.max(0, figures.personalAllowancePence - Math.floor(over / 2))

  // Wages and trading profit are taxed together, and get the allowance first.
  const earned = tradingPence + employmentPence
  const usedOnEarned = Math.min(allowancePence, earned)
  const taxableEarned = earned - usedOnEarned
  const taxableDividends = Math.max(0, dividendsPence - (allowancePence - usedOnEarned))

  const basicTo = figures.basicBandPence
  const higherTo = figures.higherBandToPence

  const incomeTaxPence =
    pct(inBand(0, taxableEarned, 0, basicTo), figures.basicPct) +
    pct(inBand(0, taxableEarned, basicTo, higherTo), figures.higherPct) +
    pct(Math.max(0, taxableEarned - higherTo), figures.additionalPct)

  // Dividends are the top slice: their bands start where the earned income
  // stopped. The dividend allowance is taxed at nothing but still uses up band
  // room, so it moves the chargeable part up rather than disappearing.
  const free = Math.min(figures.dividendAllowancePence, taxableDividends)
  const chargeable = taxableDividends - free
  const start = taxableEarned + free
  const dividendTaxPence =
    pct(inBand(start, chargeable, 0, basicTo), figures.dividendBasicPct) +
    pct(inBand(start, chargeable, basicTo, higherTo), figures.dividendHigherPct) +
    pct(
      Math.max(0, start + chargeable - Math.max(start, higherTo)),
      figures.dividendAdditionalPct,
    )

  // Class 4 sees trading profit and nothing else: no wages, no dividends.
  const class4Pence =
    pct(
      inBand(0, tradingPence, figures.class4FromPence, figures.class4ToPence),
      figures.class4MainPct,
    ) +
    pct(Math.max(0, tradingPence - figures.class4ToPence), figures.class4UpperPct)

  const totalDuePence = incomeTaxPence + dividendTaxPence + class4Pence

  return {
    totalIncomePence,
    allowancePence,
    incomeTaxPence,
    dividendTaxPence,
    class4Pence,
    totalDuePence,
    // PAYE has already handed over its part. Reserving it again would put
    // aside money that is not owed.
    toFindPence: Math.max(0, totalDuePence - income.employmentTaxPaidPence),
  }
}
