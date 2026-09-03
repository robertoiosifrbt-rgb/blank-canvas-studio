import { describe, expect, it } from 'vitest'
import { parseMeasurement } from './types'

const valid = {
  id: 'm1',
  date: '2026-07-15',
  weightKg: 82.4,
  heightCm: 178,
  bodyFatPercent: 18.2,
  waistCm: 84,
}

describe('parseMeasurement', () => {
  it('keeps a valid entry as it is', () => {
    expect(parseMeasurement(valid)).toEqual({ value: valid, lossy: false })
  })

  it('drops entries that are not objects', () => {
    expect(parseMeasurement(null)).toBeNull()
    expect(parseMeasurement('82kg')).toBeNull()
    expect(parseMeasurement([valid])).toBeNull()
  })

  it('drops entries missing the fields that give them meaning', () => {
    expect(parseMeasurement({ ...valid, id: '' })).toBeNull()
    expect(parseMeasurement({ ...valid, date: undefined })).toBeNull()
    expect(parseMeasurement({ ...valid, weightKg: undefined })).toBeNull()
  })

  it('drops entries whose date is not a real calendar day', () => {
    expect(parseMeasurement({ ...valid, date: '15/07/2026' })).toBeNull()
    expect(parseMeasurement({ ...valid, date: '2026-02-31' })).toBeNull()
    expect(parseMeasurement({ ...valid, date: '2026-13-01' })).toBeNull()
  })

  it('drops entries with an impossible body weight', () => {
    expect(parseMeasurement({ ...valid, weightKg: -5 })).toBeNull()
    expect(parseMeasurement({ ...valid, weightKg: 0 })).toBeNull()
    expect(parseMeasurement({ ...valid, weightKg: 5000 })).toBeNull()
    expect(parseMeasurement({ ...valid, weightKg: '82' })).toBeNull()
  })

  it('rejects Infinity arriving through JSON', () => {
    // JSON has no Infinity literal, but 1e999 parses to one.
    const parsed: unknown = JSON.parse('{"id":"m1","date":"2026-07-15","weightKg":1e999}')
    expect(parseMeasurement(parsed)).toBeNull()
  })

  /*
   * A single corrupt circumference must not cost the whole weigh-in: the
   * weight is the part of the history worth protecting, so the bad value is
   * blanked and the entry is flagged as repaired.
   */
  it('blanks an out-of-range optional value but keeps the entry', () => {
    const result = parseMeasurement({ ...valid, bodyFatPercent: 420 })

    expect(result).not.toBeNull()
    expect(result?.value.weightKg).toBe(82.4)
    expect(result?.value.bodyFatPercent).toBeUndefined()
    expect(result?.lossy).toBe(true)
  })

  it('treats a missing optional value as simply absent, not as damage', () => {
    const result = parseMeasurement({ id: 'm1', date: '2026-07-15', weightKg: 80 })

    expect(result?.lossy).toBe(false)
    expect(result?.value.waistCm).toBeUndefined()
  })

  it('allows a body fat of exactly 0 and rejects one above 100', () => {
    expect(parseMeasurement({ ...valid, bodyFatPercent: 0 })?.value.bodyFatPercent).toBe(0)
    expect(parseMeasurement({ ...valid, bodyFatPercent: 100.1 })?.value.bodyFatPercent).toBeUndefined()
  })
})
