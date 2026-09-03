import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomePage } from './HomePage'
import { todayLocal } from '../shared/localDate'
import type { WorkoutSession } from '../features/workout-log/types'

const SESSIONS_KEY = 'gym-app:workout-sessions'

const noop = () => {}

function renderHome() {
  return render(
    <HomePage
      onStartWorkout={noop}
      onOpenWorkoutLog={noop}
      onOpenExercises={noop}
      onOpenBody={noop}
      onOpenPhotos={noop}
    />,
  )
}

function seedSessions(count: number) {
  const sessions: WorkoutSession[] = Array.from({ length: count }, (_, index) => ({
    id: `s${index}`,
    date: todayLocal(),
    name: `Session ${index}`,
    createdAt: `2026-07-15T0${index}:00:00.000Z`,
  }))
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

/*
 * The ring is an SVG arc: a full-circle dash pattern, pushed round by the
 * offset. Both numbers have to reach the element for it to show anything but a
 * bare circle — a stylesheet rule setting `stroke-dasharray` used to win over
 * the attribute and resolve to `none`, which drew a complete circle at every
 * percentage.
 */
describe('HomePage weekly progress ring', () => {
  const circumference = 2 * Math.PI * 45

  it('draws the arc as a fraction of the full circle', () => {
    seedSessions(3)
    const { container } = renderHome()

    expect(screen.getByText('60%')).toBeInTheDocument()

    const arc = container.querySelector('.progress-ring-fill')
    expect(arc).not.toBeNull()
    expect(Number(arc?.getAttribute('stroke-dasharray'))).toBeCloseTo(circumference, 3)
    // 60% done leaves 40% of the circumference as the gap.
    expect(Number((arc as SVGCircleElement).style.strokeDashoffset)).toBeCloseTo(
      circumference * 0.4,
      3,
    )
  })

  it('leaves the arc fully offset when nothing is logged this week', () => {
    const { container } = renderHome()

    expect(screen.getByText('0%')).toBeInTheDocument()
    const arc = container.querySelector('.progress-ring-fill')
    expect(Number((arc as SVGCircleElement).style.strokeDashoffset)).toBeCloseTo(circumference, 3)
  })

  it('closes the arc once the weekly target is reached', () => {
    seedSessions(5)
    const { container } = renderHome()

    expect(screen.getByText('100%')).toBeInTheDocument()
    const arc = container.querySelector('.progress-ring-fill')
    expect(Number((arc as SVGCircleElement).style.strokeDashoffset)).toBeCloseTo(0, 3)
  })

  it('does not run past the target when the week has extra sessions', () => {
    seedSessions(7)
    renderHome()

    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('5 / 5')).toBeInTheDocument()
  })
})
