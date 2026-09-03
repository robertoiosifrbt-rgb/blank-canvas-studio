import { describe, expect, it } from 'vitest'
import {
  byOldestFirst,
  byRecencyDesc,
  parseWorkoutEntry,
  parseWorkoutSession,
  type WorkoutEntry,
} from './types'

const entry = (over: Partial<WorkoutEntry> = {}): WorkoutEntry => ({
  id: 'e1',
  sessionId: 's1',
  date: '2026-07-15',
  exerciseId: 'x1',
  exerciseName: 'Bench Press',
  sets: [{ reps: 8, kg: 60 }],
  ...over,
})

describe('byRecencyDesc', () => {
  it('puts the later date first', () => {
    const sorted = [entry({ date: '2026-07-10' }), entry({ date: '2026-07-15' })].sort(byRecencyDesc)
    expect(sorted[0].date).toBe('2026-07-15')
  })

  /*
   * Two sessions on the same day used to be indistinguishable, so "last time"
   * could show the earlier one. `createdAt` is the tiebreak.
   */
  it('breaks a same-day tie by creation time', () => {
    const morning = entry({ id: 'morning', createdAt: '2026-07-15T07:00:00.000Z' })
    const evening = entry({ id: 'evening', createdAt: '2026-07-15T18:30:00.000Z' })

    expect([morning, evening].sort(byRecencyDesc)[0].id).toBe('evening')
    expect([evening, morning].sort(byRecencyDesc)[0].id).toBe('evening')
  })

  it('sorts entries saved before createdAt existed after those that have it', () => {
    const legacy = entry({ id: 'legacy' })
    const recent = entry({ id: 'recent', createdAt: '2026-07-15T07:00:00.000Z' })

    expect([legacy, recent].sort(byRecencyDesc)[0].id).toBe('recent')
  })

  it('still prefers a newer date over a newer creation time on an older date', () => {
    const olderDay = entry({ id: 'older', date: '2026-07-10', createdAt: '2026-07-14T23:00:00.000Z' })
    const newerDay = entry({ id: 'newer', date: '2026-07-15', createdAt: '2026-07-15T06:00:00.000Z' })

    expect([olderDay, newerDay].sort(byRecencyDesc)[0].id).toBe('newer')
  })
})

describe('parseWorkoutEntry', () => {
  it('keeps a valid entry', () => {
    expect(parseWorkoutEntry(entry())?.value).toEqual(entry())
  })

  it('keeps the exercise name snapshot so history reads correctly after a delete', () => {
    expect(parseWorkoutEntry(entry())?.value.exerciseName).toBe('Bench Press')
  })

  it('accepts an entry logged before sessions existed', () => {
    // The session backfill on load keys off the empty sessionId, so this must
    // survive parsing rather than being dropped as invalid.
    const legacy = { id: 'e1', date: '2026-07-15', exerciseId: 'x1', exerciseName: 'Squat', sets: [{ reps: 5 }] }

    expect(parseWorkoutEntry(legacy)?.value.sessionId).toBe('')
  })

  it('drops entries without a usable identity or date', () => {
    expect(parseWorkoutEntry({ ...entry(), id: 42 })).toBeNull()
    expect(parseWorkoutEntry({ ...entry(), date: 'yesterday' })).toBeNull()
    expect(parseWorkoutEntry({ ...entry(), exerciseName: '' })).toBeNull()
    expect(parseWorkoutEntry({ ...entry(), sets: 'lots' })).toBeNull()
  })

  it('strips impossible set values and flags the entry as repaired', () => {
    const result = parseWorkoutEntry(entry({ sets: [{ reps: -3, kg: 60 }] }))

    expect(result?.value.sets).toEqual([{ kg: 60 }])
    expect(result?.lossy).toBe(true)
  })

  it('strips Infinity arriving through JSON', () => {
    const parsed: unknown = JSON.parse(
      '{"id":"e1","sessionId":"s1","date":"2026-07-15","exerciseId":"x1","exerciseName":"Squat","sets":[{"kg":1e999,"reps":5}]}',
    )
    const result = parseWorkoutEntry(parsed)

    expect(result?.value.sets).toEqual([{ reps: 5 }])
    expect(result?.lossy).toBe(true)
  })

  it('drops an entry once nothing usable is left in any set', () => {
    expect(parseWorkoutEntry(entry({ sets: [{ reps: -1 }] }))).toBeNull()
    expect(parseWorkoutEntry(entry({ sets: [] }))).toBeNull()
  })
})

