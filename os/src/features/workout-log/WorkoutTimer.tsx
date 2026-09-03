import { useEffect, useRef, useState } from 'react'
import { todayLocal } from '../../shared/localDate'
import { formatClock } from '../../shared/formatClock'

interface WorkoutTimerProps {
  startedAt?: string
  endedAt?: string
  sessionDate: string
  onFinish?: () => void
}

export function WorkoutTimer({ startedAt, endedAt, sessionDate, onFinish }: WorkoutTimerProps) {
  const [now, setNow] = useState(() => Date.now())
  const intervalRef = useRef<number | null>(null)
  const isHistoricalWithoutEnd = Boolean(startedAt && !endedAt && sessionDate !== todayLocal())

  useEffect(() => {
    if (endedAt && intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [endedAt])

  useEffect(() => {
    if (endedAt || !startedAt || isHistoricalWithoutEnd) return
    if (intervalRef.current) window.clearInterval(intervalRef.current)
    intervalRef.current = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [startedAt, endedAt, isHistoricalWithoutEnd])

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [])

  if (!startedAt) return null

  if (isHistoricalWithoutEnd) {
    return <section className="workout-timer is-finished" aria-label="Workout timer">
      <div className="workout-timer-copy">
        <span>Workout duration</span>
        <strong>—</strong>
        <small>Edit session to set the duration.</small>
      </div>
    </section>
  }

  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : now
  const seconds = Number.isFinite(start) && Number.isFinite(end) ? Math.floor(Math.max(0, end - start) / 1000) : 0

  return <section className={`workout-timer ${endedAt ? 'is-finished' : 'is-running'}`} aria-label="Workout timer">
    <div className="workout-timer-copy">
      <span>{endedAt ? 'Workout duration' : 'Session time'}</span>
      <strong aria-live="polite">{formatClock(seconds)}</strong>
    </div>
    {!endedAt && onFinish && <div className="workout-timer-controls">
      <button type="button" className="workout-timer-main" onClick={onFinish}>Finish session</button>
    </div>}
  </section>
}
