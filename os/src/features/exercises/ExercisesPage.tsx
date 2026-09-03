import { useMemo, useState, type ReactNode } from 'react'
import { StorageNotice } from '../../shared/StorageNotice'
import { PageHeader } from '../../shared/PageHeader'
import { useExercises } from './useExercises'
import { useFieldTypes } from './useFieldTypes'
import { ExerciseForm } from './ExerciseForm'
import { ExerciseList } from './ExerciseList'
import { categoriesInUse, filterExercises } from './searchExercises'
import type { ExerciseDetails } from './types'
import { SearchIcon, StarIcon } from './icons'
import './exercises.css'

interface ExercisesPageProps {
  /** Rândul de tab-uri Log / Exercises, randat sub titlu. Vezi `WorkoutLogPage`. */
  tabs?: ReactNode
}

export function ExercisesPage({ tabs }: ExercisesPageProps = {}) {
  const {
    exercises,
    addExercise,
    updateExercise,
    deleteExercise,
    toggleFavourite,
    error: exercisesError,
    dismissError: dismissExercisesError,
  } = useExercises()
  // The single live copy of the field types for this page — the form and the
  // list both work off this one, so a newly added type appears in both at once.
  const {
    fieldTypes,
    addFieldType,
    removeFieldType,
    error: fieldTypesError,
    dismissError: dismissFieldTypesError,
  } = useFieldTypes()

  const [creatingExercise, setCreatingExercise] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [favouritesOnly, setFavouritesOnly] = useState(false)

  const categories = useMemo(() => categoriesInUse(exercises), [exercises])

  /*
   * A category chip can outlive the exercises that put it there — delete the
   * last Chest exercise and `Chest` disappears from the chips while it is still
   * the selection, leaving an empty screen and no chip to press to get out of
   * it. Falling back to `all` keeps the screen reachable. Computed before the
   * filter, so the list and the chips agree on which one is active.
   */
  const activeCategory = categories.includes(selectedCategory) ? selectedCategory : 'all'

  const visible = useMemo(
    () => filterExercises(exercises, { query, category: activeCategory, favouritesOnly }),
    [exercises, query, activeCategory, favouritesOnly],
  )

  function dismissAll() {
    dismissExercisesError()
    dismissFieldTypesError()
  }

  function handleAddExercise(name: string, fields: string[], details: ExerciseDetails): boolean {
    if (!addExercise(name, fields, details)) return false
    setCreatingExercise(false)
    return true
  }

  // Which of the three filters is hiding things, so the empty state can name it
  // rather than say "nothing here" while the library is full.
  const filtering = query.trim() !== '' || activeCategory !== 'all' || favouritesOnly

  return (
    <section className="exercise-library-page">
      <PageHeader
        title="Exercises"
        align="left"
        subtitle={`${exercises.length} ${exercises.length === 1 ? 'exercise' : 'exercises'} in your library`}
      />

      {tabs}

      <StorageNotice message={exercisesError ?? fieldTypesError} onDismiss={dismissAll} />

      <div className="exercise-search-row">
        <div className="target-exercise-search">
          <span><SearchIcon /></span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, muscle, equipment"
            aria-label="Search exercises"
          />
        </div>
        <button
          type="button"
          className={`exercise-filter-button ${favouritesOnly ? 'active' : ''}`}
          aria-pressed={favouritesOnly}
          aria-label="Show favourites only"
          onClick={() => setFavouritesOnly((on) => !on)}
        >
          <StarIcon filled={favouritesOnly} />
        </button>
      </div>

      <div className="exercise-category-scroll" role="group" aria-label="Filter by category">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={activeCategory === category ? 'active' : ''}
            aria-pressed={activeCategory === category}
            onClick={() => setSelectedCategory(category)}
          >
            {category === 'all' ? 'All' : category}
          </button>
        ))}
      </div>

      <div className="exercise-library-count">
        <strong>Your Exercises</strong>
        <span>
          {visible.length === exercises.length
            ? `${exercises.length} total`
            : `${visible.length} of ${exercises.length}`}
        </span>
      </div>

      {creatingExercise && (
        <div className="exercise-create-panel">
          <div className="exercise-form-section-heading">
            <span>Add New Exercise</span>
            <small>Name it, then pick what you track</small>
          </div>
          <ExerciseForm
            exercises={exercises}
            fieldTypes={fieldTypes}
            onAddFieldType={addFieldType}
            onRemoveFieldType={removeFieldType}
            submitLabel="Add exercise"
            onSubmit={handleAddExercise}
            onCancel={() => setCreatingExercise(false)}
          />
        </div>
      )}

      <ExerciseList
        exercises={visible}
        fieldTypes={fieldTypes}
        onAddFieldType={addFieldType}
        onRemoveFieldType={removeFieldType}
        onUpdate={updateExercise}
        onDelete={deleteExercise}
        onToggleFavourite={toggleFavourite}
        emptyMessage={
          filtering
            ? { title: 'Nothing matches', detail: 'Try a different search, or clear the filters.' }
            : { title: 'No exercises yet', detail: 'Add your first exercise to start logging workouts.' }
        }
      />

      {!creatingExercise && (
        <button
          type="button"
          className="exercise-fab"
          aria-label="Add exercise"
          onClick={() => setCreatingExercise(true)}
        >
          +
        </button>
      )}
    </section>
  )
}
