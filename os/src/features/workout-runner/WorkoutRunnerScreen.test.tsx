import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { WorkoutRunnerScreen } from './WorkoutRunnerScreen'
import { todayLocal } from '../../shared/localDate'
import type { WorkoutEntry, WorkoutSession } from '../workout-log/types'

const EXERCISES_KEY = 'gym-app:exercises'
const SESSIONS_KEY = 'gym-app:workout-sessions'
const LOG_KEY = 'gym-app:workout-log'

const BENCH = {
  id: 'ex-bench',
  name: 'Bench Press',
  fields: ['reps', 'kg'],
  category: 'Chest',
  difficulty: '',
  equipment: '',
  primaryMuscles: 'Chest',
  secondaryMuscles: '',
  instructions: '',
}

const SQUAT = { ...BENCH, id: 'ex-squat', name: 'Squat', category: 'Legs', primaryMuscles: 'Quads' }

const storedSessions = (): WorkoutSession[] => JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]')
const storedEntries = (): WorkoutEntry[] => JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]')

function loggedEntry(over: Partial<WorkoutEntry> = {}): WorkoutEntry {
  return {
    id: 'e-old',
    sessionId: 's0',
    date: '2026-07-10',
    exerciseId: BENCH.id,
    exerciseName: 'Bench Press',
    sets: [{ reps: 8, kg: 60 }, { reps: 8, kg: 62.5 }],
    createdAt: '2026-07-10T07:10:00.000Z',
    ...over,
  }
}

function seedSession(over: Partial<WorkoutSession> = {}) {
  const session: WorkoutSession = {
    id: 's1',
    date: todayLocal(),
    name: 'Push Day',
    createdAt: '2026-07-15T07:00:00.000Z',
    plannedExerciseIds: [BENCH.id, SQUAT.id],
    ...over,
  }
  localStorage.setItem(SESSIONS_KEY, JSON.stringify([session]))
  return session
}

function fillSet(rowNumber: number, reps: string, kg: string) {
  fireEvent.change(screen.getByLabelText(`Set ${rowNumber} Reps`), { target: { value: reps } })
  fireEvent.change(screen.getByLabelText(`Set ${rowNumber} Weight (kg)`), { target: { value: kg } })
}

beforeEach(() => {
  localStorage.setItem(EXERCISES_KEY, JSON.stringify([BENCH, SQUAT]))
})

