import { useState } from 'react'

import { AMOUNTS, RATES } from '../repository/items'
import type { Figure, TaxYearPatch, TaxYearRow } from '../repository/items'

type Props = {
  year: TaxYearRow | null
  /** The tax year we are in, so an empty form is not also an undated one. */
  label: string
  onSave: (year: TaxYearPatch) => Promise<void>
}

/**
 * The fields, grouped by what they mean.
 *
 * They used to come out of the two lists the parser keeps — every amount, then
 * every rate — which grouped them by what kind of number they are rather than
 * by what they are for. That put "Wages this year", one of the three figures
 * that are actually yours, between the Class 4 upper limit and the basic rate.
 *
 * Yours first, because they are the only ones that change during a year. The
 * rest are HMRC's, the same for everybody, and touched once each April.
 */
const GROUPS: readonly {
  title: string
  note?: string
  fields: readonly Figure[]
}[] = [
  {
    title: 'Your income this year',
    note: 'What the app cannot see yet: there is no module holding a wage or a company.',
    fields: ['employment', 'employment_tax_paid', 'dividends'],
  },
  {
    title: 'Income tax',
    fields: [
      'personal_allowance',
      'taper_from',
      'basic_band',
      'basic_pct',
      'higher_band_to',
      'higher_pct',
      'additional_pct',
    ],
  },
  {
    title: 'Dividends',
    note: 'Their own allowance and their own rates. They pay no National Insurance.',
    fields: [
      'dividend_allowance',
      'dividend_basic_pct',
      'dividend_higher_pct',
      'dividend_additional_pct',
    ],
  },
  {
    title: 'National Insurance, Class 4',
    note: 'Paid on trading profit and on nothing else.',
    fields: ['class4_from', 'class4_to', 'class4_main_pct', 'class4_upper_pct'],
  },
  {
    title: 'Paying it',
    note: 'The balance falls due the January after the year closes, with the first instalment towards the next year on the same day.',
    fields: ['poa_threshold', 'paid_on_account'],
  },
  {
    title: 'National Insurance, Class 2',
    note: 'Not a bill. Below the small profits threshold the year stops counting towards a State Pension unless you volunteer this.',
    fields: ['class2_small_profits', 'class2_year'],
  },
]

/** What each field is, in the words HMRC uses for it. */
const NAMES: Record<string, string> = {
  employment: 'Wages, before tax',
  employment_tax_paid: 'Tax already taken from them',
  dividends: 'Dividends received',
  personal_allowance: 'Personal allowance',
  taper_from: 'Allowance shrinks above',
  basic_band: 'Basic rate band',
  basic_pct: 'Basic rate %',
  higher_band_to: 'Higher rate up to',
  higher_pct: 'Higher rate %',
  additional_pct: 'Additional rate %',
  dividend_allowance: 'Dividend allowance',
  dividend_basic_pct: 'Basic %',
  dividend_higher_pct: 'Higher %',
  dividend_additional_pct: 'Additional %',
  class4_from: 'Starts at',
  class4_to: 'Upper limit',
  poa_threshold: 'Instalments start above',
  paid_on_account: 'Already paid towards this year',
  class2_small_profits: 'Small profits threshold',
  class2_year: 'A full year costs',
  class4_main_pct: 'Main %',
  class4_upper_pct: 'Above the upper limit %',
}

const FIELDS = GROUPS.flatMap((group) => group.fields)

// The groups and the parser must hold the same fields, or the form saves a
// year the parser will refuse to read back. Checked here rather than trusted,
// because the two lists are edited months apart.
const KEYS = [...AMOUNTS, ...RATES]
if (FIELDS.length !== KEYS.length || KEYS.some((key) => !FIELDS.includes(key))) {
  throw new Error('The tax year form and the tax year row hold different fields')
}

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
    void onSave({ tax_year: year?.tax_year ?? label, ...values } as TaxYearPatch)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => setBusy(false))
  }

  return (
    <section className="hmrc-form">
      <h3 className="hmrc-heading">{year?.tax_year ?? label}</h3>
      <p className="hmrc-note">
        The rates come off the HMRC page for this year. Nothing is guessed for
        you: one that is out of date costs money without saying so.
      </p>

      {GROUPS.map((group) => (
        <section key={group.title} className="hmrc-group">
          <h4 className="hmrc-group-title">{group.title}</h4>
          {group.note !== undefined && <p className="hmrc-note">{group.note}</p>}
          {group.fields.map((key) => (
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
        </section>
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
