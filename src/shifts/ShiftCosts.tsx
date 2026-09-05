import { useState } from 'react'

import type { RunningCosts } from '../repository/items'

type Props = {
  /** What a kilometre costs in this shift's area, or null if nobody said. */
  costs: RunningCosts | null
  onSave: (fuel_per_km: number, vehicle_per_km: number) => Promise<void>
}

/** A rate per kilometre as typed, or null for an empty box. */
function perKm(typed: string): number | null {
  const trimmed = typed.trim().replace(/^£/, '').replace(',', '.')
  if (trimmed === '') return null
  if (!/^\d+(\.\d{1,4})?$/.test(trimmed)) {
    throw new Error(`That is not an amount per kilometre: ${typed}`)
  }
  return Number(trimmed)
}

/**
 * What the kilometres of a shift cost: fuel, and the vehicle wearing out.
 *
 * It lives with the shift and not on the area's own sheet. There it greeted
 * every area ever created — Health included — by asking what a kilometre costs
 * in it, which is a question only this module has any business asking.
 */
export function ShiftCosts(props: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Both numbers are saved together, because the row holds both: writing one
  // alone would put a zero where the other one was.
  function onRate(typed: string, which: 'fuel' | 'vehicle') {
    let rate: number | null
    try {
      rate = perKm(typed)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      return
    }
    if (rate === null) return
    const held = props.costs
    const fuel = which === 'fuel' ? rate : (held?.fuel_per_km ?? null)
    const vehicle = which === 'vehicle' ? rate : (held?.vehicle_per_km ?? null)
    // Nothing is written until both are known. Half a rate is a cost per
    // kilometre with the other half silently missing, which is the same lie as
    // £0 of tax.
    if (fuel === null || vehicle === null) return
    setBusy(true)
    setError(null)
    void props
      .onSave(fuel, vehicle)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => setBusy(false))
  }

  return (
    <section className="shift-block">
      <h3 className="shift-heading">What a kilometre costs</h3>
      <label className="shift-paid">
        <span className="shift-platform">Fuel £/km</span>
        <input
          className="shift-amount"
          name="fuel"
          inputMode="decimal"
          defaultValue={props.costs === null ? '' : String(props.costs.fuel_per_km)}
          disabled={busy}
          onBlur={(event) => onRate(event.target.value, 'fuel')}
        />
      </label>
      <label className="shift-paid">
        <span className="shift-platform">Vehicle £/km</span>
        <input
          className="shift-amount"
          name="vehicle"
          inputMode="decimal"
          defaultValue={props.costs === null ? '' : String(props.costs.vehicle_per_km)}
          disabled={busy}
          onBlur={(event) => onRate(event.target.value, 'vehicle')}
        />
      </label>
      {error !== null && <p className="shift-error">{error}</p>}
    </section>
  )
}
