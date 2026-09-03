import { describe, expect, it } from 'vitest'
import { parseBounded, withinBounds } from './numbers'

const BOUNDS = { min: 1, max: 700 }

describe('parseBounded', () => {
  it('accepts a value inside the range', () => {
    expect(parseBounded('82.5', 'Weight', BOUNDS)).toEqual({ ok: true, value: 82.5 })
  })

  it('rejects an empty field instead of reading it as zero', () => {
    // `Number('')` is 0, which used to sneak an empty input through.
    expect(parseBounded('', 'Weight', BOUNDS).ok).toBe(false)
    expect(parseBounded('   ', 'Weight', BOUNDS).ok).toBe(false)
  })

  it('rejects negative values', () => {
    const result = parseBounded('-5', 'Weight', BOUNDS)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/between 1 and 700/)
  })

  it('rejects values above the maximum', () => {
    expect(parseBounded('101', 'Body fat', { min: 0, max: 100 }).ok).toBe(false)
  })

  it('rejects text that is not a number', () => {
    expect(parseBounded('abc', 'Weight', BOUNDS).ok).toBe(false)
  })

  it('rejects Infinity, including the form that looks like a number', () => {
    // A pasted `1e999` is a plausible-looking string that becomes Infinity.
    expect(parseBounded('1e999', 'Weight', BOUNDS).ok).toBe(false)
    expect(parseBounded('Infinity', 'Weight', BOUNDS).ok).toBe(false)
    expect(parseBounded('-Infinity', 'Weight', BOUNDS).ok).toBe(false)
  })

  it('names the field in its message so the user knows what to fix', () => {
    const result = parseBounded('-1', 'Left thigh (cm)', BOUNDS)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('Left thigh (cm)')
  })

  it('allows a bound to be hit exactly', () => {
    expect(parseBounded('0', 'Reps', { min: 0, max: 10 })).toEqual({ ok: true, value: 0 })
    expect(parseBounded('10', 'Reps', { min: 0, max: 10 })).toEqual({ ok: true, value: 10 })
  })
})

describe('withinBounds', () => {
  it('accepts finite numbers inside the range', () => {
    expect(withinBounds(80, BOUNDS)).toBe(true)
  })

  it('rejects NaN, Infinity, and non-numbers from stored data', () => {
    expect(withinBounds(Number.NaN, BOUNDS)).toBe(false)
    expect(withinBounds(Number.POSITIVE_INFINITY, BOUNDS)).toBe(false)
    expect(withinBounds('80', BOUNDS)).toBe(false)
    expect(withinBounds(null, BOUNDS)).toBe(false)
    expect(withinBounds(undefined, BOUNDS)).toBe(false)
  })

  it('rejects out-of-range numbers', () => {
    expect(withinBounds(-1, BOUNDS)).toBe(false)
    expect(withinBounds(1000, BOUNDS)).toBe(false)
  })
})
