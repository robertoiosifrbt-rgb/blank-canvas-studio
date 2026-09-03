import { describe, expect, it } from 'vitest'
import { musclesByPart, parseMuscles } from './muscles'

describe('parseMuscles', () => {
  it('reads a single muscle', () => {
    expect(parseMuscles('Chest')).toEqual(['chest'])
  })

  it('reads a list', () => {
    expect(parseMuscles('Shoulders, Triceps')).toEqual(['shoulders', 'triceps'])
  })

  it('does not care about case or punctuation', () => {
    expect(parseMuscles('  QUADS / glutes  ')).toEqual(['glutes', 'quads'])
  })

  it('handles plurals either way round', () => {
    expect(parseMuscles('bicep')).toEqual(['biceps'])
    expect(parseMuscles('biceps')).toEqual(['biceps'])
  })

  /*
   * Substring matching is the trap here: "hammer" contains "ham", "abduction"
   * contains "ab", "calfskin" contains "calf". Matching whole words keeps a
   * hammer curl out of the hamstrings.
   */
  it('matches whole words, not fragments', () => {
    expect(parseMuscles('Hammer curl')).toEqual([])
    expect(parseMuscles('Hip abduction')).toEqual([])
    expect(parseMuscles('Backpack carry')).toEqual([])
  })

  it('reads two-word phrases before their parts', () => {
    expect(parseMuscles('Lower back')).toEqual(['lowerBack'])
    expect(parseMuscles('Upper back')).toEqual(['traps', 'lats'])
  })

  it('expands the coarse words people actually type', () => {
    expect(parseMuscles('Legs')).toEqual(['quads', 'hamstrings', 'calves'])
    expect(parseMuscles('Arms')).toEqual(['biceps', 'triceps'])
    expect(parseMuscles('Core')).toEqual(['abs', 'obliques'])
  })

  it('never repeats a muscle', () => {
    expect(parseMuscles('quads, quads and thighs')).toEqual(['quads', 'hamstrings'])
  })

  it('ignores words it does not know instead of guessing', () => {
    expect(parseMuscles('explosiveness')).toEqual([])
    expect(parseMuscles('')).toEqual([])
  })

  it('returns muscles in a stable order regardless of how they were written', () => {
    expect(parseMuscles('Triceps, Chest')).toEqual(parseMuscles('Chest, Triceps'))
  })
})

describe('musclesByPart', () => {
  it('groups the arm muscles together', () => {
    expect(musclesByPart('Arms')).toEqual(['biceps', 'triceps', 'forearms'])
  })

  it('puts every back muscle under Back', () => {
    expect(musclesByPart('Back')).toEqual(['traps', 'lats', 'lowerBack'])
  })
})
