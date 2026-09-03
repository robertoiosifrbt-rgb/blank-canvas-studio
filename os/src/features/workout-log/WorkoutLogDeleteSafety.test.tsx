import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { WorkoutLogPage } from './WorkoutLogPage'
import { todayLocal } from '../../shared/localDate'

const EXERCISES_KEY = 'gym-app:exercises'
const SESSIONS_KEY = 'gym-app:workout-sessions'
const LOG_KEY = 'gym-app:workout-log'

const exercise = {
  id: 'ex-bench',
  name: 'Bench Press',
  fields: ['reps', 'kg'],
  category: '',
  difficulty: '',
  equipment: '',
  primaryMuscles: '',
  secondaryMuscles: '',
  instructions: '',
}

const session = {
  id: 's1',
  date: todayLocal(),
  name: 'Push Day',
  createdAt: new Date().toISOString(),
}

const entry = {
  id: 'e1',
  sessionId: 's1',
  date: todayLocal(),
  exerciseId: exercise.id,
  exerciseName: exercise.name,
  sets: [{ reps: 8, kg: 60 }],
  createdAt: new Date().toISOString(),
}

function seed() {
  localStorage.setItem(EXERCISES_KEY, JSON.stringify([exercise]))
  localStorage.setItem(SESSIONS_KEY, JSON.stringify([session]))
  localStorage.setItem(LOG_KEY, JSON.stringify([entry]))
}

function stored(key: string) {
  return JSON.parse(localStorage.getItem(key) ?? '[]')
}

function deleteWorkout() {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<WorkoutLogPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete session' }))
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('workout session deletion safety', () => {
  it('deletes the session and its entries together when both writes succeed', () => {
    seed()

    deleteWorkout()

    expect(stored(SESSIONS_KEY)).toEqual([])
    expect(stored(LOG_KEY)).toEqual([])
  })

  it('leaves the session untouched when deleting its entries is refused', () => {
    seed()
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === LOG_KEY && value === '[]') throw new DOMException('full', 'QuotaExceededError')
      original.call(this, key, value)
    })

    deleteWorkout()

    expect(stored(SESSIONS_KEY)).toHaveLength(1)
    expect(stored(LOG_KEY)).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent(/nothing was removed/i)
  })

  it('restores the entries when the session delete is refused after they were removed', () => {
    seed()
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === SESSIONS_KEY && value === '[]') throw new DOMException('full', 'QuotaExceededError')
      original.call(this, key, value)
    })

    deleteWorkout()

    expect(stored(SESSIONS_KEY)).toHaveLength(1)
    expect(stored(LOG_KEY)).toEqual([entry])
    expect(screen.getByRole('alert')).toHaveTextContent(/nothing was removed/i)
  })
})
