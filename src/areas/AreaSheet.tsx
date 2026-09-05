import { useState } from 'react'

import type { Area } from '../repository/items'
import { Sheet } from '../ui/Sheet'
import './AreaSheet.css'

type Props = {
  area: Area
  /** How many areas hang under this one, at any depth. */
  under: number
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
export function AreaSheet({ area, under, onRename, onDrop, onClose }: Props) {
  const [name, setName] = useState(area.name)
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
