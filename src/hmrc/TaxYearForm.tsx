import { useState } from 'react'

import { AMOUNTS, RATES } from '../repository/items'
import type { TaxYearSettings } from '../repository/items'

type Props = {
  year: TaxYearSettings | null
  /** The tax year we are in, so an empty form is not also an undated one. */
  label: string
  onSave: (year: TaxYearSettings) => Promise<void>
}

/** What each field is, in the words HMRC uses for it. */
const NAMES: Record<string, string> = {
  personal_allowance: 'Personal allowance',
  taper_from: 'Allowance shrinks above',
  basic_band: 'Basic rate band',
  higher_band_to: 'Higher rate up to',
  dividend_allowance: 'Dividend allowance',
  class4_from: 'Class 4 starts at',
  class4_to: 'Class 4 upper limit',
  employment: 'Wages this year',
  employment_tax_paid: 'Tax already taken from wages',
  dividends: 'Dividends this year',
  basic_pct: 'Basic rate %',
  higher_pct: 'Higher rate %',
  additional_pct: 'Additional rate %',
  dividend_basic_pct: 'Dividend basic %',
  dividend_higher_pct: 'Dividend higher %',
  dividend_additional_pct: 'Dividend additional %',
  class4_main_pct: 'Class 4 main %',
  class4_upper_pct: 'Class 4 upper %',
}

const FIELDS = [...AMOUNTS, ...RATES]

function amount(typed: string): number {
  const trimmed = typed.trim().replace(/^£/, '').replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`That is not an amount: ${typed}`)
  }
  return Number(trimmed)
}

/**
 * The year's figures, typed in once.
 *
 * Nothing is filled in for you. Allowances and rates change every April, and a
 * default sitting in the code would go quietly wrong on the sixth — wrong in
 * the direction of reserving too little, and silent about it. These come off
 * the HMRC page, in the owner's own hand.
 *
 * Saved all together. A bill worked out from half of them is a number that
 * looks like an answer.
 */
export function TaxYearForm({ year, label, onSave }: Props) {
  const [typed, setTyped] = useState<Record<string, string>>(() => {
    const start: Record<string, string> = {}
    for (const key of FIELDS) start[key] = year === null ? '' : String(year[key])
    return start
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready = FIELDS.every((key) => typed[key]?.trim() !== '')

  function save() {
    let values: Record<string, number>
    try {
      values = {}
      for (const key of FIELDS) values[key] = amount(typed[key] ?? '')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      return
    }
    setBusy(true)
    setError(null)
    void onSave({ tax_year: year?.tax_year ?? label, ...values } as TaxYearSettings)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => setBusy(false))
  }

  return (
    <section className="hmrc-form">
      <h3 className="hmrc-heading">The figures for {year?.tax_year ?? label}</h3>
      <p className="hmrc-note">
        From the HMRC page for this year. Nothing is guessed for you: a rate
        that is out of date costs money without saying so.
      </p>

      {FIELDS.map((key) => (
        <label key={key} className="hmrc-field">
          <span className="hmrc-label">{NAMES[key]}</span>
          <input
            className="hmrc-number"
            name={key}
            inputMode="decimal"
            value={typed[key] ?? ''}
            disabled={busy}
            onChange={(event) =>
              setTyped((was) => ({ ...was, [key]: event.target.value }))
            }
          />
        </label>
      ))}

      {error !== null && <p className="hmrc-error">{error}</p>}

      <button
        type="button"
        name="save-year"
        className="hmrc-save"
        disabled={busy || !ready}
        onClick={save}
      >
        Save the year
      </button>
    </section>
  )
}
