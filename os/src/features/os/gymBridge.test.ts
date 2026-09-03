import { beforeEach, describe, expect, it } from 'vitest'
import { gymMeasurements, gymSessions } from './gymBridge'
import { dayItems } from './calendar'
import { emptyOsData } from './types'

describe('puntea către sală', () => {
  beforeEach(() => localStorage.clear())

  it('citește sesiunile de antrenament', () => {
    localStorage.setItem('gym-app:workout-sessions',
      JSON.stringify([{ id: 's1', date: '2026-09-03', name: 'Push and abs' }]))
    expect(gymSessions()).toEqual([{ date: '2026-09-03', name: 'Push and abs' }])
  })

  it('nu cade pe date stricate', () => {
    localStorage.setItem('gym-app:workout-sessions', 'nu e json')
    localStorage.setItem('gym-app:measurements', JSON.stringify({ nu: 'e listă' }))
    expect(gymSessions()).toEqual([])
    expect(gymMeasurements()).toEqual([])
  })

  it('sare peste intrările fără dată', () => {
    localStorage.setItem('gym-app:measurements',
      JSON.stringify([{ id: 'm1', weightKg: 92 }, { id: 'm2', date: '2026-09-01', weightKg: 91 }]))
    expect(gymMeasurements()).toHaveLength(1)
  })

  it('antrenamentele apar în calendarul comun', () => {
    localStorage.setItem('gym-app:workout-sessions',
      JSON.stringify([{ id: 's1', date: '2026-09-03', name: 'Pull and abs' }]))
    localStorage.setItem('gym-app:measurements',
      JSON.stringify([{ id: 'm1', date: '2026-09-03', weightKg: 91, bodyFatPercent: 19.2 }]))
    const items = dayItems(emptyOsData(), '2026-09-03')
    expect(items.map(i => i.title)).toEqual(['Pull and abs', 'Măsurătoare'])
    expect(items[1].sub).toBe('91 kg · 19.2%')
  })
})
