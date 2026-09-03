import { useMemo, useState } from 'react'
import type { Exercise } from '../exercises'
import type { WorkoutPlan } from '../workout-plans'
import { todayLocal } from '../../shared/localDate'
import './routines.css'

interface ExercisePickerProps {
  exercises: Exercise[]
  plans: WorkoutPlan[]
  onCancel: () => void
  /** Returns false when storage refused the write, so the picks stay on screen. */
  onStart: (name: string, exerciseIds: string[]) => boolean
  onSavePlan: (name: string, exerciseIds: string[]) => boolean
  onDeletePlan: (id: string) => boolean
}

/**
 * The step before the runner: choose what you are going to train, in order.
 * The order you tap is the order the runner walks, which is why the tiles show
 * a position number rather than a checkbox.
 */
export function ExercisePicker({ exercises, plans, onCancel, onStart, onSavePlan, onDeletePlan }: ExercisePickerProps) {
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const exerciseIds = useMemo(() => new Set(exercises.map((exercise) => exercise.id)), [exercises])

  function toggle(id: string) {
    setError(null)
    setPicked((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]))
  }

  function handleStart() {
    if (picked.length === 0) return
    if (!onStart(name.trim(), picked)) {
      setError('Could not start the workout — see the storage message. Your picks are still here.')
    }
  }

  function handleSavePlan() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give the routine a name before saving it.')
      return
    }
    if (picked.length === 0) return
    if (!onSavePlan(trimmed, picked)) {
      setError('Could not save the routine — see the storage message. Your picks are still here.')
      return
    }
    setError(null)
  }

  function startPlan(plan: WorkoutPlan) {
    const available = plan.exerciseIds.filter((id) => exerciseIds.has(id))
    if (available.length === 0) {
      setError(`“${plan.name}” has no exercises left in your library.`)
      return
    }
    if (!onStart(plan.name, available)) {
      setError('Could not start the routine — see the storage message.')
    }
  }

  return (
    <section className="runner-screen runner-picker" aria-label="New workout">
      <header className="runner-header">
        <button type="button" className="runner-icon-button" onClick={onCancel} aria-label="Back">
          ‹
        </button>
        <div className="runner-header-title">
          <strong>New Workout</strong>
          <span>{todayLocal()}</span>
        </div>
        <span className="runner-icon-button runner-icon-placeholder" aria-hidden="true" />
      </header>

      <div className="runner-picker-body">
        {plans.length > 0 && (
          <section className="runner-routines" aria-label="Saved routines">
            <div className="runner-picker-heading">
              <h2>Saved routines</h2>
              <span>{plans.length}</span>
            </div>
            <ul className="runner-routine-list">
              {plans.map((plan) => {
                const availableCount = plan.exerciseIds.filter((id) => exerciseIds.has(id)).length
                return (
                  <li key={plan.id} className="runner-routine-row">
                    <button type="button" className="runner-routine-start" onClick={() => startPlan(plan)}>
                      <strong>{plan.name}</strong>
                      <small>{availableCount} exercise{availableCount === 1 ? '' : 's'}</small>
                    </button>
                    <button
                      type="button"
                      className="runner-routine-delete"
                      aria-label={`Delete ${plan.name}`}
                      onClick={() => {
                        setError(null)
                        if (!onDeletePlan(plan.id)) setError('Could not delete the routine — see the storage message.')
                      }}
                    >
                      ×
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <label className="runner-name-field" htmlFor="runner-workout-name">
          Workout name
          <input
            id="runner-workout-name"
            type="text"
            value={name}
            placeholder="Push Day"
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        {exercises.length === 0 ? (
          <p className="runner-empty">
            Your exercise library is empty. Add an exercise under Workout → Exercises first, then start a
            workout.
          </p>
        ) : (
          <>
            <div className="runner-picker-heading">
              <h2>Choose exercises</h2>
              <span>{picked.length} selected</span>
            </div>
            <ul className="runner-picker-list">
              {exercises.map((exercise) => {
                const position = picked.indexOf(exercise.id)
                const isPicked = position !== -1
                return (
                  <li key={exercise.id}>
                    <button
                      type="button"
                      className={`runner-picker-row ${isPicked ? 'is-picked' : ''}`}
                      aria-pressed={isPicked}
                      onClick={() => toggle(exercise.id)}
                    >
                      <span className="runner-picker-order" aria-hidden="true">
                        {isPicked ? position + 1 : ''}
                      </span>
                      <span className="runner-picker-copy">
                        <strong>{exercise.name}</strong>
                        <small>{exercise.category || 'Exercise'}</small>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {error && (
          <p className="runner-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <footer className="runner-footer runner-picker-actions">
        <button
          type="button"
          className="runner-secondary-action"
          onClick={handleSavePlan}
          disabled={picked.length === 0 || !name.trim()}
        >
          Save Routine
        </button>
        <button
          type="button"
          className="runner-primary-action"
          onClick={handleStart}
          disabled={picked.length === 0}
        >
          Start Workout{picked.length ? ` (${picked.length})` : ''}
        </button>
      </footer>
    </section>
  )
}
