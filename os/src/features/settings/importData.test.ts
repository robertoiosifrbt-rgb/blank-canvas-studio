import { describe, expect, it } from 'vitest'
import { describeSections, readBackup, totalDropped, totalEntries } from './importData'

const measurement = { id: 'm1', date: '2026-07-15', weightKg: 82.4 }
const exercise = { id: 'e1', name: 'Bench Press', fields: ['reps', 'kg'] }
const session = { id: 's1', date: '2026-07-15', name: 'Push' }
const entry = {
  id: 'log1',
  sessionId: session.id,
  date: session.date,
  exerciseId: exercise.id,
  exerciseName: exercise.name,
  sets: [{ reps: 8, kg: 60 }],
}

function backup(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: '1.0',
    exportedAt: '2026-08-12T10:00:00.000Z',
    exercises: [exercise],
    fieldTypes: [],
    sessions: [],
    entries: [],
    measurements: [measurement],
    ...extra,
  })
}

function ok(text: string) {
  const result = readBackup(text)
  if (!result.ok) throw new Error(`expected a readable backup, got: ${result.error}`)
  return result
}

describe('readBackup', () => {
  it('reads what an export wrote', () => {
    const result = ok(backup())

    expect(totalEntries(result.sections)).toBe(2)
    expect(result.exportedAt).toBe('2026-08-12T10:00:00.000Z')
    expect(describeSections(result.sections)).toBe('1 exercises, 1 measurements')
  })

  it('refuses a file that is not JSON', () => {
    expect(readBackup('not json at all')).toEqual({
      ok: false,
      error: 'That file is not readable JSON. Pick a file made by “Export data”.',
    })
  })

  /*
   * Fără verificarea asta, „importul" unui JSON oarecare ar reuși scriind
   * liste goale peste tot — adică ar șterge tot, raportând succes.
   */
  it('refuses a JSON file with none of the known sections', () => {
    expect(readBackup('{"todos":[]}').ok).toBe(false)
    expect(readBackup('[1,2,3]').ok).toBe(false)
    expect(readBackup('"just a string"').ok).toBe(false)
  })

  /**
   * Un export mai vechi/parțial poate să nu aibă toate cheile de azi.
   * Cheile lipsă NU trebuie scrise ca liste goale peste datele dispozitivului.
   */
  it('imports only sections explicitly present in a partial backup', () => {
    const result = ok(JSON.stringify({ measurements: [measurement] }))

    expect(totalEntries(result.sections)).toBe(1)
    expect(totalDropped(result.sections)).toBe(0)
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0]).toMatchObject({
      storageKey: 'gym-app:measurements',
      label: 'measurements',
      value: [measurement],
    })
  })

  it('still allows an explicitly empty section to clear that section', () => {
    const result = ok(JSON.stringify({ exercises: [] }))

    expect(result.sections).toHaveLength(1)
    expect(result.sections[0]).toMatchObject({
      storageKey: 'gym-app:exercises',
      label: 'exercises',
      value: [],
    })
  })

  it('rejects duplicate IDs inside a backup section', () => {
    const result = readBackup(backup({ exercises: [exercise, { ...exercise, name: 'Duplicate' }] }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/duplicate IDs in exercises.*e1/i)
  })

  it('rejects a logged exercise linked to an exercise missing from the supplied exercise list', () => {
    const result = readBackup(backup({
      sessions: [session],
      entries: [{ ...entry, exerciseId: 'missing-exercise' }],
    }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/linked to a missing exercise.*missing-exercise/i)
  })

  it('rejects a logged exercise linked to a workout session missing from the supplied session list', () => {
    const result = readBackup(backup({
      sessions: [session],
      entries: [{ ...entry, sessionId: 'missing-session' }],
    }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/linked to a missing workout session.*missing-session/i)
  })

  it('rejects a session plan linked to a missing exercise', () => {
    const result = readBackup(backup({
      sessions: [{ ...session, plannedExerciseIds: ['missing-exercise'] }],
    }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/planned with a missing exercise.*missing-exercise/i)
  })

  it('accepts a complete backup whose workout references are valid', () => {
    const result = readBackup(backup({ sessions: [session], entries: [entry] }))

    expect(result.ok).toBe(true)
  })

  it('does not reject references in a partial backup when their target section is intentionally absent', () => {
    const result = readBackup(JSON.stringify({ entries: [entry] }))

    expect(result.ok).toBe(true)
  })

  /*
   * Fișierul trece prin aceleași parsări ca datele din `localStorage`: ce n-ar
   * fi acceptat la citire n-are voie să intre nici pe ușa asta.
   */
  it('drops entries the app would refuse to load, and counts them', () => {
    const result = ok(backup({ measurements: [measurement, { id: 'm2' }, { date: '2026-01-01', weightKg: 80 }] }))

    expect(totalEntries(result.sections)).toBe(2)
    expect(totalDropped(result.sections)).toBe(2)
  })

  it('counts a section that is not a list as one unreadable section', () => {
    const result = ok(backup({ exercises: 'nope' }))

    expect(totalDropped(result.sections)).toBeGreaterThan(0)
    expect(describeSections(result.sections)).toBe('1 measurements')
  })

  it('says “nothing” for a backup with no usable entries', () => {
    const result = ok(JSON.stringify({ measurements: [], exercises: [] }))

    expect(describeSections(result.sections)).toBe('nothing')
  })
})
