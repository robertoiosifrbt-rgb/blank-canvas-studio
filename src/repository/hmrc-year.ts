// The year's figures, as they are stored and as the calculation wants them.
//
// Stored in pounds, like every other amount in the database; calculated in
// pence, so the arithmetic is exact. The two are kept apart here rather than
// in the screen, because a rounding decision made in a component is a rounding
// decision made twice within a month.

import type { Income, TaxFigures } from './hmrc'
import { asRecord, optionalNumber, optionalText } from './row'

/** What a person sets once a year, plus what the app has no module for yet. */
export type TaxYearSettings = {
  /** '2026/27', the way HMRC writes it. */
  tax_year: string

  personal_allowance: number
  taper_from: number
  basic_band: number
  higher_band_to: number
  basic_pct: number
  higher_pct: number
  additional_pct: number

  dividend_allowance: number
  dividend_basic_pct: number
  dividend_higher_pct: number
  dividend_additional_pct: number

  class4_from: number
  class4_to: number
  class4_main_pct: number
  class4_upper_pct: number

  employment: number
  employment_tax_paid: number
  dividends: number
}

/** The names of every field, so a form and a parser cannot drift apart. */
export const AMOUNTS = [
  'personal_allowance',
  'taper_from',
  'basic_band',
  'higher_band_to',
  'dividend_allowance',
  'class4_from',
  'class4_to',
  'employment',
  'employment_tax_paid',
  'dividends',
] as const

export const RATES = [
  'basic_pct',
  'higher_pct',
  'additional_pct',
  'dividend_basic_pct',
  'dividend_higher_pct',
  'dividend_additional_pct',
  'class4_main_pct',
  'class4_upper_pct',
] as const

/**
 * The year's settings out of a row, or null if any of them is missing.
 *
 * All or nothing on purpose. A bill worked out from half the figures is a
 * number that looks like an answer, and the half that is missing is the half
 * that would have made it bigger.
 */
export function yearFromRow(row: unknown): TaxYearSettings | null {
  const raw = asRecord(row)
  const tax_year = optionalText(raw, 'tax_year')
  if (tax_year === null) return null

  const values: Record<string, number> = {}
  for (const key of [...AMOUNTS, ...RATES]) {
    const value = optionalNumber(raw, key)
    if (value === null) return null
    values[key] = value
  }
  return { tax_year, ...values } as TaxYearSettings
}

/** Pounds to pence, exactly: 12570 → 1257000. */
function pence(pounds: number): number {
  return Math.round(pounds * 100)
}

/** The figures the calculation works in. */
export function figuresOf(year: TaxYearSettings): TaxFigures {
  return {
    personalAllowancePence: pence(year.personal_allowance),
    taperFromPence: pence(year.taper_from),
    basicBandPence: pence(year.basic_band),
    higherBandToPence: pence(year.higher_band_to),
    basicPct: year.basic_pct,
    higherPct: year.higher_pct,
    additionalPct: year.additional_pct,
    dividendAllowancePence: pence(year.dividend_allowance),
    dividendBasicPct: year.dividend_basic_pct,
    dividendHigherPct: year.dividend_higher_pct,
    dividendAdditionalPct: year.dividend_additional_pct,
    class4FromPence: pence(year.class4_from),
    class4ToPence: pence(year.class4_to),
    class4MainPct: year.class4_main_pct,
    class4UpperPct: year.class4_upper_pct,
  }
}

/**
 * Everything that came in, with the trading profit worked out elsewhere.
 *
 * The profit is the app's to know — it is every shift's takings less what was
 * spent earning them — and the rest is typed in until there is a module that
 * holds it.
 */
export function incomeOf(year: TaxYearSettings, tradingPence: number): Income {
  return {
    tradingPence,
    employmentPence: pence(year.employment),
    employmentTaxPaidPence: pence(year.employment_tax_paid),
    dividendsPence: pence(year.dividends),
  }
}
