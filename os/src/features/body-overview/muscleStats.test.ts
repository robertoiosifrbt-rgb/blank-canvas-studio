import { describe, expect, it } from 'vitest'
import { computeMuscleStats, periodStart, shadeForShare } from './muscleStats'
import type { Exercise } from '../exercises'
import type { WorkoutEntry } from '../workout-log/types'

const NOW = new Date('2026-08-12T10:00:00') // a Wednesday

const bench: Exercise = {
  id: 'ex-bench',
  name: 'Barbell Bench Press',
  fields: ['reps', 'kg'],
  category: 'Chest',
  difficulty: '',
  equipment: 'Barbell',
  primaryMuscles: 'Chest',
  secondaryMuscles: 'Shoulders, Triceps',
  instructions: '',
}

const squat: Exercise = {
  ...bench,
  id: 'ex-squat',
  name: 'Back Squat',
  primaryMuscles: 'Quads',
  secondaryMuscles: 'Glutes',
}

function entry(over: Partial<WorkoutEntry> = {}): WorkoutEntry {
  return {
    id: 'e1',
    sessionId: 's1',
    date: '2026-08-12',
    exerciseId: bench.id,
    exerciseName: bench.name,
    sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }],
    ...over,
  }
}

describe('periodStart', () => {
  it('starts the week on Monday', () => {
    expect(periodStart('week', NOW)).toBe('2026-08-10')
  })

  it('starts the month on the first', () => {
    expect(periodStart('month', NOW)).toBe('2026-08-01')
  })

  it('has no start at all for all time', () => {
    expect(periodStart('all', NOW)).toBe('')
  })
})

describe('computeMuscleStats', () => {
  it('counts sets against the muscles the library names, not the exercise name', () => {
    const stats = computeMuscleStats([entry()], [bench], 'week', NOW)

    expect(stats.byMuscle.chest.primarySets).toBe(3)
    expect(stats.byMuscle.chest.level).toBe('primary')
    expect(stats.byMuscle.triceps.secondarySets).toBe(3)
    expect(stats.byMuscle.triceps.level).toBe('secondary')
  })

  /*
   * The old screen searched for the muscle name inside the exercise name, so
   * "Barbell Bench Press" contributed nothing to chest however carefully the
   * library had been filled in.
   */
  it('credits an exercise whose name mentions no muscle at all', () => {
    const stats = computeMuscleStats([entry()], [bench], 'week', NOW)

    expect(stats.byMuscle.chest.primarySets).toBeGreaterThan(0)
  })

  it('falls back to the exercise name when the library says nothing', () => {
    const bare = { ...bench, primaryMuscles: '', secondaryMuscles: '' }
    const stats = computeMuscleStats(
      [entry({ exerciseName: 'Calf raise' })],
      [bare],
      'week',
      NOW,
    )

    expect(stats.byMuscle.calves.primarySets).toBe(3)
  })

  it('still counts an entry whose exercise was deleted from the library', () => {
    const stats = computeMuscleStats([entry({ exerciseName: 'Calf raise' })], [], 'week', NOW)

    expect(stats.byMuscle.calves.primarySets).toBe(3)
  })

  it('leaves out sets from before the period', () => {
    const entries = [entry({ id: 'a' }), entry({ id: 'b', date: '2026-08-03' })]

    expect(computeMuscleStats(entries, [bench], 'week', NOW).byMuscle.chest.primarySets).toBe(3)
    expect(computeMuscleStats(entries, [bench], 'month', NOW).byMuscle.chest.primarySets).toBe(6)
    expect(computeMuscleStats(entries, [bench], 'all', NOW).byMuscle.chest.primarySets).toBe(6)
  })

  /*
   * The two quiet levels say different things: one is "you were working that
   * area and skipped this muscle", the other is "you did not go near it".
   * A bench press names triceps, so the arm was worked — the biceps were the
   * part of it you left out.
   */
  it('separates a muscle you skipped from a part you never touched', () => {
    const stats = computeMuscleStats([entry()], [bench, squat], 'week', NOW)

    expect(stats.byMuscle.biceps.level).toBe('untargeted')
    expect(stats.byMuscle.quads.level).toBe('notInvolved')
  })

  /*
   * Every level answers the same question — what did this period's training do
   * — so what the library merely *could* train has no say. It used to: a
   * muscle named by any exercise came out green whether or not you had been
   * anywhere near it, and that green never changed from week to week.
   */
  it('ignores what the library could train but you did not', () => {
    const withSquat = computeMuscleStats([entry()], [bench, squat], 'week', NOW)
    const withoutSquat = computeMuscleStats([entry()], [bench], 'week', NOW)

    expect(withSquat.byMuscle.quads.level).toBe(withoutSquat.byMuscle.quads.level)
    expect(withSquat.byMuscle.quads.level).toBe('notInvolved')
  })

  /*
   * Only primary sets. With secondaries counted too, arms topped the list on
   * every push day — a bench press names triceps as secondary, so each chest
   * set also landed on the arms.
   */
  it('ranks body parts by the sets that targeted them, biggest first', () => {
    const entries = [
      entry({ id: 'a' }),
      entry({ id: 'b', exerciseId: squat.id, exerciseName: squat.name, sets: [{ reps: 5 }] }),
    ]
    const stats = computeMuscleStats(entries, [bench, squat], 'week', NOW)

    expect(stats.focus.map(({ part }) => part)).toEqual(['Chest', 'Legs'])
    expect(stats.focus[0]).toEqual({ part: 'Chest', sets: 3 })
  })

  it('reports nothing at all for an empty log', () => {
    const stats = computeMuscleStats([], [bench], 'week', NOW)

    expect(stats.focus).toEqual([])
    expect(stats.totalSets).toBe(0)
    expect(stats.byMuscle.chest.level).toBe('notInvolved')
  })
})

/*
 * The bars used to carry a fixed colour per body part, so chest came out red in
 * a week you never trained chest — warm enough to read as "you did a lot" while
 * meaning nothing. The scale is relative to your biggest group that period: the
 * card is about how lopsided the week was, and that reads the same at 40 sets
 * as at 4.
 */
describe('shadeForShare', () => {
  it('gives your biggest group the warmest colour', () => {
    expect(shadeForShare(1)).toBe('primary')
  })

  it('cools off as a group falls behind the biggest one', () => {
    expect(shadeForShare(0.8)).toBe('primary')
    expect(shadeForShare(0.6)).toBe('secondary')
    expect(shadeForShare(0.3)).toBe('untargeted')
    expect(shadeForShare(0.1)).toBe('notInvolved')
  })

  it('holds the same shades whatever the totals are', () => {
    // Half of 40 sets and half of 4 sets are the same story.
    expect(shadeForShare(20 / 40)).toBe(shadeForShare(2 / 4))
  })

  it('does not fall over on an empty period', () => {
    expect(shadeForShare(0)).toBe('notInvolved')
  })
})
