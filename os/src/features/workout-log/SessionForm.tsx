import { useState } from 'react'
import { todayLocal } from '../../shared/localDate'
import { isCalendarDate } from '../../shared/validate'
import type { WorkoutSession } from './types'
import { describeDuration, formatDurationInput, formatDurationValue, parseDuration } from './duration'

interface SessionFormProps {
  initial?: WorkoutSession
  /** durationSeconds is provided only when the user explicitly edits the duration. */
  onSubmit: (date: string, name: string, durationSeconds?: number) => boolean
  onCancel: () => void
}

function initialDuration(session?: WorkoutSession) {
  if (!session?.createdAt || !session.endedAt) return ''
  const start = new Date(session.createdAt).getTime()
  const end = new Date(session.endedAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return ''
  return formatDurationValue(Math.floor((end - start) / 1000))
}

export function SessionForm({ initial, onSubmit, onCancel }: SessionFormProps) {
  const [date, setDate] = useState(initial?.date ?? todayLocal())
  const [name, setName] = useState(initial?.name ?? '')
  const [duration, setDuration] = useState(initialDuration(initial))
  const [error, setError] = useState<string | null>(null)

  /*
   * Ce a înțeles câmpul din cifrele de până acum, în cuvinte. Cu separatoarele
   * puse automat, `01:10:23` poate fi citit greșit la o privire rapidă; „1h 10m
   * 23s" nu poate. Se vede în timp ce tastezi, nu abia după ce salvezi.
   */
  const parsedDuration = parseDuration(duration)
  const durationPreview = duration.trim() && parsedDuration !== null ? describeDuration(parsedDuration) : ''

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!isCalendarDate(date)) {
      setError('Pick a valid date.')
      return
    }
    let durationSeconds: number | undefined
    if (initial && duration.trim()) {
      const parsed = parseDuration(duration)
      if (parsed === null) {
        setError('Enter the duration as digits, e.g. 11023 for 1h 10m 23s.')
        return
      }
      durationSeconds = parsed
    }
    if (!onSubmit(date, name.trim(), durationSeconds)) {
      setError('Could not save — see the message above. What you typed is still here.')
      return
    }
    setError(null)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="session-date">Date</label>
        <input id="session-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="session-name">Name (optional)</label>
        <input id="session-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push Day" />
      </div>
      {initial && <div className="field">
        <label htmlFor="session-duration">Workout duration</label>
        {/*
          * Separatoarele le pune câmpul, nu tastatura: `inputMode="numeric"`
          * deschide pe iOS un keypad fără două puncte, deci formatul cerut
          * înainte era imposibil de tastat pe telefon.
          */}
        <input
          id="session-duration"
          inputMode="numeric"
          value={duration}
          onChange={(e) => setDuration(formatDurationInput(e.target.value))}
          placeholder="01:08:24"
          aria-describedby="session-duration-help"
        />
        <small id="session-duration-help">
          {durationPreview
            ? `${durationPreview} — type the digits, the colons appear on their own.`
            : 'Type the digits — 11023 becomes 1:10:23. Leave empty to clear.'}
        </small>
      </div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit">{initial ? 'Save changes' : 'Start session'}</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </form>
  )
}
