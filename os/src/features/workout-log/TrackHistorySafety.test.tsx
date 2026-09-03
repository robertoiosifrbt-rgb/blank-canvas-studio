import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorkoutLogPage } from './WorkoutLogPage'
import { todayLocal } from '../../shared/localDate'

const EXERCISES_KEY = 'gym-app:exercises'
const FIELD_TYPES_KEY = 'gym-app:field-types'
const SESSIONS_KEY = 'gym-app:workout-sessions'
const LOG_KEY = 'gym-app:workout-log'

const bench = {
  id: 'bench',
  name: 'Bench Press',
  fields: ['reps'],
  category: 'Chest',
  difficulty: '',
  equipment: '',
  primaryMuscles: '',
  secondaryMuscles: '',
  instructions: '',
}

beforeEach(() => {
  const date = todayLocal()

  localStorage.setItem(EXERCISES_KEY, JSON.stringify([bench]))
  localStorage.setItem(FIELD_TYPES_KEY, JSON.stringify([
    { id: 'reps', label: 'Reps', unit: '' },
    { id: 'kg', label: 'Weight (kg)', unit: 'kg', archived: true },
  ]))
  localStorage.setItem(SESSIONS_KEY, JSON.stringify([
    { id: 'session-1', date, name: 'Push Day', createdAt: `${date}T08:00:00.000Z` },
  ]))
  localStorage.setItem(LOG_KEY, JSON.stringify([
    {
      id: 'entry-1',
      sessionId: 'session-1',
      date,
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      sets: [{ reps: 8, kg: 80 }],
      createdAt: `${date}T08:05:00.000Z`,
    },
  ]))
})

describe('archived Track workout history', () => {
  it('keeps the removed Track value readable in an existing workout', () => {
    render(<WorkoutLogPage />)

    expect(screen.getByText('Bench Press', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText(/8 reps/i)).toBeInTheDocument()
    expect(screen.getByText(/80kg/i)).toBeInTheDocument()
  })

  it('does not offer the archived Track for new logging', () => {
    render(<WorkoutLogPage />)

    expect(screen.queryByPlaceholderText('Weight (kg)')).not.toBeInTheDocument()
  })
})
