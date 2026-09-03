import type { ParsedEntry } from '../../shared/storage'
import { isNonEmptyString, isRecord } from '../../shared/validate'

export interface WorkoutPlan {
  id: string
  name: string
  exerciseIds: string[]
  createdAt: string
  updatedAt: string
}

export function parseWorkoutPlan(entry: unknown): ParsedEntry<WorkoutPlan> {
  if (!isRecord(entry)) return null
  if (!isNonEmptyString(entry.id) || !isNonEmptyString(entry.name)) return null
  if (!Array.isArray(entry.exerciseIds)) return null

  const exerciseIds = entry.exerciseIds.filter(isNonEmptyString)
  if (exerciseIds.length === 0) return null

  const createdAt = isNonEmptyString(entry.createdAt) ? entry.createdAt : new Date(0).toISOString()
  const updatedAt = isNonEmptyString(entry.updatedAt) ? entry.updatedAt : createdAt

  return {
    value: {
      id: entry.id,
      name: entry.name.trim(),
      exerciseIds,
      createdAt,
      updatedAt,
    },
    lossy: exerciseIds.length !== entry.exerciseIds.length || !isNonEmptyString(entry.createdAt) || !isNonEmptyString(entry.updatedAt),
  }
}
