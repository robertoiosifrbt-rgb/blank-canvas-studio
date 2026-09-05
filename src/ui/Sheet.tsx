import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

import { FOCUSABLE, nextFocus } from './focus'
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
 *
 * It says aria-modal, so it has to behave like one: the focus goes in when it
 * opens, stays in while it is open, and goes back to whatever opened it when
 * it closes. Without that, Tab walks off into a screen that is covered but
 * still there — which is the sheet lying about what it is, to exactly the
 * people who cannot see it is covered.
 */
export function Sheet({ title, onClose, children }: Props) {
  const sheet = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opened = sheet.current
    if (opened === null) return

    // Whatever had the focus gets it back on the way out. Captured before
    // anything is moved.
    const opener = document.activeElement

    // Not stolen if a child already took it: the capture field focuses its own
    // input as it opens, and writing must not cost an extra gesture.
    if (!opened.contains(document.activeElement)) opened.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const order = [...opened.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const active =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      const target = nextFocus(order, active, event.shiftKey)
      if (target !== null) {
        event.preventDefault()
        target.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Somewhere for the focus to land when the sheet holds nothing that
        // takes it by itself.
        tabIndex={-1}
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
