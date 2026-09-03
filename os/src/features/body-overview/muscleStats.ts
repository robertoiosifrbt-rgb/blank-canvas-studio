import type { Exercise } from '../exercises'
import type { WorkoutEntry } from '../workout-log/types'
import { startOfMonthLocal, startOfWeekLocal } from '../../shared/localDate'
import { MUSCLE_IDS, MUSCLES, parseMuscles, type BodyPart, type MuscleId } from './muscles'

export type Period = 'week' | 'month' | 'all'

export const PERIODS: Array<{ value: Period; label: string }> = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
]

export type MuscleLevel = 'primary' | 'secondary' | 'untargeted' | 'notInvolved'

export const LEVEL_COLORS: Record<MuscleLevel, string> = {
  primary: '#f4564a',
  secondary: '#f5a524',
  untargeted: '#5fc98a',
  notInvolved: '#7fb2e5',
}

export const LEVEL_LABELS: Record<MuscleLevel, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  untargeted: 'Untargeted',
  notInvolved: 'Not Involved',
}

export function shadeForShare(share: number): MuscleLevel {
  if (share >= 0.75) return 'primary'
  if (share >= 0.5) return 'secondary'
  if (share >= 0.25) return 'untargeted'
  return 'notInvolved'
}

export interface MuscleStat {
  id: MuscleId
  label: string
  part: BodyPart
  primarySets: number
  secondarySets: number
  level: MuscleLevel
}

export interface MuscleStats {
  byMuscle: Record<MuscleId, MuscleStat>
  focus: Array<{ part: BodyPart; sets: number }>
  totalSets: number
}

export function periodStart(period: Period, now: Date = new Date()): string {
  if (period === 'week') return startOfWeekLocal(now)
  if (period === 'month') return startOfMonthLocal(now)
  return ''
}

/** Prefer stable IDs stored with the exercise; only old/deleted data falls back to text parsing. */
function musclesFor(entry: WorkoutEntry, exercise: Exercise | undefined) {
  if (exercise) {
    const primary = exercise.primaryMuscleIds ?? parseMuscles(exercise.primaryMuscles)
    const secondary = exercise.secondaryMuscleIds ?? parseMuscles(exercise.secondaryMuscles)
    if (primary.length || secondary.length) return { primary, secondary }
  }
  return { primary: parseMuscles(entry.exerciseName), secondary: [] }
}

export function computeMuscleStats(
  entries: WorkoutEntry[],
  exercises: Exercise[],
  period: Period,
  now: Date = new Date(),
): MuscleStats {
  const from = periodStart(period, now)
  const inPeriod = from ? entries.filter((entry) => entry.date >= from) : entries

  const primarySets: Record<string, number> = {}
  const secondarySets: Record<string, number> = {}

  for (const entry of inPeriod) {
    const exercise = exercises.find((candidate) => candidate.id === entry.exerciseId)
    const { primary, secondary } = musclesFor(entry, exercise)
    const sets = entry.sets.length
    for (const muscle of primary) primarySets[muscle] = (primarySets[muscle] ?? 0) + sets
    for (const muscle of secondary) secondarySets[muscle] = (secondarySets[muscle] ?? 0) + sets
  }

  const workedParts = new Set<BodyPart>()
  for (const id of MUSCLE_IDS) {
    if ((primarySets[id] ?? 0) > 0 || (secondarySets[id] ?? 0) > 0) workedParts.add(MUSCLES[id].part)
  }

  const byMuscle = {} as Record<MuscleId, MuscleStat>
  for (const id of MUSCLE_IDS) {
    const primary = primarySets[id] ?? 0
    const secondary = secondarySets[id] ?? 0
    const level: MuscleLevel = primary > 0
      ? 'primary'
      : secondary > 0
        ? 'secondary'
        : workedParts.has(MUSCLES[id].part)
          ? 'untargeted'
          : 'notInvolved'
    byMuscle[id] = {
      id,
      label: MUSCLES[id].label,
      part: MUSCLES[id].part,
      primarySets: primary,
      secondarySets: secondary,
      level,
    }
  }

  const setsByPart = new Map<BodyPart, number>()
  for (const id of MUSCLE_IDS) {
    const sets = byMuscle[id].primarySets
    if (sets === 0) continue
    const part = MUSCLES[id].part
    setsByPart.set(part, (setsByPart.get(part) ?? 0) + sets)
  }

  const focus = [...setsByPart.entries()]
    .map(([part, sets]) => ({ part, sets }))
    .sort((a, b) => b.sets - a.sets || a.part.localeCompare(b.part))

  return {
    byMuscle,
    focus,
    totalSets: focus.reduce((total, { sets }) => total + sets, 0),
  }
}
