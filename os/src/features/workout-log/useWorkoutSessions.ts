import { recoverArray } from '../../shared/storage'
import { usePersistedState } from '../../shared/usePersistedState'
import { bySessionRecencyDesc, parseWorkoutSession, type NewWorkoutSession, type WorkoutSession } from './types'

const STORAGE_KEY = 'gym-app:workout-sessions'
const recover = recoverArray(parseWorkoutSession)

export function useWorkoutSessions() {
  const { value: sessions, update, error, dismissError } = usePersistedState<WorkoutSession[]>(STORAGE_KEY, [], recover)

  function addSession(session: NewWorkoutSession): WorkoutSession | null {
    const newSession: WorkoutSession = { ...session, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    return update((prev) => [...prev, newSession].sort(bySessionRecencyDesc)) ? newSession : null
  }

  function updateSession(id: string, date: string, name: string, durationSeconds?: number): boolean {
    return update((prev) => prev.map((s) => {
      if (s.id !== id) return s
      if (durationSeconds === undefined) return { ...s, date, name }
      const startMs = s.createdAt ? new Date(s.createdAt).getTime() : Number.NaN
      const fallbackStart = new Date(`${date}T12:00:00`).getTime()
      const base = Number.isFinite(startMs) ? startMs : fallbackStart
      const createdAt = Number.isFinite(startMs) ? s.createdAt : new Date(base).toISOString()
      return { ...s, date, name, createdAt, endedAt: new Date(base + durationSeconds * 1000).toISOString() }
    }).sort(bySessionRecencyDesc))
  }

  function finishSession(id: string): boolean {
    const endedAt = new Date().toISOString()
    return update((prev) => prev.map((s) => (s.id === id && !s.endedAt ? { ...s, endedAt } : s)).sort(bySessionRecencyDesc))
  }

  /** Replaces the runner's exercise queue. Order is the order you train in. */
  function setSessionPlan(id: string, plannedExerciseIds: string[]): boolean {
    return update((prev) => prev.map((s) => (s.id === id ? { ...s, plannedExerciseIds } : s)))
  }

  function deleteSession(id: string): boolean {
    return update((prev) => prev.filter((session) => session.id !== id))
  }

  /**
   * Puts a session back exactly as it was, for undoing a half-applied edit.
   *
   * `updateSession` cannot do this: called without `durationSeconds` it leaves
   * `createdAt` and `endedAt` alone, so a revert after a duration change would
   * restore the date and the name and keep the new duration.
   */
  function restoreSession(original: WorkoutSession): boolean {
    return update((prev) => prev.map((s) => (s.id === original.id ? original : s)).sort(bySessionRecencyDesc))
  }

  return { sessions, addSession, updateSession, restoreSession, setSessionPlan, finishSession, deleteSession, error, dismissError }
}
