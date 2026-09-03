import { useState, useRef } from 'react'
import { todayLocal } from '../../shared/localDate'
import { isCalendarDate } from '../../shared/validate'
import { PHOTO_ANGLES, type PhotoAngle } from './types'
import { resizeImage } from './resizeImage'

interface PhotoUploadFormProps {
  /**
   * Resolves to false when the photos could not be saved. Must be a promise:
   * the selection is only cleared once the save has actually completed.
   */
  onAdd: (date: string, photos: Record<PhotoAngle, Blob>) => Promise<boolean>
}

const angleLabels: Record<PhotoAngle, string> = {
  front: 'Front',
  back: 'Back',
  left: 'Left',
  right: 'Right',
}

type Photos = Partial<Record<PhotoAngle, Blob>>

const emptyPhotos: Photos = {}

export function PhotoUploadForm({ onAdd }: PhotoUploadFormProps) {
  const [date, setDate] = useState(todayLocal())
  const [photos, setPhotos] = useState<Photos>(emptyPhotos)
  // Per-angle rather than a single value: four pictures can be picked in quick
  // succession and each resize finishes on its own schedule, so one shared
  // flag showed "processing…" against the wrong angle (and got stuck when two
  // overlapped).
  const [processing, setProcessing] = useState<Partial<Record<PhotoAngle, boolean>>>({})
  const [angleErrors, setAngleErrors] = useState<Partial<Record<PhotoAngle, string>>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Per-angle request ID: prevents older async results from overwriting newer selections.
  // When a photo is selected, a unique ID is assigned. Only the most recent ID for an
  // angle is allowed to commit its result to state.
  const requestIds = useRef<Partial<Record<PhotoAngle, string>>>({})
  let idCounter = useRef(0)

  const allPhotosSelected = PHOTO_ANGLES.every((angle) => photos[angle])
  const anyProcessing = PHOTO_ANGLES.some((angle) => processing[angle])

  function setProcessingFor(angle: PhotoAngle, value: boolean) {
    setProcessing((prev) => {
      const next = { ...prev }
      if (value) next[angle] = true
      else delete next[angle]
      return next
    })
  }

  function setAngleError(angle: PhotoAngle, message: string | null) {
    setAngleErrors((prev) => {
      const next = { ...prev }
      if (message) next[angle] = message
      else delete next[angle]
      return next
    })
  }

  function clearPhoto(angle: PhotoAngle) {
    setPhotos((prev) => {
      const next = { ...prev }
      delete next[angle]
      return next
    })
  }

  async function handleFileChange(angle: PhotoAngle, file: File | null) {
    setAngleError(angle, null)
    if (!file) {
      clearPhoto(angle)
      return
    }

    const requestId = `${angle}-${++idCounter.current}`
    requestIds.current[angle] = requestId

    setProcessingFor(angle, true)
    try {
      const resized = await resizeImage(file)
      // Only commit if this is still the most recent request for this angle.
      // Prevents a race where rapid selections process in parallel and the
      // older result overwrites the newer one.
      if (requestIds.current[angle] === requestId) {
        setPhotos((prev) => ({ ...prev, [angle]: resized }))
      }
    } catch (err) {
      // Only handle error for this request if it's still the current one.
      // A newer request may have been selected while this was processing, and
      // we must not clear a valid photo from the newer selection.
      if (requestIds.current[angle] === requestId) {
        // One unreadable or unsupported image must not take the other three with
        // it, and the message has to name the angle that failed.
        const reason = err instanceof Error && err.message ? err.message : String(err)
        setAngleError(angle, `Could not process this image (${reason}). Try another one.`)
        clearPhoto(angle)
      }
    } finally {
      // Only update processing state if this is still the current request.
      // Prevents the label from showing "processing…" for the current request
      // while an older request's finally block clears it.
      if (requestIds.current[angle] === requestId) {
        setProcessingFor(angle, false)
      }
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!allPhotosSelected || saving || anyProcessing) return

    if (!isCalendarDate(date)) {
      setError('Pick a valid date.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const saved = await onAdd(date, photos as Record<PhotoAngle, Blob>)
      // Only now is it safe to clear: the photos are in IndexedDB. Clearing
      // before this point meant a refused write silently lost the selection.
      if (saved) setPhotos(emptyPhotos)
      else setError('Not saved — see the message above. Your photos are still selected below.')
    } catch (err) {
      const reason = err instanceof Error && err.message ? err.message : String(err)
      setError(`Not saved (${reason}). Your photos are still selected below.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="photo-date">Date</label>
        <input
          id="photo-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      {PHOTO_ANGLES.map((angle) => (
        <div className="field" key={angle}>
          <label htmlFor={`photo-${angle}`}>
            {angleLabels[angle]}
            {photos[angle] && ' ✓'}
            {processing[angle] && ' (processing…)'}
          </label>
          <input
            id={`photo-${angle}`}
            type="file"
            accept="image/*"
            disabled={saving}
            onChange={(e) => handleFileChange(angle, e.target.files?.[0] ?? null)}
          />
          {angleErrors[angle] && (
            <p className="form-error" role="alert">
              {angleErrors[angle]}
            </p>
          )}
        </div>
      ))}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={!allPhotosSelected || saving || anyProcessing}>
        {saving ? 'Saving…' : 'Add photos'}
      </button>
    </form>
  )
}
