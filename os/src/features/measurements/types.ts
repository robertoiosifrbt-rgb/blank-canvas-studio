import type { Bounds } from '../../shared/numbers'
import { withinBounds } from '../../shared/numbers'
import { isCalendarDate, isNonEmptyString, isRecord } from '../../shared/validate'
import type { ParsedEntry } from '../../shared/storage'

export interface Measurement {
  id: string
  date: string
  weightKg: number
  heightCm?: number
  bodyFatPercent?: number
  neckCm?: number
  chestCm?: number
  waistCm?: number
  hipsCm?: number
  leftArmCm?: number
  rightArmCm?: number
  leftThighCm?: number
  rightThighCm?: number
}

export type NewMeasurement = Omit<Measurement, 'id'>

export type MeasurementNumberField = Exclude<keyof Measurement, 'id' | 'date'>

/**
 * Wide enough for any real person, narrow enough to refuse the impossible.
 * One shared circumference range for neck/chest/waist/hips/arms/thighs is
 * enough — the goal is rejecting negatives and typos, not policing anatomy.
 */
const CIRCUMFERENCE: Bounds = { min: 1, max: 300 }

export const MEASUREMENT_BOUNDS: Record<MeasurementNumberField, Bounds> = {
  heightCm: { min: 30, max: 300 },
  weightKg: { min: 1, max: 700 },
  bodyFatPercent: { min: 0, max: 100 },
  neckCm: CIRCUMFERENCE,
  chestCm: CIRCUMFERENCE,
  waistCm: CIRCUMFERENCE,
  hipsCm: CIRCUMFERENCE,
  leftArmCm: CIRCUMFERENCE,
  rightArmCm: CIRCUMFERENCE,
  leftThighCm: CIRCUMFERENCE,
  rightThighCm: CIRCUMFERENCE,
}

const OPTIONAL_FIELDS: MeasurementNumberField[] = [
  'heightCm',
  'bodyFatPercent',
  'neckCm',
  'chestCm',
  'waistCm',
  'hipsCm',
  'leftArmCm',
  'rightArmCm',
  'leftThighCm',
  'rightThighCm',
]

/**
 * Rebuilds one stored measurement.
 *
 * `id`, `date` and `weightKg` are what make an entry meaningful, so a bad one
 * of those drops the entry. A bad optional value only blanks that value —
 * losing a whole weigh-in because one circumference is corrupt would throw
 * away more of the user's history than it saves.
 */
export function parseMeasurement(entry: unknown): ParsedEntry<Measurement> {
  if (!isRecord(entry)) return null
  if (!isNonEmptyString(entry.id)) return null
  if (!isCalendarDate(entry.date)) return null
  if (!withinBounds(entry.weightKg, MEASUREMENT_BOUNDS.weightKg)) return null

  const measurement: Measurement = { id: entry.id, date: entry.date, weightKg: entry.weightKg }
  let lossy = false
  for (const field of OPTIONAL_FIELDS) {
    const value = entry[field]
    if (value === undefined || value === null) continue
    if (withinBounds(value, MEASUREMENT_BOUNDS[field])) measurement[field] = value
    else lossy = true
  }

  return { value: measurement, lossy }
}
