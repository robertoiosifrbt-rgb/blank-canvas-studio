import { describe, expect, it } from 'vitest'
import { matches, searchCarCosts, searchDays, searchFuel } from './deliverySearch'
import { emptyOsData, type OsData } from './types'

function ready(): OsData {
  const data = emptyOsData()
  data.vehicles.v1 = { id: 'v1', name: 'Corsa', plate: 'AB12 CDE' }
  data.vehicles.v2 = { id: 'v2', name: 'Astra' }
  data.workdays.w1 = { id: 'w1', mod: 'livrari', date: '2026-09-01', vehicle: 'v1',
    notes: 'ploaie toată seara', done: true }
  data.workdays.w2 = { id: 'w2', mod: 'livrari', date: '2026-08-14', vehicle: 'v2', done: true }
  data.fuel.f1 = { id: 'f1', mod: 'livrari', date: '2026-09-02', vehicle: 'v1', litres: 40, cost: 62, full: true }
  data.carCosts.c1 = { id: 'c1', mod: 'livrari', date: '2026-09-03', vehicle: 'v1',
    category: 'Cauciucuri', what: 'două față', amount: 180 }
  data.carCosts.c2 = { id: 'c2', mod: 'livrari', date: '2026-07-01', category: 'Asigurare', amount: 600 }
  return data
}

describe('potrivirea cuvintelor', () => {
  it('cere fiecare cuvânt, nu oricare', () => {
    expect(matches('corsa cauciuc', ['Corsa', 'cauciucuri'])).toBe(true)
    expect(matches('corsa cauciuc', ['Astra', 'cauciucuri'])).toBe(false)
  })

  it('nu ține cont de literă mare sau mică', () => {
    expect(matches('CORSA', ['corsa'])).toBe(true)
  })

  it('lasă totul să treacă dacă nu cauți nimic', () => {
    expect(matches('   ', ['orice'])).toBe(true)
  })

  it('caută și prin numere', () => {
    expect(matches('180', ['Cauciucuri', 180])).toBe(true)
  })
})

describe('căutarea prin livrări', () => {
  it('găsește turele după mașină', () => {
    expect(searchDays(ready(), 'livrari', 'corsa').map(d => d.id)).toEqual(['w1'])
  })

  it('găsește turele după lună', () => {
    expect(searchDays(ready(), 'livrari', '2026-08').map(d => d.id)).toEqual(['w2'])
  })

  it('găsește turele după note', () => {
    expect(searchDays(ready(), 'livrari', 'ploaie').map(d => d.id)).toEqual(['w1'])
  })

  it('le dă pe toate când nu cauți nimic', () => {
    expect(searchDays(ready(), 'livrari', '')).toHaveLength(2)
  })

  it('găsește alimentările după mașină și după plin', () => {
    expect(searchFuel(ready(), 'corsa plin').map(f => f.id)).toEqual(['f1'])
  })

  it('găsește cheltuielile după ce sunt', () => {
    expect(searchCarCosts(ready(), 'livrari', 'cauciuc').map(c => c.id)).toEqual(['c1'])
    expect(searchCarCosts(ready(), 'livrari', 'asigurare').map(c => c.id)).toEqual(['c2'])
  })

  it('nu trece dintr-un modul în altul', () => {
    const data = ready()
    data.carCosts.c1.mod = 'altceva'
    expect(searchCarCosts(data, 'livrari', 'cauciuc')).toHaveLength(0)
  })

  it('nu dă nimic pentru un cuvânt care nu există nicăieri', () => {
    const data = ready()
    expect(searchDays(data, 'livrari', 'tractor')).toHaveLength(0)
    expect(searchFuel(data, 'tractor')).toHaveLength(0)
    expect(searchCarCosts(data, 'livrari', 'tractor')).toHaveLength(0)
  })
})
