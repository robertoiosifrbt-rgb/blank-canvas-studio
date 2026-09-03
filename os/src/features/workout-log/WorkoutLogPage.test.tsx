import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { WorkoutLogPage } from './WorkoutLogPage'
import { todayLocal } from '../../shared/localDate'
import type { WorkoutEntry, WorkoutSession } from './types'

const EXERCISES_KEY = 'gym-app:exercises'
const SESSIONS_KEY = 'gym-app:workout-sessions'
const LOG_KEY = 'gym-app:workout-log'

const BENCH = {
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

const SQUAT = { ...BENCH, id: 'ex-squat', name: 'Squat' }

const storedSessions = (): WorkoutSession[] => JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]')
const storedEntries = (): WorkoutEntry[] => JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]')

function seedSession(over: Partial<WorkoutSession> = {}) {
  const session: WorkoutSession = {
    id: 's1',
    date: todayLocal(),
    name: 'Push Day',
    createdAt: '2026-07-15T07:00:00.000Z',
    ...over,
  }
  localStorage.setItem(SESSIONS_KEY, JSON.stringify([session]))
  return session
}

/** Logs one exercise into the open session card. */
function logExercise(exerciseName: string, reps: string, kg: string) {
  fireEvent.change(screen.getByLabelText('Exercise'), {
    target: { value: exerciseName === 'Squat' ? SQUAT.id : BENCH.id },
  })
  const inputs = screen.getAllByPlaceholderText('Reps')
  fireEvent.change(inputs[inputs.length - 1], { target: { value: reps } })
  const kgInputs = screen.getAllByPlaceholderText('Weight (kg)')
  fireEvent.change(kgInputs[kgInputs.length - 1], { target: { value: kg } })
  fireEvent.click(screen.getByRole('button', { name: 'Log exercise' }))
}

beforeEach(() => {
  localStorage.setItem(EXERCISES_KEY, JSON.stringify([BENCH, SQUAT]))
})

