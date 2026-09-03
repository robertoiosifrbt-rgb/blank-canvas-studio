import { describe, expect, it } from 'vitest'
import { parseWorkoutPlan } from './types'

describe('parseWorkoutPlan', () => {
  it('reads a saved routine in exercise order', () => {
    const result = parseWorkoutPlan({
      id: 'p1',
      name: 'Push Day',
      exerciseIds: ['bench', 'incline', 'triceps'],
      createdAt: '2026-08-13T09:00:00.000Z',
      updatedAt: '2026-08-13T09:00:00.000Z',
    })

    expect(result && result.value.exerciseIds).toEqual(['bench', 'incline', 'triceps'])
    expect(result && result.value.name).toBe('Push Day')
  })

  it('rejects routines without a name or exercises', () => {
    expect(parseWorkoutPlan({ id: 'p1', name: '', exerciseIds: ['bench'] })).toBeNull()
    expect(parseWorkoutPlan({ id: 'p1', name: 'Push', exerciseIds: [] })).toBeNull()
  })

  it('drops unreadable exercise ids instead of corrupting the whole routine', () => {
    const result = parseWorkoutPlan({ id: 'p1', name: 'Push', exerciseIds: ['bench', 42] })
    expect(result && result.value.exerciseIds).toEqual(['bench'])
    expect(result && result.lossy).toBe(true)
  })
})
