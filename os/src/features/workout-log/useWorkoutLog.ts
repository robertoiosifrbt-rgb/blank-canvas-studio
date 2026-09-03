import { recoverArray } from '../../shared/storage'
import { usePersistedState } from '../../shared/usePersistedState'
import { byRecencyDesc, parseWorkoutEntry, type NewExerciseEntry, type WorkoutEntry } from './types'

const STORAGE_KEY = 'gym-app:workout-log'
const recover = recoverArray(parseWorkoutEntry)

export function useWorkoutLog() {
  const { value: entries, update, error, dismissError } = usePersistedState<WorkoutEntry[]>(STORAGE_KEY, [], recover)

  /** Returns false when storage refused the write, so the form can keep its sets. */
  function addEntry(entry: Omit<WorkoutEntry, 'id' | 'createdAt'>): boolean {
    const newEntry: WorkoutEntry = { ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    return update((prev) => [...prev, newEntry].sort(byRecencyDesc))
  }

  function updateEntry(entryId: string, entry: NewExerciseEntry): boolean {
    return update((prev) => prev.map((existing) => existing.id === entryId ? { ...existing, exerciseId: entry.exerciseId, exerciseName: entry.exerciseName, sets: entry.sets } : existing).sort(byRecencyDesc))
  }

  function deleteEntry(entryId: string): boolean {
    return update((prev) => prev.filter((entry) => entry.id !== entryId))
  }

  function deleteEntriesForSession(sessionId: string): boolean {
    return update((prev) => prev.filter((entry) => entry.sessionId !== sessionId))
  }

  function restoreEntries(restored: WorkoutEntry[]): boolean {
    if (!restored.length) return true
    return update((prev) => {
      const existingIds = new Set(prev.map((entry) => entry.id))
      return [...prev, ...restored.filter((entry) => !existingIds.has(entry.id))].sort(byRecencyDesc)
    })
  }

  /**
   * The most recent log for an exercise. `excludeSessionId` leaves one session
   * out: the runner asks "what did I lift last time", so the sets being typed
   * into the session on screen must not end up answering their own question.
   */
  function getLastEntry(exerciseId: string, excludeSessionId?: string): WorkoutEntry | undefined {
    return entries.filter((e) => e.exerciseId === exerciseId && e.sessionId !== excludeSessionId).sort(byRecencyDesc)[0]
  }

  function backfillSessionIds(sessionIdByDate: Record<string, string>): boolean {
    return update((prev) => prev.map((e) => (e.sessionId ? e : { ...e, sessionId: sessionIdByDate[e.date] ?? e.sessionId })))
  }

  function updateEntriesDate(sessionId: string, date: string): boolean {
    return update((prev) => prev.map((e) => (e.sessionId === sessionId ? { ...e, date } : e)).sort(byRecencyDesc))
  }

  return { entries, addEntry, updateEntry, deleteEntry, deleteEntriesForSession, restoreEntries, getLastEntry, backfillSessionIds, updateEntriesDate, error, dismissError }
}
