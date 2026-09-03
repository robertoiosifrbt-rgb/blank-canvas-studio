import { describe, expect, it } from 'vitest'
import { byDateDesc, formatDelta, latestDate, measurementRows, CIRCUMFERENCE_FIELDS, COMPOSITION_FIELDS } from './measurementStats'
import type { Measurement } from './types'

function m(date: string, over: Partial<Measurement> = {}): Measurement {
  return { id: date, date, weightKg: 80, ...over }
}

describe('byDateDesc', () => {
  /*
   * Ordered by date, not by insertion. Adding a measurement you forgot to log
   * last month must not make it "the latest".
   */
  it('puts the most recent calendar date first, whatever order they were saved in', () => {
    const out = byDateDesc([m('2026-07-15'), m('2026-08-01'), m('2026-06-30')])

    expect(out.map((x) => x.date)).toEqual(['2026-08-01', '2026-07-15', '2026-06-30'])
  })

  it('does not mutate the array it was given', () => {
    const input = [m('2026-07-15'), m('2026-08-01')]
    byDateDesc(input)

    expect(input.map((x) => x.date)).toEqual(['2026-07-15', '2026-08-01'])
  })
})

describe('measurementRows', () => {
  it('is empty when nothing has been measured', () => {
    expect(measurementRows([], COMPOSITION_FIELDS)).toEqual([])
  })

  it('reports the change against the previous measurement', () => {
    const rows = measurementRows(
      [m('2026-07-15', { weightKg: 78.2 }), m('2026-08-01', { weightKg: 77.1 })],
      COMPOSITION_FIELDS,
    )

    expect(rows).toEqual([{ key: 'weightKg', label: 'Weight', unit: 'kg', value: 77.1, delta: -1.1 }])
  })

  /*
   * `77.1 - 78.35` is `-1.2500000000000018` in binary floating point. A tape
   * measure is not that precise and neither is the card.
   */
  it('rounds equally in both directions, so ±1.25 is not ±1.3 one way and ±1.2 the other', () => {
    const down = measurementRows([m('2026-07-15', { weightKg: 78.35 }), m('2026-08-01', { weightKg: 77.1 })], COMPOSITION_FIELDS)
    const up = measurementRows([m('2026-07-15', { weightKg: 77.1 }), m('2026-08-01', { weightKg: 78.35 })], COMPOSITION_FIELDS)

    expect(down[0].delta).toBe(-1.3)
    expect(up[0].delta).toBe(1.3)
  })

  it('rounds the difference to one decimal', () => {
    const [row] = measurementRows(
      [m('2026-07-15', { weightKg: 78.35 }), m('2026-08-01', { weightKg: 77.1 })],
      COMPOSITION_FIELDS,
    )

    expect(row.delta).toBe(-1.3)
  })

  it('gives the first measurement no delta rather than a zero', () => {
    const [row] = measurementRows([m('2026-08-01', { weightKg: 77.1 })], COMPOSITION_FIELDS)

    expect(row.delta).toBeNull()
  })

  /*
   * A field left blank last time has nothing to compare against, even though
   * earlier measurements exist. Zero would claim it had not changed.
   */
  it('gives a field no delta when the previous measurement left it empty', () => {
    const rows = measurementRows(
      [m('2026-07-15', { weightKg: 78 }), m('2026-08-01', { weightKg: 77, waistCm: 84 })],
      CIRCUMFERENCE_FIELDS,
    )

    expect(rows).toEqual([{ key: 'waistCm', label: 'Waist', unit: 'cm', value: 84, delta: null }])
  })

  it('leaves out fields the latest measurement does not have', () => {
    const rows = measurementRows([m('2026-08-01', { weightKg: 77 })], CIRCUMFERENCE_FIELDS)

    expect(rows).toEqual([])
  })

  it('keeps the order the fields were listed in', () => {
    const full = { chestCm: 104, waistCm: 86, hipsCm: 98, neckCm: 40 }
    const rows = measurementRows([m('2026-08-01', full)], CIRCUMFERENCE_FIELDS)

    expect(rows.map((r) => r.label)).toEqual(['Chest', 'Waist', 'Hips', 'Neck'])
  })
})

describe('latestDate', () => {
  it('is the most recent date, not the last one stored', () => {
    expect(latestDate([m('2026-08-01'), m('2026-08-12'), m('2026-07-01')])).toBe('2026-08-12')
  })

  it('is empty when there is nothing measured', () => {
    expect(latestDate([])).toBe('')
  })
})

describe('formatDelta', () => {
  it('always carries a sign, so a gain and a loss are never confused', () => {
    expect(formatDelta(1.3)).toBe('+1.3')
    expect(formatDelta(-1.3)).toBe('−1.3')
  })

  it('uses the typographic minus rather than a hyphen', () => {
    expect(formatDelta(-1.3)).toContain('−')
    expect(formatDelta(-1.3)).not.toContain('-')
  })

  it('says plain zero rather than +0', () => {
    expect(formatDelta(0)).toBe('0')
  })
})
