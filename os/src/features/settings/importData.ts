import { recoverArray, type ParsedEntry } from '../../shared/storage'
import { UNIT_SYSTEMS, type UnitSystem } from '../../shared/units'
import { asString, isRecord } from '../../shared/validate'
import { parseExercise, parseFieldType } from '../exercises/types'
import { parseMeasurement } from '../measurements/types'
import { parseWorkoutEntry, parseWorkoutSession } from '../workout-log/types'
import { parseWorkoutPlan } from '../workout-plans'
import { parseSerializedPhotoSets, type SerializedPhotoSet } from './backupPhotos'

/*
 * Citirea unui fișier scos de „Export data".
 *
 * Fișierul e la fel de nesigur ca `localStorage`: poate fi editat de mână, poate
 * veni de la o versiune mai veche, poate fi cu totul altceva. Trece deci prin
 * **aceleași** funcții de parsare ca datele salvate — dacă o intrare n-ar fi
 * acceptată la citirea din storage, nu are ce căuta nici aici.
 */

interface ImportSection {
  field: string
  storageKey: string
  label: string
  parse: (entry: unknown) => ParsedEntry<unknown>
}

export const IMPORT_SECTIONS: ImportSection[] = [
  { field: 'exercises', storageKey: 'gym-app:exercises', label: 'exercises', parse: parseExercise },
  { field: 'fieldTypes', storageKey: 'gym-app:field-types', label: 'tracks', parse: parseFieldType },
  { field: 'sessions', storageKey: 'gym-app:workout-sessions', label: 'workout sessions', parse: parseWorkoutSession },
  { field: 'entries', storageKey: 'gym-app:workout-log', label: 'logged exercises', parse: parseWorkoutEntry },
  { field: 'workoutPlans', storageKey: 'gym-app:workout-plans', label: 'workout routines', parse: parseWorkoutPlan },
  { field: 'measurements', storageKey: 'gym-app:measurements', label: 'measurements', parse: parseMeasurement },
]

export interface ImportedSection {
  field: string
  storageKey: string
  label: string
  value: unknown[]
  dropped: number
}

export interface ImportedProfile {
  name: string
  avatar?: string
}

export interface ImportExtras {
  /** Undefined means an older backup did not contain this setting; preserve the device value. */
  profile?: ImportedProfile
  units?: UnitSystem
  /** Undefined means an older backup did not contain photos; preserve the device photos. */
  progressPhotos?: SerializedPhotoSet[]
  progressPhotosDropped: number
}

export type ImportResult =
  | { ok: true; sections: ImportedSection[]; extras: ImportExtras; exportedAt: string | null }
  | { ok: false; error: string }

export function totalEntries(sections: ImportedSection[]): number {
  return sections.reduce((sum, section) => sum + section.value.length, 0)
}

export function totalDropped(sections: ImportedSection[]): number {
  return sections.reduce((sum, section) => sum + section.dropped, 0)
}

export function describeSections(sections: ImportedSection[]): string {
  const parts = sections.filter((section) => section.value.length > 0).map((section) => `${section.value.length} ${section.label}`)
  return parts.length ? parts.join(', ') : 'nothing'
}

function readProfile(value: unknown): ImportedProfile | null {
  if (!isRecord(value)) return null
  const name = asString(value.name)
  const avatar = asString(value.avatar)
  if (avatar && !avatar.startsWith('data:image/')) return null
  return { name, ...(avatar ? { avatar } : {}) }
}

function sectionByField(sections: ImportedSection[], field: string): ImportedSection | undefined {
  return sections.find((section) => section.field === field)
}

function idOf(value: unknown): string {
  return isRecord(value) ? asString(value.id) : ''
}

function duplicateIdError(sections: ImportedSection[]): string | null {
  for (const section of sections) {
    const seen = new Set<string>()
    for (const value of section.value) {
      const id = idOf(value)
      if (!id) continue
      if (seen.has(id)) return `That backup contains duplicate IDs in ${section.label} (${id}). Nothing was imported.`
      seen.add(id)
    }
  }
  return null
}

