import { describe, expect, it } from 'vitest'
import { fuelRate, intervalsOf, pricePerLitre } from './fuelChain'
import { emptyOsData, type Fuel, type OsData } from './types'

const fill = (odometer: number, litres: number, cost: number, full: boolean, date = '2026-09-01'): Fuel =>
  ({ id: `f${odometer}`, mod: 'livrari', date, vehicle: 'v1', odometer, litres, cost, full })

function withFuel(items: Fuel[]): OsData {
  const data = emptyOsData()
  data.vehicles.v1 = { id: 'v1', name: 'Corsa' }
  for (const item of items) data.fuel[item.id] = item
  return data
}

describe('lanțul de alimentări', () => {
  it('socotește un interval între două plinuri', () => {
    const data = withFuel([fill(1000, 40, 60, true), fill(1500, 40, 62, true)])
    const [interval] = intervalsOf(data, 'v1')
    expect(interval.km).toBe(500)
    expect(interval.litres).toBe(40)
    expect(interval.costPerKm).toBeCloseTo(62 / 500, 6)
  })

  it('adună alimentările parțiale la intervalul lor', () => {
    const data = withFuel([
      fill(1000, 40, 60, true),
      fill(1200, 20, 30, false),
      fill(1500, 25, 40, true),
    ])
    const [interval] = intervalsOf(data, 'v1')
    expect(interval.litres).toBe(45)
    expect(interval.cost).toBe(70)
    expect(interval.costPerKm).toBeCloseTo(70 / 500, 6)
  })

  it('nu socotește nimic dintr-un singur plin', () => {
    expect(intervalsOf(withFuel([fill(1000, 40, 60, true)]), 'v1')).toEqual([])
  })

  it('dă litri la 100 km și mile pe galon', () => {
    const data = withFuel([fill(5000, 0, 0, true), fill(6000, 60, 90, true)])
    const [interval] = intervalsOf(data, 'v1')
    expect(interval.litresPer100Km).toBeCloseTo(6, 6)
    expect(interval.mpg).toBeCloseTo((1000 * 0.621371) / (60 / 4.54609), 4)
  })

  it('lasă afară o alimentare fără kilometraj, în loc s-o pună unde nu e', () => {
    const data = withFuel([
      fill(1000, 40, 60, true),
      { id: 'fara', mod: 'livrari', date: '2026-09-03', vehicle: 'v1', litres: 30, cost: 45, full: true },
      fill(1500, 40, 62, true),
    ])
    const [interval] = intervalsOf(data, 'v1')
    expect(interval.km).toBe(500)
    expect(interval.litres).toBe(40)
  })

  it('merge pe kilometraj, nu pe ordinea în care ai scris', () => {
    const data = withFuel([
      fill(1500, 40, 62, true, '2026-09-05'),
      fill(1000, 40, 60, true, '2026-09-01'),
    ])
    expect(intervalsOf(data, 'v1')[0].km).toBe(500)
  })

  it('nu amestecă mașinile', () => {
    const data = withFuel([fill(1000, 40, 60, true), fill(1500, 40, 62, true)])
    data.vehicles.v2 = { id: 'v2', name: 'Duba' }
    data.fuel.other = { id: 'other', mod: 'livrari', date: '2026-09-02', vehicle: 'v2', odometer: 1200, litres: 50, cost: 80, full: true }
    expect(intervalsOf(data, 'v1')).toHaveLength(1)
    expect(intervalsOf(data, 'v2')).toHaveLength(0)
  })
})

describe('costul pe kilometru', () => {
  it('vine din ultimul interval închis', () => {
    const data = withFuel([
      fill(1000, 40, 60, true), fill(1500, 40, 50, true), fill(2000, 40, 80, true),
    ])
    const rate = fuelRate(data, 'v1')
    expect(rate.known).toBe(true)
    expect(rate.costPerKm).toBeCloseTo(80 / 500, 6)
  })

  it('spune de unde vine, ca să poți verifica', () => {
    const data = withFuel([fill(1000, 40, 60, true), fill(1500, 40, 62, true)])
    expect(fuelRate(data, 'v1').source).toContain('1000–1500')
  })

  it('spune limpede când nu se poate ști, în loc să inventeze', () => {
    const rate = fuelRate(withFuel([fill(1000, 40, 60, true)]), 'v1')
    expect(rate.known).toBe(false)
    expect(rate.costPerKm).toBe(0)
    expect(rate.source).toContain('două plinuri')
  })
})

describe('prețul pe litru', () => {
  it('iese din cât ai plătit și câți litri', () => {
    expect(pricePerLitre(fill(1000, 40, 60, true))).toBeCloseTo(1.5, 6)
  })

  it('e zero, nu infinit, la zero litri', () => {
    expect(pricePerLitre(fill(1000, 0, 60, true))).toBe(0)
  })
})