describe('WorkoutRunnerScreen — picking exercises', () => {
  it('stores the plan in the order the exercises were tapped', () => {
    render(<WorkoutRunnerScreen onExit={() => {}} />)

    fireEvent.change(screen.getByLabelText('Workout name'), { target: { value: 'Leg Day' } })
    fireEvent.click(screen.getByRole('button', { name: /Squat/ }))
    fireEvent.click(screen.getByRole('button', { name: /Bench Press/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Start Workout (2)' }))

    expect(storedSessions()).toHaveLength(1)
    expect(storedSessions()[0]).toMatchObject({
      date: todayLocal(),
      name: 'Leg Day',
      plannedExerciseIds: [SQUAT.id, BENCH.id],
    })
  })

  it('cannot start a workout with nothing selected', () => {
    render(<WorkoutRunnerScreen onExit={() => {}} />)

    expect(screen.getByRole('button', { name: 'Start Workout' })).toBeDisabled()
    expect(storedSessions()).toHaveLength(0)
  })

  it('walks straight into the runner once the session is created', () => {
    render(<WorkoutRunnerScreen onExit={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /Bench Press/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Start Workout (1)' }))

    expect(screen.getByRole('heading', { name: 'Bench Press' })).toBeInTheDocument()
    expect(screen.getByText('0 of 1 exercises')).toBeInTheDocument()
  })

  it('says so instead of offering an empty picker when the library has no exercises', () => {
    localStorage.setItem(EXERCISES_KEY, JSON.stringify([]))
    render(<WorkoutRunnerScreen onExit={() => {}} />)

    expect(screen.getByText(/exercise library is empty/i)).toBeInTheDocument()
  })
})

describe('WorkoutRunnerScreen — running a session', () => {
  it('saves the filled sets and moves to the next exercise', () => {
    seedSession()
    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)

    expect(screen.getByText('0 of 2 exercises')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()

    fillSet(1, '8', '60')
    fillSet(2, '8', '70')
    fireEvent.click(screen.getByRole('button', { name: 'Finish Exercise' }))

    expect(storedEntries()).toHaveLength(1)
    expect(storedEntries()[0]).toMatchObject({
      sessionId: 's1',
      exerciseId: BENCH.id,
      exerciseName: 'Bench Press',
      sets: [{ reps: 8, kg: 60 }, { reps: 8, kg: 70 }],
    })
    expect(screen.getByRole('heading', { name: 'Squat' })).toBeInTheDocument()
    expect(screen.getByText('1 of 2 exercises')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('drops the blank rows instead of saving empty sets', () => {
    seedSession()
    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)

    fillSet(2, '10', '40')
    fireEvent.click(screen.getByRole('button', { name: 'Finish Exercise' }))

    expect(storedEntries()[0].sets).toEqual([{ reps: 10, kg: 40 }])
  })

  it('offers to skip an exercise with nothing filled in, and saves nothing', () => {
    seedSession()
    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Skip Exercise' }))

    expect(storedEntries()).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Squat' })).toBeInTheDocument()
  })

  it('refuses an out-of-range value and keeps the sets on screen', () => {
    seedSession()
    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)

    fillSet(1, '8', '999999')
    fireEvent.click(screen.getByRole('button', { name: 'Finish Exercise' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/must be between/i)
    expect(storedEntries()).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Bench Press' })).toBeInTheDocument()
    expect(screen.getByLabelText('Set 1 Weight (kg)')).toHaveValue(999999)
  })

  it('adds, removes and repeats set rows', () => {
    seedSession()
    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)

    // Three blank rows by default when the exercise has no history.
    expect(screen.getByLabelText('Set 3 Reps')).toBeInTheDocument()
    expect(screen.queryByLabelText('Set 4 Reps')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add Set' }))
    expect(screen.getByLabelText('Set 4 Reps')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove last set' }))
    expect(screen.queryByLabelText('Set 4 Reps')).not.toBeInTheDocument()

    fillSet(3, '6', '85')
    fireEvent.click(screen.getByRole('button', { name: 'Repeat last set' }))
    expect(screen.getByLabelText('Set 4 Reps')).toHaveValue(6)
    expect(screen.getByLabelText('Set 4 Weight (kg)')).toHaveValue(85)
  })

  it('ends the session and leaves the runner on the last exercise', () => {
    const onExit = vi.fn()
    seedSession({ plannedExerciseIds: [BENCH.id] })
    render(<WorkoutRunnerScreen sessionId="s1" onExit={onExit} />)

    fillSet(1, '5', '100')
    fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }))

    expect(storedEntries()).toHaveLength(1)
    expect(storedSessions()[0].endedAt).toEqual(expect.any(String))
    expect(onExit).toHaveBeenCalled()
  })

  it('resumes on the first exercise that has not been logged yet', () => {
    seedSession()
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        {
          id: 'e1',
          sessionId: 's1',
          date: todayLocal(),
          exerciseId: BENCH.id,
          exerciseName: 'Bench Press',
          sets: [{ reps: 8, kg: 60 }],
          createdAt: '2026-07-15T07:10:00.000Z',
        },
      ]),
    )

    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)

    expect(screen.getByRole('heading', { name: 'Squat' })).toBeInTheDocument()
    expect(screen.getByText('1 of 2 exercises')).toBeInTheDocument()
  })

  it('reopens an already logged exercise with its saved sets and updates in place', () => {
    seedSession({ plannedExerciseIds: [BENCH.id] })
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        {
          id: 'e1',
          sessionId: 's1',
          date: todayLocal(),
          exerciseId: BENCH.id,
          exerciseName: 'Bench Press',
          sets: [{ reps: 8, kg: 60 }],
          createdAt: '2026-07-15T07:10:00.000Z',
        },
      ]),
    )

    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)

    expect(screen.getByLabelText('Set 1 Reps')).toHaveValue(8)
    fireEvent.change(screen.getByLabelText('Set 1 Weight (kg)'), { target: { value: '65' } })
    fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }))

    expect(storedEntries()).toHaveLength(1)
    expect(storedEntries()[0].sets).toEqual([{ reps: 8, kg: 65 }])
  })

  it('keeps running when an exercise was deleted from the library', () => {
    seedSession({ plannedExerciseIds: ['ex-gone', SQUAT.id] })
    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)

    expect(screen.getByRole('heading', { name: 'Squat' })).toBeInTheDocument()
    expect(screen.getByText('0 of 1 exercises')).toBeInTheDocument()
  })

  it('goes back to the previous exercise from the options menu', () => {
    seedSession()
    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Skip Exercise' }))
    expect(screen.getByRole('heading', { name: 'Squat' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Workout options' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous exercise' }))

    expect(screen.getByRole('heading', { name: 'Bench Press' })).toBeInTheDocument()
  })
})

