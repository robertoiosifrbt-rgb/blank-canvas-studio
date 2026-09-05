import { useState } from 'react'

import type { Area, RunningCosts } from '../repository/items'
import { Sheet } from '../ui/Sheet'
import './AreaSheet.css'

type Props = {
  area: Area
  /** How many areas hang under this one, at any depth. */
  under: number
  /** What a kilometre costs in this line of work, or null if nobody said. */
  costs: RunningCosts | null
  onSaveCosts: (fuel_per_km: number, vehicle_per_km: number) => Promise<void>
  onRename: (name: string) => Promise<void>
  onDrop: () => Promise<void>
  onClose: () => void
}

/**
 * One area, open: its name, and the way out of it.
 *
 * The same shape as the item sheet, because it is the same gesture — you
 * tapped a row and it opened. A second pattern for the same movement is a
 * second thing to learn.
 */
function perKm(typed: string): number {
  const trimmed = typed.trim().replace(/^£/, '').replace(',', '.')
  if (!/^\d+(\.\d{1,4})?$/.test(trimmed)) {
    throw new Error(`That is not an amount per kilometre: ${typed}`)
  }
  return Number(trimmed)
}

export function AreaSheet(props: Props) {
  const { area, under, costs, onRename, onDrop, onClose } = props
  const [name, setName] = useState(area.name)
  const [fuel, setFuel] = useState(costs === null ? '' : String(costs.fuel_per_km))
  const [vehicle, setVehicle] = useState(
    costs === null ? '' : String(costs.vehicle_per_km),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = name.trim()
  const changed = trimmed !== '' && trimmed !== area.name

  async function run(body: () => Promise<void>, close: boolean) {
    setBusy(true)
    setError(null)
    try {
      await body()
      if (close) onClose()
    } catch (reason) {
      // The sheet stays open with what you typed still in it. A sheet that
      // closes on a write that did not happen says it saved when it did not.
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Area" onClose={onClose}>
      <label className="area-field">
        <span className="area-label">Name</span>
        <input
          className="area-name"
          name="name"
          value={name}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      {/* The costs of working in this area, and only these: tax and National
          Insurance are yours, not the area's, and live in Put aside. */}
      <h3 className="area-heading">What a kilometre costs here</h3>

      <label className="area-field area-row">
        <span className="area-label">Fuel £/km</span>
        <input
          className="area-number"
          name="fuel"
          inputMode="decimal"
          value={fuel}
          disabled={busy}
          onChange={(event) => setFuel(event.target.value)}
        />
      </label>

      <label className="area-field area-row">
        <span className="area-label">Vehicle £/km</span>
        <input
          className="area-number"
          name="vehicle"
          inputMode="decimal"
          value={vehicle}
          disabled={busy}
          onChange={(event) => setVehicle(event.target.value)}
        />
      </label>

      <button
        type="button"
        name="save-costs"
        className="area-save"
        disabled={busy || fuel.trim() === '' || vehicle.trim() === ''}
        onClick={() =>
          void run(() => props.onSaveCosts(perKm(fuel), perKm(vehicle)), false)
        }
      >
        Save the costs
      </button>

      {error !== null && <p className="area-error">{error}</p>}

      <div className="area-buttons">
        <button
          type="button"
          name="rename"
          className="area-save"
          disabled={busy || !changed}
          onClick={() => void run(() => onRename(trimmed), true)}
        >
          Save the name
        </button>

        <button
          type="button"
          name="drop"
          className="area-drop"
          disabled={busy}
          onClick={() => void run(onDrop, true)}
        >
          Remove this area
        </button>
      </div>

      {/* Said before it happens, not after. What hangs under an area goes out
          of sight with it, and comes back if the area comes back. */}
      {under > 0 && (
        <p className="area-note">
          Removing it hides {under} {under === 1 ? 'area' : 'areas'} under it as
          well. Nothing is destroyed: put this one back and they return.
        </p>
      )}
    </Sheet>
  )
}
