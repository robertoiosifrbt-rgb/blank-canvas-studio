import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ExercisesPage } from './ExercisesPage'

const EXERCISES_KEY = 'gym-app:exercises'
const FIELD_TYPES_KEY = 'gym-app:field-types'
const WORKOUT_LOG_KEY = 'gym-app:workout-log'

function openCreate() {
  if (!screen.queryByLabelText('Name')) fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }))
}

function addExercise(name: string, trackLabels: string[] = ['Reps']) {
  openCreate()
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } })
  for (const label of trackLabels) fireEvent.click(screen.getByRole('checkbox', { name: label }))
  fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }))
}

function addCustomTrack(label: string, unit = '') {
  openCreate()
  fireEvent.click(screen.getByRole('button', { name: '+ Add' }))
  fireEvent.change(screen.getByPlaceholderText(/^Name/), { target: { value: label } })
  if (unit) fireEvent.change(screen.getByPlaceholderText(/^Unit/), { target: { value: unit } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
}

const storedExercises = () => JSON.parse(localStorage.getItem(EXERCISES_KEY) ?? '[]')
const storedFieldTypes = () => JSON.parse(localStorage.getItem(FIELD_TYPES_KEY) ?? '[]')

describe('ExercisesPage', () => {
  it('saves an exercise with the fields it tracks', () => {
    render(<ExercisesPage />)
    addExercise('Bench Press', ['Reps', 'Weight (kg)'])
    expect(storedExercises()).toHaveLength(1)
    expect(storedExercises()[0]).toMatchObject({ name: 'Bench Press', fields: ['reps', 'kg'] })
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
  })

  it('shows a newly added custom field type by name everywhere at once', () => {
    render(<ExercisesPage />)
    addCustomTrack('Incline', '%')
    expect(screen.getByRole('checkbox', { name: 'Incline' })).toBeChecked()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Incline Press' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }))
    const card = screen.getByText('Incline Press').closest('.exercise-card')!
    expect(card).toHaveTextContent('Incline')
    expect(card.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/)
  })

  it('keeps a custom field type after a reload', () => {
    const { unmount } = render(<ExercisesPage />)
    addCustomTrack('Incline')
    unmount()
    render(<ExercisesPage />)
    openCreate()
    expect(screen.getByRole('checkbox', { name: 'Incline' })).toBeInTheDocument()
  })

  it('reports a refused write and keeps the typed exercise', () => {
    render(<ExercisesPage />)
    openCreate()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('exceeded', 'QuotaExceededError') })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bench Press' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Reps' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }))
    expect(screen.getByText(/out of storage space/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Bench Press')
    expect(localStorage.getItem(EXERCISES_KEY)).toBeNull()
    setItem.mockRestore()
  })

  it('still renders when the stored exercises are corrupt', () => {
    localStorage.setItem(EXERCISES_KEY, 'not json at all')
    render(<ExercisesPage />)
    expect(screen.getByRole('heading', { name: 'Exercises' })).toBeInTheDocument()
    expect(screen.getByText(/unreadable/i)).toBeInTheDocument()
  })

  it('falls back to the default field types when the stored ones are corrupt', () => {
    localStorage.setItem(FIELD_TYPES_KEY, '{{{')
    render(<ExercisesPage />)
    openCreate()
    expect(screen.getByRole('checkbox', { name: 'Reps' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Weight (kg)' })).toBeInTheDocument()
  })
})

describe('Track removal', () => {
  it('archives the Track and removes its reference from existing exercises', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ExercisesPage />)
    addExercise('Bench Press', ['Reps', 'Weight (kg)'])
    fireEvent.click(screen.getByRole('button', { name: 'Edit Bench Press' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Weight (kg) from Tracks' }))
    expect(storedExercises()[0].fields).toEqual(['reps'])
    expect(storedFieldTypes().find((field: { id: string }) => field.id === 'kg')).toMatchObject({ archived: true })
    expect(screen.queryByRole('checkbox', { name: 'Weight (kg)' })).not.toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it('keeps workout history untouched when a Track is removed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ExercisesPage />)
    addExercise('Bench Press', ['Reps', 'Weight (kg)'])
    const exerciseId = storedExercises()[0].id
    const history = [{ id: 'entry-1', sessionId: 's1', date: '2026-07-15', exerciseId, exerciseName: 'Bench Press', sets: [{ reps: 8, kg: 80 }] }]
    localStorage.setItem(WORKOUT_LOG_KEY, JSON.stringify(history))
    fireEvent.click(screen.getByRole('button', { name: 'Edit Bench Press' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Weight (kg) from Tracks' }))
    expect(JSON.parse(localStorage.getItem(WORKOUT_LOG_KEY)!)).toEqual(history)
    vi.restoreAllMocks()
  })
})

describe('deleting an exercise', () => {
  it('asks before deleting and does nothing when cancelled', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ExercisesPage />)
    addExercise('Bench Press')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Bench Press' }))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(storedExercises()).toHaveLength(1)
    confirm.mockRestore()
  })

  it('deletes when confirmed while leaving logged workout history alone', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ExercisesPage />)
    addExercise('Bench Press')
    const exerciseId = storedExercises()[0].id
    const history = [{ id: 'entry-1', sessionId: 's1', date: '2026-07-15', exerciseId, exerciseName: 'Bench Press', sets: [{ reps: 8 }] }]
    localStorage.setItem(WORKOUT_LOG_KEY, JSON.stringify(history))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Bench Press' }))
    expect(storedExercises()).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem(WORKOUT_LOG_KEY)!)).toEqual(history)
    confirm.mockRestore()
  })
})

/*
 * Etapa 4: search, category chips, favourites and the FAB.
 *
 * `searchExercises.test.ts` covers the filtering rules themselves. These are
 * about the screen — that the controls are wired to that logic, that the star
 * survives a reload, and that an empty result says which of the three filters
 * is responsible instead of claiming the library is empty.
 */

const LIBRARY = [
  { id: 'a', name: 'Leg Press', fields: ['reps'], category: 'Legs', difficulty: '', equipment: 'Leg Press Machine', primaryMuscles: 'Quads', secondaryMuscles: 'Glutes', instructions: '' },
  { id: 'b', name: 'Bench Press', fields: ['reps'], category: 'Chest', difficulty: '', equipment: 'Barbell', primaryMuscles: 'Chest', secondaryMuscles: 'Triceps', instructions: '' },
  { id: 'c', name: 'Hammer Curl', fields: ['reps'], category: 'Arms', difficulty: '', equipment: 'Dumbbell', primaryMuscles: 'Biceps', secondaryMuscles: '', instructions: '' },
]

function renderWithLibrary() {
  localStorage.setItem(EXERCISES_KEY, JSON.stringify(LIBRARY))
  render(<ExercisesPage />)
}

const cardNames = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent)
const search = () => screen.getByLabelText('Search exercises')

