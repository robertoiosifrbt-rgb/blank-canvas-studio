import { describe, expect, it } from 'vitest'
import { readBackup } from './importData'

const exercise = {
  id: 'e1',
  name: 'Chest Press',
  fields: ['reps', 'kg'],
  category: 'Chest',
  difficulty: '',
  equipment: 'Machine',
  primaryMuscles: 'Chest',
  secondaryMuscles: 'Triceps',
  instructions: '',
}

const plan = {
  id: 'p1',
  name: 'Push Day',
  exerciseIds: ['e1'],
  createdAt: '2026-08-13T09:00:00.000Z',
  updatedAt: '2026-08-13T09:00:00.000Z',
}

describe('workout routine backup import', () => {
  it('imports routines as their own storage section', () => {
    const result = readBackup(JSON.stringify({ exercises: [exercise], workoutPlans: [plan] }))
    if (!result.ok) throw new Error(result.error)

    const routines = result.sections.find((section) => section.field === 'workoutPlans')
    expect(routines?.storageKey).toBe('gym-app:workout-plans')
    expect(routines?.value).toHaveLength(1)
  })

  it('rejects a routine that references a missing exercise when exercises are in the same backup', () => {
    const result = readBackup(JSON.stringify({ exercises: [exercise], workoutPlans: [{ ...plan, exerciseIds: ['missing'] }] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/workout routine.*missing exercise/i)
  })

  it('allows a partial routine-only backup because exercises may already exist on the device', () => {
    const result = readBackup(JSON.stringify({ workoutPlans: [plan] }))
    expect(result.ok).toBe(true)
  })
})