describe('WorkoutLogPage', () => {
  it('creates a session dated with the local calendar day', () => {
    render(<WorkoutLogPage />)

    fireEvent.click(screen.getByRole('button', { name: '+ New session' }))
    expect(screen.getByLabelText('Date')).toHaveValue(todayLocal())
    fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: 'Push Day' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))

    expect(storedSessions()).toHaveLength(1)
    expect(storedSessions()[0]).toMatchObject({ date: todayLocal(), name: 'Push Day' })
  })

  it('stamps a new session with a creation time', () => {
    render(<WorkoutLogPage />)
    fireEvent.click(screen.getByRole('button', { name: '+ New session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))

    expect(storedSessions()[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('holds several exercises in one session', () => {
    seedSession()
    render(<WorkoutLogPage />)

    logExercise('Bench Press', '8', '60')
    logExercise('Squat', '5', '100')

    expect(storedEntries()).toHaveLength(2)
    expect(storedEntries().map((e) => e.exerciseName).sort()).toEqual(['Bench Press', 'Squat'])
    expect(storedEntries().every((e) => e.sessionId === 's1')).toBe(true)
  })

  it('stores the exercise name alongside its id so history survives a deletion', () => {
    seedSession()
    render(<WorkoutLogPage />)

    logExercise('Bench Press', '8', '60')

    expect(storedEntries()[0]).toMatchObject({ exerciseId: BENCH.id, exerciseName: 'Bench Press' })
  })

  /*
   * Two sessions on the same day used to be indistinguishable, so the "last
   * time" reference could show the earlier one.
   */
  it('shows the most recently logged sets when two exist on the same day', () => {
    seedSession()
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        {
          id: 'morning',
          sessionId: 's1',
          date: '2026-07-15',
          exerciseId: BENCH.id,
          exerciseName: 'Bench Press',
          sets: [{ reps: 5, kg: 50 }],
          createdAt: '2026-07-15T07:00:00.000Z',
        },
        {
          id: 'evening',
          sessionId: 's1',
          date: '2026-07-15',
          exerciseId: BENCH.id,
          exerciseName: 'Bench Press',
          sets: [{ reps: 12, kg: 70 }],
          createdAt: '2026-07-15T18:00:00.000Z',
        },
      ]),
    )
    render(<WorkoutLogPage />)

    fireEvent.change(screen.getByLabelText('Exercise'), { target: { value: BENCH.id } })

    const hint = screen.getByText(/Last time/)
    expect(hint).toHaveTextContent('70kg')
    expect(hint).not.toHaveTextContent('50kg')
  })

  it('moves a session and its logged exercises to the new date together', () => {
    seedSession({ date: '2026-07-15' })
    render(<WorkoutLogPage />)
    // Ancorat pe numele sesiunii: de când rândul scrie data ca „15 July 2026",
    // eticheta lui se potrivește și cu a zilei din calendar.
    fireEvent.click(screen.getByRole('button', { name: /Push Day/ }))
    logExercise('Bench Press', '8', '60')

    fireEvent.click(screen.getByRole('button', { name: /Edit session/ }))
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-16' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(storedSessions()[0].date).toBe('2026-07-16')
    expect(storedEntries()[0].date).toBe('2026-07-16')
  })

  /*
   * Entries logged before sessions existed have no sessionId; on load they are
   * matched to a session for their date rather than left orphaned.
   */
  it('gives entries saved before sessions existed a session of their own', () => {
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        {
          id: 'legacy',
          date: '2026-07-15',
          exerciseId: BENCH.id,
          exerciseName: 'Bench Press',
          sets: [{ reps: 8 }],
        },
      ]),
    )

    render(<WorkoutLogPage />)

    expect(storedSessions()).toHaveLength(1)
    expect(storedSessions()[0].date).toBe('2026-07-15')
    expect(storedEntries()[0].sessionId).toBe(storedSessions()[0].id)
  })

  it('refuses impossible set values when the browser check is bypassed', () => {
    seedSession()
    render(<WorkoutLogPage />)
    fireEvent.change(screen.getByLabelText('Exercise'), { target: { value: BENCH.id } })
    fireEvent.change(screen.getAllByPlaceholderText('Reps')[0], { target: { value: '-3' } })

    const form = screen.getByRole('button', { name: 'Log exercise' }).closest('form')!
    fireEvent.submit(form)

    expect(screen.getByRole('alert')).toHaveTextContent(/must be between 0 and 100000/)
    expect(storedEntries()).toHaveLength(0)
  })

  it('will not log an exercise with no values filled in', () => {
    seedSession()
    render(<WorkoutLogPage />)
    fireEvent.change(screen.getByLabelText('Exercise'), { target: { value: BENCH.id } })

    fireEvent.click(screen.getByRole('button', { name: 'Log exercise' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/at least one set/i)
    expect(storedEntries()).toHaveLength(0)
  })

  it('reports a refused write and keeps the sets on screen', () => {
    seedSession()
    render(<WorkoutLogPage />)
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('exceeded', 'QuotaExceededError')
    })

    logExercise('Bench Press', '8', '60')

    expect(screen.getByText(/out of storage space/i)).toBeInTheDocument()
    expect(screen.getAllByPlaceholderText('Reps')[0]).toHaveValue(8)
    expect(localStorage.getItem(LOG_KEY)).toBeNull()
    setItem.mockRestore()
  })

  it('still renders when the stored sessions are corrupt', () => {
    localStorage.setItem(SESSIONS_KEY, 'nonsense{')

    render(<WorkoutLogPage />)

    expect(screen.getByRole('heading', { name: 'Workout Log' })).toBeInTheDocument()
    expect(screen.getByText(/unreadable/i)).toBeInTheDocument()
  })

  it('still renders when the stored entries are corrupt', () => {
    seedSession()
    localStorage.setItem(LOG_KEY, '[{"id":')

    render(<WorkoutLogPage />)

    expect(screen.getByRole('heading', { name: 'Workout Log' })).toBeInTheDocument()
    expect(screen.getByText(/unreadable/i)).toBeInTheDocument()
  })
})

/*
 * Editing a session's duration.
 *
 * Two separate faults met here. The field asked for HH:MM:SS while carrying
 * `inputMode="numeric"`, and the iOS numeric keypad has no colon — so the
 * format could not be typed on the phone at all. And underneath that, the page
 * dropped the value: `onUpdateSession={(date, name) => …}` ignored the third
 * argument, so even a correctly typed duration went nowhere. Fixing only the
 * keyboard would have produced a field that accepted input and still changed
 * nothing.
 */
