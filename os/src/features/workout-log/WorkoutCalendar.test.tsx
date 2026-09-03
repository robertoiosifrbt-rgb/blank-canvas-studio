import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { WorkoutLogPage } from './WorkoutLogPage'
import { todayLocal } from '../../shared/localDate'
import type { WorkoutSession } from './types'

const EXERCISES_KEY = 'gym-app:exercises'
const SESSIONS_KEY = 'gym-app:workout-sessions'

function seedSessions(...dates: string[]) {
  const sessions: WorkoutSession[] = dates.map((date, index) => ({
    id: `s${index}`,
    date,
    name: `Session ${index}`,
    createdAt: `${date}T07:00:00.000Z`,
  }))
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

const calendar = () => screen.getByRole('region', { name: 'Workout calendar' })
const day = (name: string | RegExp) => within(calendar()).getByRole('button', { name })

beforeEach(() => {
  localStorage.setItem(EXERCISES_KEY, JSON.stringify([]))
})

describe('WorkoutLogPage calendar', () => {
  it('marks the days you trained', () => {
    seedSessions('2026-05-18', '2026-05-14')
    render(<WorkoutLogPage />)

    expect(day('18 May 2026, trained')).toBeInTheDocument()
    expect(day('14 May 2026, trained')).toBeInTheDocument()
    // A day with nothing logged carries no such label.
    expect(day('15 May 2026')).toBeInTheDocument()
  })

  /*
   * Opening on today's month is the least useful thing to show after a few
   * weeks off: an empty grid, and the training you did do a month back nowhere
   * in sight.
   */
  it('opens on the month you last trained in', () => {
    seedSessions('2026-05-18')
    render(<WorkoutLogPage />)

    expect(within(calendar()).getByText('May 2026')).toBeInTheDocument()
  })

  it('opens on this month when there is nothing logged at all', () => {
    render(<WorkoutLogPage />)

    const thisMonth = new Date(`${todayLocal()}T12:00:00`).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    })
    expect(within(calendar()).getByText(thisMonth)).toBeInTheDocument()
  })

  it('steps through the months', () => {
    seedSessions('2026-05-18')
    render(<WorkoutLogPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(within(calendar()).getByText('June 2026')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(within(calendar()).getByText('April 2026')).toBeInTheDocument()
  })

  /* The calendar and the list have to be showing the same thing. */
  it('lists only the month on screen', () => {
    seedSessions('2026-05-18', '2026-04-20')
    render(<WorkoutLogPage />)

    expect(screen.getByText('Session 0')).toBeInTheDocument()
    expect(screen.queryByText('Session 1')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))

    expect(screen.queryByText('Session 0')).not.toBeInTheDocument()
    expect(screen.getByText('Session 1')).toBeInTheDocument()
  })

  it('narrows to one day when you tap it, and widens again when you tap it back', () => {
    seedSessions('2026-05-18', '2026-05-14')
    render(<WorkoutLogPage />)

    fireEvent.click(day('18 May 2026, trained'))
    expect(screen.getByText('Session 0')).toBeInTheDocument()
    expect(screen.queryByText('Session 1')).not.toBeInTheDocument()

    fireEvent.click(day('18 May 2026, trained'))
    expect(screen.getByText('Session 1')).toBeInTheDocument()
  })

  it('says so when the day or the month has nothing in it', () => {
    seedSessions('2026-05-18')
    render(<WorkoutLogPage />)

    fireEvent.click(day('15 May 2026'))
    expect(screen.getByText('No workout logged on 2026-05-15.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('No workouts logged in April 2026.')).toBeInTheDocument()
  })

  /*
   * The list follows the month, so a session given a date in another month
   * would drop out of sight the moment it was saved.
   */
  it('follows a session that is moved to another month', () => {
    seedSessions('2026-05-18')
    render(<WorkoutLogPage />)

    fireEvent.click(screen.getByRole('button', { name: /Session 0/ }))
    fireEvent.click(screen.getByRole('button', { name: /Edit session/ }))
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(within(calendar()).getByText('September 2026')).toBeInTheDocument()
    // The card is still on screen, now carrying its new date — written out,
    // the way the row shows it rather than the way it is stored.
    expect(screen.getByText('2 September 2026')).toBeInTheDocument()
    expect(screen.queryByText('2026-09-02')).not.toBeInTheDocument()
  })

  it('drops the day filter when the month changes', () => {
    seedSessions('2026-05-18')
    render(<WorkoutLogPage />)

    fireEvent.click(day('18 May 2026, trained'))
    expect(day('18 May 2026, trained')).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))

    expect(day('18 May 2026, trained')).toHaveAttribute('aria-pressed', 'false')
  })

  /* Tapping a day outside the month would move the month under your finger. */
  it('does not let you tap the days either side of the month', () => {
    seedSessions('2026-05-18')
    render(<WorkoutLogPage />)

    // 1 May 2026 is a Friday, so the grid opens with 27-30 April in it.
    expect(within(calendar()).queryByRole('button', { name: /30 April 2026/ })).toBeNull()
  })
})
