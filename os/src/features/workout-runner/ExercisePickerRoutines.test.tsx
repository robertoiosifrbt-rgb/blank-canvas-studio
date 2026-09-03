import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Exercise } from '../exercises'
import type { WorkoutPlan } from '../workout-plans'
import { ExercisePicker } from './ExercisePicker'

const exercises: Exercise[] = [
  {
    id: 'e1', name: 'Chest Press', fields: ['reps', 'kg'], category: 'Chest', difficulty: '', equipment: 'Machine',
    primaryMuscles: 'Chest', secondaryMuscles: 'Triceps', instructions: '', primaryMuscleIds: ['chest'], secondaryMuscleIds: ['triceps'],
  },
  {
    id: 'e2', name: 'Incline Press', fields: ['reps', 'kg'], category: 'Chest', difficulty: '', equipment: 'Machine',
    primaryMuscles: 'Chest', secondaryMuscles: 'Shoulders', instructions: '', primaryMuscleIds: ['chest'], secondaryMuscleIds: ['shoulders'],
  },
]

const plan: WorkoutPlan = {
  id: 'p1', name: 'Push Day', exerciseIds: ['e2', 'e1'],
  createdAt: '2026-08-13T09:00:00.000Z', updatedAt: '2026-08-13T09:00:00.000Z',
}

describe('ExercisePicker saved routines', () => {
  it('starts a routine in its saved exercise order', () => {
    const onStart = vi.fn(() => true)
    render(
      <ExercisePicker exercises={exercises} plans={[plan]} onCancel={() => {}} onStart={onStart} onSavePlan={() => true} onDeletePlan={() => true} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^Push Day2 exercises$/i }))
    expect(onStart).toHaveBeenCalledWith('Push Day', ['e2', 'e1'])
  })

  it('saves the current name and picked exercise order as a routine', () => {
    const onSavePlan = vi.fn(() => true)
    render(
      <ExercisePicker exercises={exercises} plans={[]} onCancel={() => {}} onStart={() => true} onSavePlan={onSavePlan} onDeletePlan={() => true} />,
    )

    fireEvent.change(screen.getByLabelText(/Workout name/i), { target: { value: 'Chest Day' } })
    fireEvent.click(screen.getByRole('button', { name: /Incline Press/i }))
    fireEvent.click(screen.getByRole('button', { name: /Chest Press/i }))
    fireEvent.click(screen.getByRole('button', { name: /Save Routine/i }))

    expect(onSavePlan).toHaveBeenCalledWith('Chest Day', ['e2', 'e1'])
  })

  it('deletes a saved routine without starting it', () => {
    const onDeletePlan = vi.fn(() => true)
    const onStart = vi.fn(() => true)
    render(
      <ExercisePicker exercises={exercises} plans={[plan]} onCancel={() => {}} onStart={onStart} onSavePlan={() => true} onDeletePlan={onDeletePlan} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete Push Day' }))
    expect(onDeletePlan).toHaveBeenCalledWith('p1')
    expect(onStart).not.toHaveBeenCalled()
  })
})
