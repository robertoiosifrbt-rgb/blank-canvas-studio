import { describe, expect, it } from 'vitest'
import { businessPart, carCostsOf, dailyShare, directOn } from './carCosts'
import { totalsOf } from './delivery'
import { DEFAULT_RATES } from './delivery'
import { emptyOsData, type CarExpense, type OsData } from './types'

const cost = (extra: Partial<CarExpense> = {}): CarExpense =>
  ({ id: 'c1', mod: 'livrari', date: '2026-09-01', amount: 100, ...extra })

describe('partea de business', () => {
  it('e toată, când nu spui altfel', () => {
    expect(businessPart(cost())).toBe(100)
  })

  it('e cât ai spus, când mașina e și personală', () => {
    expect(businessPart(cost({ businessPct: 0.7 }))).toBeCloseTo(70, 6)
  })
})

describe('cheltuielile întinse pe o perioadă', () => {
  const insurance = cost({ id: 'ins', amount: 365, from: '2026-01-01', to: '2026-12-31' })

  it('cad câte puțin pe fiecare zi acoperită', () => {
    expect(dailyShare([insurance], '2026-06-15')).toBeCloseTo(1, 6)
  })

  it('nu cad în afara perioadei', () => {
    expect(dailyShare([insurance], '2025-12-31')).toBe(0)
    expect(dailyShare([insurance], '2027-01-01')).toBe(0)
  })

  it('se împart după partea de business, nu după suma plătită', () => {
    const half = cost({ id: 'h', amount: 365, businessPct: 0.5, from: '2026-01-01', to: '2026-12-31' })
    expect(dailyShare([half], '2026-06-15')).toBeCloseTo(0.5, 6)
  })

  it('o perioadă de o zi cade toată în ziua aia', () => {
    const one = cost({ id: 'o', amount: 50, from: '2026-09-01', to: '2026-09-01' })
    expect(dailyShare([one], '2026-09-01')).toBeCloseTo(50, 6)
  })

  it('se adună, când sunt mai multe deodată', () => {
    const road = cost({ id: 'r', amount: 100, from: '2026-01-01', to: '2026-12-31' })
    expect(dailyShare([insurance, road], '2026-06-15')).toBeCloseTo(1 + 100 / 365, 6)
  })
})

describe('cheltuielile directe', () => {
  it('cad în ziua lor, și numai în ea', () => {
    const repair = cost({ id: 'rep', date: '2026-09-03', amount: 200 })
    expect(directOn([repair], '2026-09-03')).toHaveLength(1)
    expect(directOn([repair], '2026-09-04')).toHaveLength(0)
  })

  it('nu se numără de două ori: una cu perioadă nu e directă', () => {
    const spread = cost({ id: 's', date: '2026-09-03', from: '2026-09-01', to: '2026-09-30' })
    expect(directOn([spread], '2026-09-03')).toHaveLength(0)
  })
})

describe('cheltuielile cu mașina, în socoteala unei ture', () => {
  function ready(items: CarExpense[]): OsData {
    const data = emptyOsData()
    data.settings.delivery = DEFAULT_RATES
    for (const item of items) data.carCosts[item.id] = item
    data.workdays.w1 = {
      id: 'w1', mod: 'livrari', date: '2026-09-03', from: '10:00', to: '18:00',
      odoStart: 0, odoEnd: 100, uber: 200, done: false,
    }
    return data
  }

  it('intră singure, fără să le scrii pe tură', () => {
    const data = ready([cost({ id: 'rep', date: '2026-09-03', amount: 60 })])
    expect(totalsOf(data, data.workdays.w1).expenses).toBeCloseTo(60, 6)
  })

  it('aduc partea zilei din cele întinse', () => {
    const data = ready([cost({ id: 'ins', date: '2026-01-01', amount: 365, from: '2026-01-01', to: '2026-12-31' })])
    expect(totalsOf(data, data.workdays.w1).recurring).toBeCloseTo(1, 6)
  })

  it('nu ating turele din afara perioadei sau din altă zi', () => {
    const data = ready([cost({ id: 'rep', date: '2026-08-01', amount: 500 })])
    const t = totalsOf(data, data.workdays.w1)
    expect(t.expenses).toBe(0)
    expect(t.recurring).toBe(0)
  })

  it('sunt ale modulului lor, nu ale altuia', () => {
    const data = ready([cost({ id: 'rep', mod: 'altceva', date: '2026-09-03', amount: 60 })])
    expect(totalsOf(data, data.workdays.w1).expenses).toBe(0)
    expect(carCostsOf(data, 'livrari')).toHaveLength(0)
  })
})
