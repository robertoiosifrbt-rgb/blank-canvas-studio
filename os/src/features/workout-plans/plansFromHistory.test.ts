import { describe, expect, it } from 'vitest'
import { plansFromHistory } from './plansFromHistory'
import type { WorkoutEntry, WorkoutSession } from '../workout-log/types'

const session = (id: string, date: string, name: string, extra: Partial<WorkoutSession> = {}): WorkoutSession =>
  ({ id, date, name, ...extra })

const entry = (sessionId: string, exerciseId: string, createdAt: string): WorkoutEntry =>
  ({ id: `${sessionId}-${exerciseId}`, sessionId, exerciseId, exerciseName: exerciseId.toUpperCase(),
    date: '2026-07-06', sets: [], createdAt })

describe('planuri scoase din istoric', () => {
  it('face un plan din fiecare nume de antrenament', () => {
    const plans = plansFromHistory(
      [session('s1', '2026-07-06', 'Push'), session('s2', '2026-07-07', 'Pull')],
      [entry('s1', 'bench', '1'), entry('s2', 'row', '1')],
    )
    expect(plans.map(p => p.name)).toEqual(['Pull', 'Push'])
  })

  it('păstrează ordinea în care au fost făcute exercițiile', () => {
    const plans = plansFromHistory(
      [session('s1', '2026-07-06', 'Push')],
      [entry('s1', 'fly', '3'), entry('s1', 'bench', '1'), entry('s1', 'dip', '2')],
    )
    expect(plans[0].exerciseIds).toEqual(['bench', 'dip', 'fly'])
  })

  it('ia varianta cea mai recentă când programul s-a schimbat', () => {
    const plans = plansFromHistory(
      [session('vechi', '2026-06-01', 'Push'), session('nou', '2026-07-13', 'Push')],
      [entry('vechi', 'bench', '1'), entry('nou', 'incline', '1'), entry('nou', 'dip', '2')],
    )
    expect(plans[0].exerciseIds).toEqual(['incline', 'dip'])
    expect(plans[0].times).toBe(2)
    expect(plans[0].lastDate).toBe('2026-07-13')
  })

  it('sare peste o ședință pornită și lăsată goală', () => {
    const plans = plansFromHistory(
      [session('goala', '2026-07-20', 'Push'), session('plina', '2026-07-13', 'Push')],
      [entry('plina', 'bench', '1')],
    )
    expect(plans[0].exerciseIds).toEqual(['bench'])
    /* Ultima dată rămâne cea reală, chiar dacă exercițiile vin din alta. */
    expect(plans[0].lastDate).toBe('2026-07-20')
  })

  it('respectă ordinea gândită în runner, dar numai pentru ce s-a lucrat', () => {
    const plans = plansFromHistory(
      [session('s1', '2026-07-06', 'Push', { plannedExerciseIds: ['bench', 'sarit', 'dip'] })],
      [entry('s1', 'dip', '1'), entry('s1', 'bench', '2')],
    )
    expect(plans[0].exerciseIds).toEqual(['bench', 'dip'])
  })

  it('nu scoate plan din ședințe fără nume sau fără exerciții', () => {
    const plans = plansFromHistory(
      [session('s1', '2026-07-06', '  '), session('s2', '2026-07-07', 'Pull')],
      [entry('s1', 'bench', '1')],
    )
    expect(plans).toEqual([])
  })

  it('nu amestecă exercițiile a două ședințe din aceeași zi', () => {
    const plans = plansFromHistory(
      [session('a', '2026-07-06', 'Push', { createdAt: '2026-07-06T08:00:00Z' }),
        session('b', '2026-07-06', 'Pull', { createdAt: '2026-07-06T18:00:00Z' })],
      [entry('a', 'bench', '1'), entry('b', 'row', '1')],
    )
    expect(plans.find(p => p.name === 'Push')?.exerciseIds).toEqual(['bench'])
    expect(plans.find(p => p.name === 'Pull')?.exerciseIds).toEqual(['row'])
  })

  it('duce numele exercițiilor mai departe, ca să se vadă ce intră în plan', () => {
    const plans = plansFromHistory(
      [session('s1', '2026-07-06', 'Push')],
      [entry('s1', 'bench', '1')],
    )
    expect(plans[0].exerciseNames).toEqual(['BENCH'])
  })
})