describe('parseWorkoutSession', () => {
  it('keeps a valid session', () => {
    const session = { id: 's1', date: '2026-07-15', name: 'Push Day' }
    expect(parseWorkoutSession(session)?.value).toEqual(session)
  })

  it('treats a missing name as empty rather than dropping the session', () => {
    expect(parseWorkoutSession({ id: 's1', date: '2026-07-15' })?.value.name).toBe('')
  })

  it('drops sessions without a real id or date', () => {
    expect(parseWorkoutSession({ id: '', date: '2026-07-15' })).toBeNull()
    expect(parseWorkoutSession({ id: 's1', date: '2026-99-01' })).toBeNull()
  })

  /*
   * `endedAt` used to be written by "finish session" and then thrown away on
   * the next load, so finished workouts came back as still running and their
   * duration disappeared.
   */
  it('keeps the end of a finished session', () => {
    const session = {
      id: 's1',
      date: '2026-07-15',
      name: 'Push Day',
      createdAt: '2026-07-15T07:00:00.000Z',
      endedAt: '2026-07-15T08:12:00.000Z',
    }
    expect(parseWorkoutSession(session)?.value.endedAt).toBe('2026-07-15T08:12:00.000Z')
  })

  it('keeps the runner plan in order', () => {
    const parsed = parseWorkoutSession({
      id: 's1',
      date: '2026-07-15',
      name: '',
      plannedExerciseIds: ['x2', 'x1'],
    })
    expect(parsed?.value.plannedExerciseIds).toEqual(['x2', 'x1'])
    expect(parsed?.lossy).toBe(false)
  })

  it('keeps the session but reports a repair when the plan holds junk', () => {
    const parsed = parseWorkoutSession({
      id: 's1',
      date: '2026-07-15',
      plannedExerciseIds: ['x1', 42, '', null],
    })
    expect(parsed?.value.plannedExerciseIds).toEqual(['x1'])
    expect(parsed?.lossy).toBe(true)
  })

  it('leaves the plan off entirely for sessions saved before the runner', () => {
    expect(parseWorkoutSession({ id: 's1', date: '2026-07-15' })?.value).not.toHaveProperty(
      'plannedExerciseIds',
    )
  })
})

describe('byOldestFirst', () => {
  /*
   * The log stores entries newest first, which is right for "last time you did
   * this" and wrong for reading a session back: the card was numbering the
   * exercise you finished last as 1.
   */
  it('puts the exercise done first at the top', () => {
    const first = entry({ id: 'first', createdAt: '2026-07-15T07:05:00.000Z' })
    const last = entry({ id: 'last', createdAt: '2026-07-15T08:40:00.000Z' })

    expect([last, first].sort(byOldestFirst).map((e) => e.id)).toEqual(['first', 'last'])
  })

  it('reads an entry with no creation time as the oldest of its day', () => {
    const legacy = entry({ id: 'legacy' })
    const timed = entry({ id: 'timed', createdAt: '2026-07-15T07:05:00.000Z' })

    expect([timed, legacy].sort(byOldestFirst).map((e) => e.id)).toEqual(['legacy', 'timed'])
  })

  it('keeps whole days in order before anything else', () => {
    const older = entry({ id: 'older', date: '2026-07-10', createdAt: '2026-07-10T20:00:00.000Z' })
    const newer = entry({ id: 'newer', date: '2026-07-15', createdAt: '2026-07-15T06:00:00.000Z' })

    expect([newer, older].sort(byOldestFirst).map((e) => e.id)).toEqual(['older', 'newer'])
  })
})