describe('editing the workout duration', () => {
  function openSessionEditor() {
    seedSession({ createdAt: '2026-07-15T07:00:00.000Z', endedAt: '2026-07-15T21:05:00.000Z' })
    render(<WorkoutLogPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit session' }))
  }

  const durationField = () => screen.getByLabelText('Workout duration')
  const savedDurationSeconds = () => {
    const [session] = storedSessions()
    return (new Date(session.endedAt!).getTime() - new Date(session.createdAt!).getTime()) / 1000
  }

  it('saves a duration typed as bare digits', () => {
    openSessionEditor()
    fireEvent.change(durationField(), { target: { value: '011023' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(savedDurationSeconds()).toBe(4223)
  })

  it('puts the colons in as digits arrive, since the keypad cannot', () => {
    openSessionEditor()
    fireEvent.change(durationField(), { target: { value: '011023' } })

    expect(durationField()).toHaveValue('01:10:23')
  })

  it('says what it understood, in words', () => {
    openSessionEditor()
    fireEvent.change(durationField(), { target: { value: '011023' } })

    expect(screen.getByText(/1h 10m 23s/)).toBeInTheDocument()
  })

  it('still accepts a duration pasted with colons', () => {
    openSessionEditor()
    fireEvent.change(durationField(), { target: { value: '00:45:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(savedDurationSeconds()).toBe(2730)
  })

  it('leaves the rest of the session alone', () => {
    openSessionEditor()
    fireEvent.change(durationField(), { target: { value: '011023' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(storedSessions()[0]).toMatchObject({ name: 'Push Day', date: todayLocal() })
  })

  it('refuses minutes past 59 and keeps what was typed', () => {
    openSessionEditor()
    const before = savedDurationSeconds()
    fireEvent.change(durationField(), { target: { value: '01:75:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(savedDurationSeconds()).toBe(before)
    expect(durationField()).toHaveValue('01:75:00')
  })
})

/*
 * The closed session row. The mockup asks it to carry date, name,
 * `n exercises · duration` and the volume; it carried only the exercise count,
 * so the row said nothing about how hard the session was.
 */
describe('what a session row shows', () => {
  function renderRow(over: Parameters<typeof seedSession>[0] = {}) {
    seedSession({ date: '2026-07-15', name: 'Push Day', createdAt: '2026-07-15T07:00:00.000Z', endedAt: '2026-07-15T08:10:00.000Z', ...over })
    localStorage.setItem(LOG_KEY, JSON.stringify([
      { id: 'e1', sessionId: 's1', date: '2026-07-15', exerciseId: BENCH.id, exerciseName: 'Bench Press', sets: [{ reps: 10, kg: 60 }, { reps: 10, kg: 60 }] },
      { id: 'e2', sessionId: 's1', date: '2026-07-15', exerciseId: SQUAT.id, exerciseName: 'Squat', sets: [{ reps: 5, kg: 100 }] },
    ]))
    render(<WorkoutLogPage />)
    return screen.getByRole('button', { name: /Push Day/ })
  }

  it('writes the date out instead of printing the stored form', () => {
    const row = renderRow()

    expect(row).toHaveTextContent('15 July 2026')
    expect(row).not.toHaveTextContent('2026-07-15')
  })

  it('shows the exercise count and the duration together', () => {
    expect(renderRow()).toHaveTextContent('2 exercises · 1h 10m')
  })

  it('shows the volume lifted', () => {
    // 10×60 + 10×60 + 5×100 = 1700
    expect(renderRow()).toHaveTextContent('1,700 kg')
  })

  it('says a session is in progress rather than giving it a duration', () => {
    const row = renderRow({ endedAt: undefined })

    expect(row).toHaveTextContent('in progress')
    expect(row).not.toHaveTextContent('1h 10m')
  })

  /*
   * A bodyweight session has no weight to multiply, and "0 kg" would read as a
   * measurement rather than as an absence.
   */
  it('leaves the volume off when nothing was loaded', () => {
    seedSession({ date: '2026-07-15', name: 'Push Day', endedAt: '2026-07-15T08:10:00.000Z' })
    localStorage.setItem(LOG_KEY, JSON.stringify([
      { id: 'e1', sessionId: 's1', date: '2026-07-15', exerciseId: BENCH.id, exerciseName: 'Pull Up', sets: [{ reps: 10 }] },
    ]))
    render(<WorkoutLogPage />)

    expect(screen.getByRole('button', { name: /Push Day/ })).not.toHaveTextContent('kg')
  })
})

describe('adding an exercise to a finished session', () => {
  /*
   * The form used to render only while a session was still running, so an
   * exercise you forgot to log could not be added afterwards at all — the only
   * way in was to delete the session and type the whole thing again.
   */
  const FINISHED = { date: '2026-07-15', name: 'Push Day', createdAt: '2026-07-15T07:00:00.000Z', endedAt: '2026-07-15T08:10:00.000Z' }

  function openFinishedSession() {
    seedSession(FINISHED)
    render(<WorkoutLogPage />)
    fireEvent.click(screen.getByRole('button', { name: /Push Day/ }))
  }

  it('keeps the form behind a button until it is asked for', () => {
    openFinishedSession()

    expect(screen.queryByLabelText('Exercise')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+ Add exercise' }))
    expect(screen.getByLabelText('Exercise')).toBeInTheDocument()
  })

  it('logs the exercise into that session, on that session&apos;s date', () => {
    openFinishedSession()

    fireEvent.click(screen.getByRole('button', { name: '+ Add exercise' }))
    logExercise('Squat', '5', '100')

    expect(storedEntries()).toHaveLength(1)
    expect(storedEntries()[0]).toMatchObject({
      sessionId: 's1',
      date: '2026-07-15',
      exerciseName: 'Squat',
      sets: [{ reps: 5, kg: 100 }],
    })
    expect(storedSessions()[0].endedAt).toEqual(FINISHED.endedAt)
  })

  it('stays open for a second exercise, and closes on Done', () => {
    openFinishedSession()

    fireEvent.click(screen.getByRole('button', { name: '+ Add exercise' }))
    logExercise('Squat', '5', '100')
    logExercise('Bench Press', '8', '60')
    // Stored newest first, the way the log reads them back.
    expect(storedEntries().map((entry) => entry.exerciseName)).toEqual(['Bench Press', 'Squat'])

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByLabelText('Exercise')).not.toBeInTheDocument()
  })

  it('leaves a running session with its form already open', () => {
    // The running session opens by itself, so there is nothing to click.
    seedSession({ endedAt: undefined })
    render(<WorkoutLogPage />)

    expect(screen.getByLabelText('Exercise')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Add exercise' })).not.toBeInTheDocument()
  })
})

describe('the order exercises are listed in', () => {
  /*
   * Entries are stored newest first, so the card was reading them back in
   * reverse: the treadmill you finished on came out as exercise 1 and the
   * first thing you did was last on the list.
   */
  it('lists a session from the first exercise done to the last', () => {
    seedSession({ date: '2026-07-15', name: 'Push Day', endedAt: '2026-07-15T08:10:00.000Z' })
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        { id: 'e3', sessionId: 's1', date: '2026-07-15', exerciseId: BENCH.id, exerciseName: 'Treadmill', sets: [{ reps: 1 }], createdAt: '2026-07-15T08:00:00.000Z' },
        { id: 'e2', sessionId: 's1', date: '2026-07-15', exerciseId: BENCH.id, exerciseName: 'Squat', sets: [{ reps: 5 }], createdAt: '2026-07-15T07:30:00.000Z' },
        { id: 'e1', sessionId: 's1', date: '2026-07-15', exerciseId: BENCH.id, exerciseName: 'Bench Press', sets: [{ reps: 8 }], createdAt: '2026-07-15T07:05:00.000Z' },
      ]),
    )
    render(<WorkoutLogPage />)
    fireEvent.click(screen.getByRole('button', { name: /Push Day/ }))

    const listed = [...document.querySelectorAll('.logged-exercise-card')].map(
      (card) => card.querySelector('.logged-exercise-index')?.textContent + ' ' + card.querySelector('strong')?.textContent,
    )
    expect(listed).toEqual(['1 Bench Press', '2 Squat', '3 Treadmill'])
  })
})
