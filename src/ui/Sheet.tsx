import { useEffect } from 'react'
import type { ReactNode } from 'react'

import './Sheet.css'

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * A sheet that comes up from the bottom of the screen.
 *
 * Reachable with one hand: what you act on sits at the bottom, where the thumb
 * already is. Escape and the backdrop both close it, so it is never a trap.
 */
export function Sheet({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // A click inside must not close it.
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          <button
            className="sheet-close"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
