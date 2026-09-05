// A tax year's figures, as they are stored and as the calculation wants them.
//
// One row per year, never one row edited each April. The figures change every
// April, and a single row would mean that setting this year's allowance
// silently rewrote last year's bill. A filed return does not change.
//
// Stored in pounds, like every other amount in the database; calculated in
// pence, so the arithmetic is exact. The two are kept apart here rather than
// in a screen, because a rounding decision made in a component is a rounding
// decision made twice within a month.

import type { Income, TaxFigures } from './hmrc'
import { asRecord, requiredText, stampsOf } from './row'
import type { Row } from './row'

/** Every amount the year holds, in pounds. */
export const AMOUNTS = [
  'personal_allowance',
  'taper_from',
  'basic_band',
  'higher_band_to',
  'dividend_allowance',
  'class4_from',
  'class4_to',
  'class2_small_profits',
  'class2_year',
  'employment',
  'employment_tax_paid',
  'dividends',
  'poa_threshold',
  'paid_on_account',
] as const

/** Every rate the year holds, as a percentage. */
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

export type Figure = (typeof AMOUNTS)[number] | (typeof RATES)[number]

/** What is written down for one tax year: the year's figures, and the income. */
export type TaxYearPatch = { tax_year: string } & Record<Figure, number>

/** A stored year. Keyed by the person and the year, never by an id. */
export type TaxYearRow = Omit<Row, 'id'> & TaxYearPatch

function figure(raw: Record<string, unknown>, key: string): number {
  const value = raw[key]
  // Postgres hands numeric back as a string when it will not fit a double.
  const number = typeof value === 'string' ? Number(value) : value
  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw new Error(`A tax year without ${key}`)
  }
  return number
}

/** One row of `tax_years`. Every figure is required: the table says so too. */
export function taxYearFromRow(row: unknown): TaxYearRow {
  const raw = asRecord(row)
  const values: Record<string, number> = {}
  for (const key of [...AMOUNTS, ...RATES]) values[key] = figure(raw, key)
  return {
    owner: requiredText(raw, 'owner'),
    tax_year: requiredText(raw, 'tax_year'),
    ...(values as Record<Figure, number>),
    ...stampsOf(raw),
  }
}

/** The year in a list, or null when that year has not been set up. */
export function yearIn(
  years: readonly TaxYearRow[],
  label: string,
): TaxYearRow | null {
  return years.find((y) => y.tax_year === label && y.deleted_at === null) ?? null
}

/** Pounds to pence, exactly: 12570 → 1257000. */
function pence(pounds: number): number {
  return Math.round(pounds * 100)
}

/** The figures the calculation works in. */
export function figuresOf(year: TaxYearPatch): TaxFigures {
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
    poaThresholdPence: pence(year.poa_threshold),
    class2SmallProfitsPence: pence(year.class2_small_profits),
    class2YearPence: pence(year.class2_year),
    class4FromPence: pence(year.class4_from),
    class4ToPence: pence(year.class4_to),
    class4MainPct: year.class4_main_pct,
    class4UpperPct: year.class4_upper_pct,
  }
}

/**
 * Everything that came in, with the trading profit worked out elsewhere.
 *
 * The profit is the app's to know — every shift's takings less what was spent
 * earning them — and the rest is typed in until a module holds it.
 */
export function incomeOf(year: TaxYearPatch, tradingPence: number): Income {
  return {
    tradingPence,
    employmentPence: pence(year.employment),
    employmentTaxPaidPence: pence(year.employment_tax_paid),
    dividendsPence: pence(year.dividends),
    paidOnAccountPence: pence(year.paid_on_account),
  }
}
