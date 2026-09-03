import { recoverArray } from '../../shared/storage'
import { parseMuscles } from '../../shared/muscles'
import { usePersistedState } from '../../shared/usePersistedState'
import { parseExercise, type Exercise, type ExerciseDetails } from './types'

const STORAGE_KEY = 'gym-app:exercises'
const recover = recoverArray(parseExercise)

function withMuscleIds(details: ExerciseDetails) {
  return {
    ...details,
    primaryMuscleIds: parseMuscles(details.primaryMuscles),
    secondaryMuscleIds: parseMuscles(details.secondaryMuscles),
  }
}

export function useExercises() {
  const { value: exercises, update, error, dismissError } = usePersistedState<Exercise[]>(STORAGE_KEY, [], recover)

  function addExercise(name: string, fields: string[], details: ExerciseDetails): boolean {
    const exercise: Exercise = { id: crypto.randomUUID(), name, fields, ...withMuscleIds(details) }
    return update((prev) => [...prev, exercise])
  }

  function updateExercise(id: string, name: string, fields: string[], details: ExerciseDetails): boolean {
    return update((prev) => prev.map((e) => (e.id === id ? { ...e, name, fields, ...withMuscleIds(details) } : e)))
  }

  function deleteExercise(id: string): boolean {
    return update((prev) => prev.filter((e) => e.id !== id))
  }

  /*
   * `favourite: undefined` rather than `false` when unstarring, so an exercise
   * that was never starred and one that was starred and unstarred are stored
   * the same way. `update` refuses and reports if the write fails, and the
   * caller keeps the old state — a star that silently did not save would be
   * worse than one that visibly did not move.
   */
  function toggleFavourite(id: string): boolean {
    return update((prev) =>
      prev.map((e) => (e.id === id ? { ...e, favourite: e.favourite ? undefined : true } : e)),
    )
  }

  /*
   * Attaches one track to one exercise and touches nothing else on it. The
   * runner uses this: an exercise with no tracks cannot be logged, and being
   * sent to the library mid-set to fix that is the whole complaint.
   */
  function addFieldToExercise(exerciseId: string, fieldId: string): boolean {
    return update((prev) =>
      prev.map((e) => (e.id === exerciseId && !e.fields.includes(fieldId) ? { ...e, fields: [...e.fields, fieldId] } : e)),
    )
  }

  function removeFieldFromExercises(fieldId: string): boolean {
    return update((prev) => prev.map((exercise) => ({ ...exercise, fields: exercise.fields.filter((id) => id !== fieldId) })))
  }

  return { exercises, addExercise, updateExercise, deleteExercise, toggleFavourite, addFieldToExercise, removeFieldFromExercises, error, dismissError }
}