function referenceError(sections: ImportedSection[]): string | null {
  const exercises = sectionByField(sections, 'exercises')
  const sessions = sectionByField(sections, 'sessions')
  const entries = sectionByField(sections, 'entries')
  const workoutPlans = sectionByField(sections, 'workoutPlans')

  // Partial backups may intentionally omit the referenced section, in which
  // case the referenced object can already exist on this device. Validate a
  // relationship only when both sides are actually supplied by the file.
  const exerciseIds = exercises ? new Set(exercises.value.map(idOf).filter(Boolean)) : null
  const sessionIds = sessions ? new Set(sessions.value.map(idOf).filter(Boolean)) : null

  if (entries) {
    for (const value of entries.value) {
      if (!isRecord(value)) continue
      const entryId = asString(value.id) || 'unknown entry'
      const exerciseId = asString(value.exerciseId)
      const sessionId = asString(value.sessionId)

      if (exerciseIds && !exerciseIds.has(exerciseId)) {
        return `That backup has a logged exercise (${entryId}) linked to a missing exercise (${exerciseId}). Nothing was imported.`
      }
      // Empty sessionId is tolerated for legacy logs; the app migrates those by date.
      if (sessionIds && sessionId && !sessionIds.has(sessionId)) {
        return `That backup has a logged exercise (${entryId}) linked to a missing workout session (${sessionId}). Nothing was imported.`
      }
    }
  }

  if (sessions && exerciseIds) {
    for (const value of sessions.value) {
      if (!isRecord(value) || !Array.isArray(value.plannedExerciseIds)) continue
      const sessionId = asString(value.id) || 'unknown session'
      for (const exerciseId of value.plannedExerciseIds) {
        if (typeof exerciseId === 'string' && !exerciseIds.has(exerciseId)) {
          return `That backup has a workout session (${sessionId}) planned with a missing exercise (${exerciseId}). Nothing was imported.`
        }
      }
    }
  }

  if (workoutPlans && exerciseIds) {
    for (const value of workoutPlans.value) {
      if (!isRecord(value) || !Array.isArray(value.exerciseIds)) continue
      const planId = asString(value.id) || 'unknown routine'
      for (const exerciseId of value.exerciseIds) {
        if (typeof exerciseId === 'string' && !exerciseIds.has(exerciseId)) {
          return `That backup has a workout routine (${planId}) linked to a missing exercise (${exerciseId}). Nothing was imported.`
        }
      }
    }
  }

  return null
}

export function readBackup(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not readable JSON. Pick a file made by “Export data”.' }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'That file does not look like a GYM APP backup.' }
  }

  const record = parsed as Record<string, unknown>
  if (!IMPORT_SECTIONS.some(({ field }) => field in record)) {
    return { ok: false, error: 'That file does not look like a GYM APP backup.' }
  }

  // Missing core sections mean "preserve what is already on this device".
  // Only sections explicitly present in the file are returned for writing.
  // This keeps old/partial backups from silently replacing unrelated data with [].
  const sections = IMPORT_SECTIONS.flatMap(({ field, storageKey, label, parse }) => {
    if (!(field in record)) return []
    const { value, dropped } = recoverArray(parse)(record[field])
    return [{ field, storageKey, label, value: value as unknown[], dropped }]
  })

  const duplicateError = duplicateIdError(sections)
  if (duplicateError) return { ok: false, error: duplicateError }

  const brokenReference = referenceError(sections)
  if (brokenReference) return { ok: false, error: brokenReference }

  const extras: ImportExtras = { progressPhotosDropped: 0 }

  if ('profile' in record) {
    const profile = readProfile(record.profile)
    if (!profile) return { ok: false, error: 'The profile in that backup is unreadable.' }
    extras.profile = profile
  }

  if ('units' in record) {
    if (!UNIT_SYSTEMS.includes(record.units as UnitSystem)) {
      return { ok: false, error: 'The unit preference in that backup is unreadable.' }
    }
    extras.units = record.units as UnitSystem
  }

  if ('progressPhotos' in record) {
    const photos = parseSerializedPhotoSets(record.progressPhotos)
    extras.progressPhotos = photos.value
    extras.progressPhotosDropped = photos.dropped
  }

  const exportedAt = typeof record.exportedAt === 'string' ? record.exportedAt : null
  return { ok: true, sections, extras, exportedAt }
}
