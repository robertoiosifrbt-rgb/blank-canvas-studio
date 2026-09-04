import { useState } from 'react'
import type { FormEvent } from 'react'

import { Sheet } from '../ui/Sheet'
import './CaptureSheet.css'

type Props = {
  onSave: (title: string) => Promise<void>
  onClose: () => void
}

/**
 * Capture: you write one line and save. No date, no questions.
 *
 * The input is focused as it opens and Enter saves, so writing costs one
 * gesture. If it took longer, you would not write.
 */
export function CaptureSheet({ onSave, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (title.trim() === '') return
    setSaving(true)
    setError(null)
    try {
      await onSave(title)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      setSaving(false)
    }
  }

  return (
    <Sheet title="Write a line" onClose={onClose}>
      <form className="capture" onSubmit={(event) => void submit(event)}>
        <input
          className="capture-input"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="call X"
          autoComplete="off"
          autoFocus
          required
        />
        {error !== null && (
          <p className="capture-error" role="alert">
            {error}
          </p>
        )}
        <button className="capture-save" type="submit" name="save" disabled={saving}>
          Save
        </button>
      </form>
    </Sheet>
  )
}
