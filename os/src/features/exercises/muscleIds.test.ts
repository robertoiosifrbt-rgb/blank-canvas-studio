import { describe, expect, it } from 'vitest'
import { parseExercise } from './types'

function valueOf(raw: unknown) {
  const parsed = parseExercise(raw)
  if (!parsed) throw new Error('exercise should parse')
  return parsed.value
}

describe('exercise canonical muscle IDs', () => {
  it('derives stable IDs from legacy muscle text', () => {
    const exercise = valueOf({
      id: 'e1',
      name: 'Row',
      fields: ['reps', 'kg'],
      primaryMuscles: 'Lats, Traps',
      secondaryMuscles: 'Biceps, Forearms',
    })

    expect(exercise.primaryMuscleIds).toEqual(['traps', 'lats'])
    expect(exercise.secondaryMuscleIds).toEqual(['biceps', 'forearms'])
  })

  it('keeps valid stored IDs and drops invalid ones', () => {
    const parsed = parseExercise({
      id: 'e2',
      name: 'Press',
      fields: ['reps'],
      primaryMuscles: 'Chest',
      secondaryMuscles: '',
      primaryMuscleIds: ['chest', 'not-a-muscle'],
      secondaryMuscleIds: [],
    })

    if (!parsed) throw new Error('exercise should parse')
    expect(parsed.value.primaryMuscleIds).toEqual(['chest'])
    expect(parsed.lossy).toBe(true)
  })
})