describe('WorkoutRunnerScreen — last time', () => {
  it('shows what was logged the last time this exercise was trained', () => {
    seedSession()
    localStorage.setItem(LOG_KEY, JSON.stringify([loggedEntry()]))

    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)

    expect(screen.getByText('Last time · 10 July 2026')).toBeInTheDocument()
    const sets = screen.getByRole('list').querySelectorAll('li')
    expect([...sets].map((set) => set.textContent)).toEqual(['18 reps · 60kg', '28 reps · 62.5kg'])
  })

  it('shows the previous workout, not the sets being logged right now', () => {
    seedSession({ plannedExerciseIds: [BENCH.id] })
    localStorage.setItem(LOG_KEY, JSON.stringify([loggedEntry({ sessionId: 's1', date: todayLocal() })]))

    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)

    // The only log for Bench Press belongs to the session on screen, so there
    // is no "last time" to show — it would just repeat the table above it.
    expect(screen.queryByText(/^Last time/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Set 1 Weight (kg)')).toHaveValue(60)
  })

  it('says nothing when the exercise has never been logged', () => {
    seedSession()
    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)

    expect(screen.queryByText(/^Last time/)).not.toBeInTheDocument()
  })

  it('follows the runner from one exercise to the next', () => {
    seedSession()
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        loggedEntry(),
        loggedEntry({ id: 'e-old-squat', exerciseId: SQUAT.id, exerciseName: 'Squat', date: '2026-07-12', sets: [{ reps: 5, kg: 100 }] }),
      ]),
    )

    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)
    expect(screen.getByText('Last time · 10 July 2026')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Skip Exercise' }))

    expect(screen.getByRole('heading', { name: 'Squat' })).toBeInTheDocument()
    expect(screen.getByText('Last time · 12 July 2026')).toBeInTheDocument()
    expect(screen.getByRole('list').textContent).toEqual('15 reps · 100kg')
  })
})

describe('WorkoutRunnerScreen — an exercise that tracks nothing', () => {
  /*
   * How an exercise ends up here: removing a track from the Tracks list
   * archives it and strips it from the exercise being edited, so an exercise
   * whose only track was that one is left with nothing to log. Until now the
   * runner said "add one under Workout → Exercises" — mid-set, three taps and
   * a lost place in the workout.
   */
  const TRACKLESS = { ...BENCH, id: 'ex-plank', name: 'Plank', fields: [] }

  it('offers the tracks and starts logging with the one that is picked', () => {
    localStorage.setItem(EXERCISES_KEY, JSON.stringify([TRACKLESS]))
    seedSession({ plannedExerciseIds: [TRACKLESS.id] })

    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)
    expect(screen.getByText(/Plank tracks nothing/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Set 1 Reps')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Time (s)' }))

    expect(screen.getByLabelText('Set 1 Time (s)')).toBeInTheDocument()
    expect(screen.queryByText(/tracks nothing/)).not.toBeInTheDocument()
    const stored = JSON.parse(localStorage.getItem(EXERCISES_KEY) ?? '[]')
    expect(stored[0].fields).toEqual(['time'])
  })

  it('saves the sets logged on the track that was just added', () => {
    localStorage.setItem(EXERCISES_KEY, JSON.stringify([TRACKLESS]))
    seedSession({ plannedExerciseIds: [TRACKLESS.id] })

    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Time (s)' }))
    fireEvent.change(screen.getByLabelText('Set 1 Time (s)'), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }))

    expect(storedEntries()).toHaveLength(1)
    expect(storedEntries()[0]).toMatchObject({ exerciseName: 'Plank', sets: [{ time: 45 }] })
  })

  it('points at the library when there is no track to pick either', () => {
    localStorage.setItem(EXERCISES_KEY, JSON.stringify([TRACKLESS]))
    localStorage.setItem(
      'gym-app:field-types',
      JSON.stringify([{ id: 'reps', label: 'Reps', unit: '', archived: true }]),
    )
    seedSession({ plannedExerciseIds: [TRACKLESS.id] })

    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)

    expect(screen.getByText(/no tracks to log with yet/i)).toBeInTheDocument()
  })

  /*
   * The "Last time" pills for such an exercise were coming out blank: its old
   * sets are keyed by a track that is no longer in the list, and `formatSet`
   * only ever printed the tracks it recognised.
   */
  it('still shows the numbers of a set whose track is gone', () => {
    localStorage.setItem(EXERCISES_KEY, JSON.stringify([{ ...TRACKLESS, fields: ['reps'] }]))
    localStorage.setItem('gym-app:field-types', JSON.stringify([{ id: 'reps', label: 'Reps', unit: '' }]))
    seedSession({ plannedExerciseIds: [TRACKLESS.id] })
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        loggedEntry({ exerciseId: TRACKLESS.id, exerciseName: 'Plank', sets: [{ reps: 12, seconds: 45 }] }),
      ]),
    )

    render(<WorkoutRunnerScreen sessionId="s1" onExit={() => {}} />)

    expect(screen.getByRole('list').textContent).toEqual('112 reps · 45')
  })
})
