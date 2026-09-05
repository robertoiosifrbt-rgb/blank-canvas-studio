import { useState } from 'react'
import { Link } from 'react-router-dom'

import type { Reserves } from '../repository/items'
import { Sheet } from '../ui/Sheet'
import './ReservesSheet.css'

type Props = {
  reserves: Reserves | null
  onSave: (tax_pct: number, ni_pct: number) => Promise<void>
  onClose: () => void
}

function percentOf(typed: string): number {
  const trimmed = typed.trim().replace(/%$/, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`That is not a percentage: ${typed}`)
  }
  return Number(trimmed)
}

/**
 * Tax and National Insurance, once, for the person.
 *
 * Not per line of work, and the sheet says why: there is one HMRC, one
 * allowance and one bill. Two percentages for two gigs would add up to a
 * number that means nothing the moment they differ.
 */
export function ReservesSheet({ reserves, onSave, onClose }: Props) {
  const [tax, setTax] = useState(reserves === null ? '' : String(reserves.tax_pct))
  const [ni, setNi] = useState(reserves === null ? '' : String(reserves.ni_pct))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await onSave(percentOf(tax), percentOf(ni))
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="What you put aside" onClose={onClose}>
      <p className="reserve-note">
        Taken off what a day leaves after its costs, not off what it took. One
        set for everything you earn: you have one HMRC and one bill, so a
        percentage per line of work would add up to nothing meaningful.
      </p>

      <label className="reserve-field">
        <span className="reserve-label">Tax %</span>
        <input
          className="reserve-input"
          name="tax"
          inputMode="decimal"
          value={tax}
          disabled={busy}
          onChange={(event) => setTax(event.target.value)}
        />
      </label>

      <label className="reserve-field">
        <span className="reserve-label">National Insurance %</span>
        <input
          className="reserve-input"
          name="ni"
          inputMode="decimal"
          value={ni}
          disabled={busy}
          onChange={(event) => setNi(event.target.value)}
        />
      </label>

      {error !== null && <p className="reserve-error">{error}</p>}

      <button
        type="button"
        name="save"
        className="reserve-save"
        disabled={busy || tax.trim() === '' || ni.trim() === ''}
        onClick={() => void save()}
      >
        Save
      </button>

      {/* Said plainly, because the number will look like a tax bill and is
          not one: a flat percentage knows nothing about an allowance, a band,
          or a dividend. The bill that does is one tap away, so this says where
          rather than sending anybody to find an accountant. */}
      <p className="reserve-warning">
        These are estimates for putting money aside, day by day. A flat
        percentage reserves too much early in the tax year and too little late.
      </p>
      <Link className="reserve-bill" to="/hmrc" onClick={onClose}>
        What the year actually owes
      </Link>
    </Sheet>
  )
}
