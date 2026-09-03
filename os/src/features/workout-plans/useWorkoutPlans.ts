import { recoverArray } from '../../shared/storage'
import { usePersistedState } from '../../shared/usePersistedState'
import { parseWorkoutPlan, type WorkoutPlan } from './types'

export const WORKOUT_PLANS_STORAGE_KEY = 'gym-app:workout-plans'
const recover = recoverArray(parseWorkoutPlan)

export function useWorkoutPlans() {
  const { value: plans, update, error, dismissError } = usePersistedState<WorkoutPlan[]>(WORKOUT_PLANS_STORAGE_KEY, [], recover)

  function addPlan(name: string, exerciseIds: string[]): boolean {
    const trimmed = name.trim()
    if (!trimmed || exerciseIds.length === 0) return false
    const now = new Date().toISOString()
    const plan: WorkoutPlan = {
      id: crypto.randomUUID(),
      name: trimmed,
      exerciseIds: [...exerciseIds],
      createdAt: now,
      updatedAt: now,
    }
    return update((prev) => [...prev, plan])
  }

  function updatePlan(id: string, name: string, exerciseIds: string[]): boolean {
    const trimmed = name.trim()
    if (!trimmed || exerciseIds.length === 0) return false
    return update((prev) => prev.map((plan) => (
      plan.id === id
        ? { ...plan, name: trimmed, exerciseIds: [...exerciseIds], updatedAt: new Date().toISOString() }
        : plan
    )))
  }

  function deletePlan(id: string): boolean {
    return update((prev) => prev.filter((plan) => plan.id !== id))
  }

  return { plans, addPlan, updatePlan, deletePlan, error, dismissError }
}