describe('searching the library', () => {
  it('narrows the list as a name is typed', () => {
    renderWithLibrary()
    expect(cardNames()).toHaveLength(3)
    fireEvent.change(search(), { target: { value: 'ben' } })
    expect(cardNames()).toEqual(['Bench Press'])
  })

  it('finds an exercise by a muscle its name never mentions', () => {
    renderWithLibrary()
    fireEvent.change(search(), { target: { value: 'quads' } })
    expect(cardNames()).toEqual(['Leg Press'])
  })

  it('says the filter is responsible when nothing matches, not that the library is empty', () => {
    renderWithLibrary()
    fireEvent.change(search(), { target: { value: 'kettlebell' } })
    expect(screen.getByText('Nothing matches')).toBeInTheDocument()
    expect(screen.queryByText('No exercises yet')).not.toBeInTheDocument()
  })

  it('still says the library is empty when it actually is', () => {
    render(<ExercisesPage />)
    expect(screen.getByText('No exercises yet')).toBeInTheDocument()
  })

  it('reports how many of the library are showing', () => {
    renderWithLibrary()
    expect(screen.getByText('3 total')).toBeInTheDocument()
    fireEvent.change(search(), { target: { value: 'press' } })
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
  })
})

describe('category chips', () => {
  it('offers only the categories the library uses', () => {
    renderWithLibrary()
    for (const label of ['All', 'Legs', 'Chest', 'Arms']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Cardio' })).not.toBeInTheDocument()
  })

  it('filters to the chosen category and back', () => {
    renderWithLibrary()
    fireEvent.click(screen.getByRole('button', { name: 'Chest' }))
    expect(cardNames()).toEqual(['Bench Press'])
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(cardNames()).toHaveLength(3)
  })

  /*
   * Deleting the last exercise in a category removes its chip while it is
   * still the selection — without the fallback the screen would be empty with
   * no chip left to press to escape it.
   */
  it('falls back to All when the selected category stops existing', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderWithLibrary()
    fireEvent.click(screen.getByRole('button', { name: 'Chest' }))
    expect(cardNames()).toEqual(['Bench Press'])
    fireEvent.click(screen.getByRole('button', { name: 'Delete Bench Press' }))
    expect(screen.queryByRole('button', { name: 'Chest' })).not.toBeInTheDocument()
    expect(cardNames()).toEqual(['Leg Press', 'Hammer Curl'])
    vi.restoreAllMocks()
  })
})

