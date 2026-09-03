import { useState } from 'react'
import type { Exercise, ExerciseDetails, FieldType } from './types'
import { ExerciseMuscleMap } from '../body-overview'
import { ExerciseForm } from './ExerciseForm'
import { StarIcon } from './icons'

interface EmptyMessage {
  title: string
  detail: string
}

interface ExerciseListProps {
  exercises: Exercise[]
  fieldTypes: FieldType[]
  onAddFieldType: (label: string, unit: string) => FieldType | null
  onRemoveFieldType: (id: string) => boolean
  onUpdate: (id: string, name: string, fields: string[], details: ExerciseDetails) => boolean
  onDelete: (id: string) => boolean
  onToggleFavourite: (id: string) => boolean
  emptyMessage: EmptyMessage
}

export function ExerciseList({
  exercises,
  fieldTypes,
  onAddFieldType,
  onRemoveFieldType,
  onUpdate,
  onDelete,
  onToggleFavourite,
  emptyMessage,
}: ExerciseListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'instructions' | 'muscles'>('instructions')

  const labelFor = (id: string) => fieldTypes.find((f) => f.id === id)?.label ?? id

  function handleDelete(exercise: Exercise) {
    const tracked = exercise.fields.map(labelFor).join(', ')
    const confirmed = window.confirm(
      `Delete "${exercise.name}"?\n\n` +
        `This removes the exercise and its tracked fields (${tracked}).\n\n` +
        'Workouts you already logged are kept and will still show this name.',
    )
    if (confirmed) onDelete(exercise.id)
  }

  if (exercises.length === 0) {
    return (
      <div className="empty-state card">
        <strong>{emptyMessage.title}</strong>
        <span>{emptyMessage.detail}</span>
      </div>
    )
  }

  return (
    <div className="exercise-card-list">
      {exercises.map((exercise) => {
        const isEditing = editingId === exercise.id
        const isOpen = detailId === exercise.id

        if (isEditing) {
          return (
            <article className="exercise-card card" key={exercise.id}>
              <ExerciseForm
                exercises={exercises}
                fieldTypes={fieldTypes}
                onAddFieldType={onAddFieldType}
                onRemoveFieldType={onRemoveFieldType}
                initial={exercise}
                submitLabel="Save changes"
                onSubmit={(name, fields, details) => {
                  if (!onUpdate(exercise.id, name, fields, details)) return false
                  setEditingId(null)
                  return true
                }}
                onCancel={() => setEditingId(null)}
              />
            </article>
          )
        }

        if (isOpen) {
          return (
            <article className="exercise-card card exercise-card-detail-open" key={exercise.id}>
              <ExerciseDetail
                exercise={exercise}
                tab={detailTab}
                onTab={setDetailTab}
                onClose={() => setDetailId(null)}
                onToggleFavourite={() => onToggleFavourite(exercise.id)}
                onEdit={() => {
                  setDetailId(null)
                  setEditingId(exercise.id)
                }}
                onDelete={() => handleDelete(exercise)}
              />
            </article>
          )
        }

        return (
          <article className="exercise-card card" key={exercise.id}>
            <div className="exercise-card-top">
              {/*
                * The thumbnail is the same body map the detail view uses, at
                * row size. The mockup has a photograph here; we have no photos
                * (see DESIGN_TARGET, "Întrebări deschise"), and a muscle map
                * carries the one thing a picture would have told you at a
                * glance. It renders nothing when the exercise names no muscle,
                * so the row simply closes up rather than showing an empty body.
                */}
              <div className="exercise-card-thumb" aria-hidden="true">
                <ExerciseMuscleMap
                  primaryMuscles={exercise.primaryMuscles}
                  secondaryMuscles={exercise.secondaryMuscles}
                  exerciseName={exercise.name}
                />
              </div>

              <div className="exercise-card-copy">
                <span className="exercise-category">{exercise.category || 'Exercise'}</span>
                <h3>{exercise.name}</h3>
                <div className="track-pills">
                  {exercise.fields.map((id) => (
                    <span key={id}>{labelFor(id)}</span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className={`exercise-favourite ${exercise.favourite ? 'is-favourite' : ''}`}
                aria-pressed={exercise.favourite === true}
                aria-label={`${exercise.favourite ? 'Remove' : 'Add'} ${exercise.name} ${exercise.favourite ? 'from' : 'to'} favourites`}
                onClick={() => onToggleFavourite(exercise.id)}
              >
                <StarIcon filled={exercise.favourite === true} />
              </button>
            </div>

            <div className="exercise-card-actions">
              <button
                type="button"
                className="exercise-detail-trigger"
                onClick={() => {
                  setDetailId(exercise.id)
                  setDetailTab('instructions')
                }}
              >
                Details
              </button>
              <button type="button" onClick={() => setEditingId(exercise.id)} aria-label={`Edit ${exercise.name}`}>
                Edit
              </button>
              <button type="button" className="danger-action" onClick={() => handleDelete(exercise)} aria-label={`Delete ${exercise.name}`}>
                Delete
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

interface ExerciseDetailProps {
  exercise: Exercise
  tab: 'instructions' | 'muscles'
  onTab: (tab: 'instructions' | 'muscles') => void
  onClose: () => void
  onToggleFavourite: () => void
  onEdit: () => void
  onDelete: () => void
}

function ExerciseDetail({ exercise, tab, onTab, onClose, onToggleFavourite, onEdit, onDelete }: ExerciseDetailProps) {
  const steps = (exercise.instructions || 'No instructions added yet.').split(/\n+/).filter(Boolean)

  return (
    <section className="exercise-target-detail full-detail">
      <div className="exercise-detail-hero">
        <div className="exercise-detail-hero-top">
          <button type="button" aria-label="Close exercise details" onClick={onClose}>‹</button>
          <strong>{exercise.name}</strong>
          <button
            type="button"
            className={`exercise-favourite ${exercise.favourite ? 'is-favourite' : ''}`}
            aria-pressed={exercise.favourite === true}
            aria-label={`${exercise.favourite ? 'Remove' : 'Add'} ${exercise.name} ${exercise.favourite ? 'from' : 'to'} favourites`}
            onClick={onToggleFavourite}
          >
            <StarIcon filled={exercise.favourite === true} />
          </button>
        </div>
        <div className="exercise-visual">
          <ExerciseMuscleMap
            primaryMuscles={exercise.primaryMuscles}
            secondaryMuscles={exercise.secondaryMuscles}
            exerciseName={exercise.name}
          />
          <div className="exercise-visual-copy">
            <strong>{exercise.name}</strong>
            <span>{exercise.primaryMuscles || exercise.category || 'Exercise'}</span>
          </div>
        </div>
      </div>

      <div className="exercise-meta-grid">
        <div><span>Category</span><strong>{exercise.category || 'Strength'}</strong></div>
        <div><span>Equipment</span><strong>{exercise.equipment || '—'}</strong></div>
        <div><span>Primary Muscles</span><strong>{exercise.primaryMuscles || '—'}</strong></div>
        <div><span>Secondary Muscles</span><strong>{exercise.secondaryMuscles || '—'}</strong></div>
      </div>

      <div className="exercise-detail-tabs">
        <button type="button" className={tab === 'instructions' ? 'active' : ''} onClick={() => onTab('instructions')}>Instructions</button>
        <button type="button" className={tab === 'muscles' ? 'active' : ''} onClick={() => onTab('muscles')}>Muscles</button>
      </div>

      {tab === 'instructions' ? (
        <div className="exercise-detail-instructions">
          {steps.map((line, index) => (
            <p key={`${line}-${index}`}><span>{index + 1}</span>{line}</p>
          ))}
        </div>
      ) : (
        <div className="exercise-muscle-panel">
          <ExerciseMuscleMap
            primaryMuscles={exercise.primaryMuscles}
            secondaryMuscles={exercise.secondaryMuscles}
            exerciseName={exercise.name}
          />
          <div><span>Primary</span><strong>{exercise.primaryMuscles || 'Not specified'}</strong></div>
          <div><span>Secondary</span><strong>{exercise.secondaryMuscles || 'Not specified'}</strong></div>
        </div>
      )}

      <button type="button" className="exercise-add-workout-cta" onClick={onClose}>Add to Workout</button>

      <div className="exercise-detail-management">
        <button type="button" onClick={onEdit} aria-label={`Edit ${exercise.name}`}>Edit exercise</button>
        <button type="button" className="danger-action" onClick={onDelete} aria-label={`Delete ${exercise.name}`}>Delete</button>
      </div>
    </section>
  )
}
