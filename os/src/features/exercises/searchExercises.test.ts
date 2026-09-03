import { describe, expect, it } from 'vitest'
import { categoriesInUse, filterExercises, matchesSearch } from './searchExercises'
import type { Exercise } from './types'

function exercise(name: string, extra: Partial<Exercise> = {}): Exercise {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    fields: ['reps'],
    category: '',
    difficulty: '',
    equipment: '',
    primaryMuscles: '',
    secondaryMuscles: '',
    instructions: '',
    ...extra,
  }
}

const LIBRARY = [
  exercise('Leg Press', { category: 'Legs', equipment: 'Leg Press Machine', primaryMuscles: 'Quads', secondaryMuscles: 'Glutes' }),
  exercise('Bench Press', { category: 'Chest', equipment: 'Barbell', primaryMuscles: 'Chest', secondaryMuscles: 'Triceps' }),
  exercise('Hammer Curl', { category: 'Arms', equipment: 'Dumbbell', primaryMuscles: 'Biceps' }),
  exercise('Lat Pulldown', { category: 'Back', equipment: 'Cable Machine', primaryMuscles: 'Lats', secondaryMuscles: 'Biceps' }),
]

describe('matchesSearch', () => {
  it('matches an empty query against everything', () => {
    expect(LIBRARY.every((e) => matchesSearch(e, ''))).toBe(true)
    expect(LIBRARY.every((e) => matchesSearch(e, '   '))).toBe(true)
  })

  it('matches a half-typed name, so results narrow as you type', () => {
    expect(matchesSearch(LIBRARY[1], 'ben')).toBe(true)
    expect(matchesSearch(LIBRARY[1], 'bench pr')).toBe(true)
  })

  it('ignores case', () => {
    expect(matchesSearch(LIBRARY[0], 'LEG press')).toBe(true)
  })

  /*
   * The point of searching more than the name. "quads" has to find Leg Press,
   * whose name says nothing about quads — that is the search the owner will
   * actually type when they cannot remember what the machine is called.
   */
  it('finds an exercise by a muscle its name never mentions', () => {
    expect(matchesSearch(LIBRARY[0], 'quads')).toBe(true)
    expect(matchesSearch(LIBRARY[3], 'lats')).toBe(true)
  })

  it('finds an exercise by equipment', () => {
    expect(matchesSearch(LIBRARY[2], 'dumbbell')).toBe(true)
  })

  it('requires every term, but lets them land in different fields', () => {
    // "dumbbell" is the equipment, "arms" the category — neither is the name.
    expect(matchesSearch(LIBRARY[2], 'dumbbell arms')).toBe(true)
    expect(matchesSearch(LIBRARY[2], 'dumbbell chest')).toBe(false)
  })

  it('does not match a term that appears nowhere', () => {
    expect(matchesSearch(LIBRARY[0], 'kettlebell')).toBe(false)
  })
})

describe('filterExercises', () => {
  it('returns everything when nothing is filtering', () => {
    expect(filterExercises(LIBRARY)).toHaveLength(4)
  })

  it('narrows to one category', () => {
    expect(filterExercises(LIBRARY, { category: 'Chest' }).map((e) => e.name)).toEqual(['Bench Press'])
  })

  it('combines the search with the category', () => {
    // "biceps" alone matches Hammer Curl and Lat Pulldown; Back keeps one.
    expect(filterExercises(LIBRARY, { query: 'biceps', category: 'Back' }).map((e) => e.name))
      .toEqual(['Lat Pulldown'])
  })

  it('shows only favourites when asked', () => {
    const starred = LIBRARY.map((e) => (e.name === 'Hammer Curl' ? { ...e, favourite: true } : e))

    expect(filterExercises(starred, { favouritesOnly: true }).map((e) => e.name)).toEqual(['Hammer Curl'])
  })

  /*
   * Favourites lead the list. Without this the star changes an icon and
   * nothing else, which is not worth a tap.
   */
  it('puts favourites first, keeping library order within each group', () => {
    const starred = LIBRARY.map((e) => (['Lat Pulldown', 'Bench Press'].includes(e.name) ? { ...e, favourite: true } : e))

    expect(filterExercises(starred).map((e) => e.name))
      .toEqual(['Bench Press', 'Lat Pulldown', 'Leg Press', 'Hammer Curl'])
  })

  it('does not reorder anything when nothing is starred', () => {
    expect(filterExercises(LIBRARY).map((e) => e.name)).toEqual(LIBRARY.map((e) => e.name))
  })
})

describe('categoriesInUse', () => {
  it('lists all before the categories the library actually uses, without repeats', () => {
    const withDuplicate = [...LIBRARY, exercise('Squat', { category: 'Legs' })]

    expect(categoriesInUse(withDuplicate)).toEqual(['all', 'Legs', 'Chest', 'Arms', 'Back'])
  })

  it('skips exercises with no category, so there is no blank chip', () => {
    expect(categoriesInUse([exercise('Plank'), ...LIBRARY])).not.toContain('')
  })

  it('is just all for an empty library', () => {
    expect(categoriesInUse([])).toEqual(['all'])
  })
})