describe('favourites', () => {
  const star = (name: string) => screen.getByRole('button', { name: `Add ${name} to favourites` })

  it('moves a starred exercise to the top of the list', () => {
    renderWithLibrary()
    expect(cardNames()).toEqual(['Leg Press', 'Bench Press', 'Hammer Curl'])
    fireEvent.click(star('Hammer Curl'))
    expect(cardNames()).toEqual(['Hammer Curl', 'Leg Press', 'Bench Press'])
  })

  it('keeps the star after a reload', () => {
    renderWithLibrary()
    fireEvent.click(star('Bench Press'))
    expect(storedExercises().find((e: { id: string }) => e.id === 'b')).toMatchObject({ favourite: true })
    cleanup()
    render(<ExercisesPage />)
    expect(screen.getByRole('button', { name: 'Remove Bench Press from favourites' })).toBeInTheDocument()
  })

  it('unstars without leaving the flag behind in storage', () => {
    renderWithLibrary()
    fireEvent.click(star('Bench Press'))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Bench Press from favourites' }))
    expect(storedExercises().find((e: { id: string }) => e.id === 'b')).not.toHaveProperty('favourite')
  })

  it('shows only favourites while the filter is on', () => {
    renderWithLibrary()
    fireEvent.click(star('Hammer Curl'))
    fireEvent.click(screen.getByRole('button', { name: 'Show favourites only' }))
    expect(cardNames()).toEqual(['Hammer Curl'])
    fireEvent.click(screen.getByRole('button', { name: 'Show favourites only' }))
    expect(cardNames()).toHaveLength(3)
  })

  it('reads a corrupt favourite flag as not starred rather than dropping the exercise', () => {
    localStorage.setItem(EXERCISES_KEY, JSON.stringify([{ ...LIBRARY[0], favourite: 'yes please' }]))
    render(<ExercisesPage />)
    expect(screen.getByRole('heading', { level: 3, name: 'Leg Press' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Leg Press to favourites' })).toBeInTheDocument()
  })
})

describe('the add button', () => {
  it('opens the form and hides itself, so only one Add exercise button exists at a time', () => {
    renderWithLibrary()
    expect(screen.getAllByRole('button', { name: 'Add exercise' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }))
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    // The remaining one is the form's submit button, not the floating button.
    expect(screen.getAllByRole('button', { name: 'Add exercise' })).toHaveLength(1)
    expect(document.querySelector('.exercise-fab')).toBeNull()
  })

  it('closes the form on cancel and brings the button back', () => {
    renderWithLibrary()
    fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
    expect(document.querySelector('.exercise-fab')).not.toBeNull()
  })
})
