import type { Exercise } from './types'

/**
 * The library search.
 *
 * Matches on more than the name on purpose: the owner types what they
 * remember, and that is as often "dumbbell" or "quads" as it is the exercise's
 * name. Equipment and the two muscle fields are already filled in for most
 * entries, so searching them costs nothing and finds things the name cannot —
 * "quads" turns up Leg Press, which does not contain the word.
 *
 * Every term has to match somewhere, but not all in the same field: "dumbbell
 * chest" finds a dumbbell exercise categorised Chest. Terms are matched as
 * substrings rather than whole words, because half-typed words are the normal
 * state of a search box — "ben" should already be showing Bench Press.
 */

/** Where a search term is allowed to match. */
function haystack(exercise: Exercise): string {
  return [
    exercise.name,
    exercise.category,
    exercise.equipment,
    exercise.primaryMuscles,
    exercise.secondaryMuscles,
  ]
    .join(' ')
    .toLowerCase()
}

export function matchesSearch(exercise: Exercise, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const text = haystack(exercise)
  return terms.every((term) => text.includes(term))
}

interface FilterOptions {
  query?: string
  /** A category name, or `all`. */
  category?: string
  /** When true, only exercises marked favourite. */
  favouritesOnly?: boolean
}

/**
 * Search, category and the favourites toggle, applied together, then ordered
 * with favourites first.
 *
 * Favourites lead because that is the only thing the star can usefully do — a
 * mark that changed nothing but the icon would not be worth the tap. Within
 * each group the library's own order is kept, so nothing else moves around
 * under the finger.
 */
export function filterExercises(exercises: Exercise[], options: FilterOptions = {}): Exercise[] {
  const { query = '', category = 'all', favouritesOnly = false } = options

  const matching = exercises.filter((exercise) => {
    if (category !== 'all' && exercise.category !== category) return false
    if (favouritesOnly && !exercise.favourite) return false
    return matchesSearch(exercise, query)
  })

  // A stable partition, not a sort: `Array.prototype.sort` is stable in every
  // engine we target, but saying it in two filters removes the question.
  return [...matching.filter((e) => e.favourite), ...matching.filter((e) => !e.favourite)]
}

/**
 * The categories to offer as chips: everything the library actually uses, in
 * the order the exercises were added, behind `all`.
 *
 * Only categories in use — an empty chip is a dead end, and the owner types
 * their own categories, so a fixed list would go stale.
 */
export function categoriesInUse(exercises: Exercise[]): string[] {
  return ['all', ...new Set(exercises.map((e) => e.category).filter(Boolean))]
}
