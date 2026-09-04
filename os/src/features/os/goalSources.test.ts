import { beforeEach, describe, expect, it } from 'vitest'
import { resolveGoal } from './goalSources'
import type { Goal } from './types'

const measurements = (rows: Array<Record<string, unknown>>) =>
  localStorage.setItem('gym-app:measurements', JSON.stringify(rows))

const goal = (extra: Partial<Goal> = {}): Goal => ({
  id: 'g1', name: 'My best shape', kind: 'metric',
  start: 92, target: 84, source: 'gym:waistCm',
  reads: [{ id: 'r0', date: '2026-09-01', value: 92, note: 'Punct de pornire' }],
  ...extra,
})

describe('obiectivele legate de măsurătorile din sală', () => {
  beforeEach(() => localStorage.clear())

  it('își iau citirile din sală, fără să le copieze', () => {
    measurements([{ date: '2026-09-10', waistCm: 90 }, { date: '2026-09-20', waistCm: 88 }])
    const resolved = resolveGoal(goal())
    expect(resolved.reads?.map(r => r.value)).toEqual([92, 90, 88])
    /* Obiectivul salvat rămâne cu citirea lui de pornire. */
    expect(goal().reads).toHaveLength(1)
  })

  it('sar peste zilele în care câmpul ăla n-a fost completat', () => {
    measurements([{ date: '2026-09-10', weightKg: 88 }, { date: '2026-09-20', waistCm: 89 }])
    expect(resolveGoal(goal()).reads?.map(r => r.value)).toEqual([92, 89])
  })

  it('lasă deoparte măsurătorile dinaintea deciziei', () => {
    measurements([{ date: '2026-05-01', waistCm: 84 }, { date: '2026-09-15', waistCm: 90 }])
    expect(resolveGoal(goal()).reads?.map(r => r.value)).toEqual([92, 90])
  })

  it('le pun în ordine, oricum ar fi salvate', () => {
    measurements([{ date: '2026-09-20', waistCm: 88 }, { date: '2026-09-10', waistCm: 90 }])
    expect(resolveGoal(goal()).reads?.map(r => r.date))
      .toEqual(['2026-09-01', '2026-09-10', '2026-09-20'])
  })

  it('iau unitatea din măsurătoare, ca să nu fie de scris', () => {
    measurements([])
    expect(resolveGoal(goal({ unit: undefined })).unit).toBe('cm')
  })

  it('nu ating obiectivele scrise de mână', () => {
    measurements([{ date: '2026-09-10', waistCm: 90 }])
    const manual = goal({ source: undefined })
    expect(resolveGoal(manual)).toBe(manual)
  })

  it('nu cad pe o sursă care nu există', () => {
    measurements([{ date: '2026-09-10', waistCm: 90 }])
    expect(resolveGoal(goal({ source: 'gym:inventat' })).reads).toHaveLength(1)
  })

  it('nu cad pe măsurători stricate', () => {
    localStorage.setItem('gym-app:measurements', 'nu e json')
    expect(resolveGoal(goal()).reads).toHaveLength(1)
  })
})
