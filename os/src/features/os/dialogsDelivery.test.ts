import { describe, expect, it } from 'vitest'
import { deliveryDialogs } from './dialogsDelivery'
import { DEFAULT_RATES, daysOf, summarise, totalsOf } from './delivery'
import { emptyOsData, type OsData, type Workday } from './types'

function run(spec: { fields: Array<{ key: string; value?: string }>
  submit: (v: Record<string, string>) => string | void }, typed: Record<string, string> = {}) {
  const values: Record<string, string> = {}
  for (const field of spec.fields) values[field.key] = field.value ?? ''
  Object.assign(values, typed)
  return spec.submit(values)
}

const dialogs = (data: OsData) => deliveryDialogs(data, change => change(data))

function ready(): OsData {
  const data = emptyOsData()
  data.settings.delivery = DEFAULT_RATES
  data.debts.d1 = { id: 'd1', mod: 'datorii', name: 'Card', direction: 'owe', total: 900, status: 'Activă' }
  const day: Workday = {
    id: 'w1', mod: 'livrari', date: '2026-09-01', from: '10:00', to: '18:00',
    odoStart: 0, odoEnd: 100, uber: 90, parking: 5, done: false,
  }
  data.workdays.w1 = day
  return data
}

describe('închiderea unei ture', () => {
  it('scrie brutul ca venit și cheltuielile ca cheltuială, o dată fiecare', () => {
    const data = ready()
    const totals = totalsOf(data, data.workdays.w1)
    run(dialogs(data).finish(data.workdays.w1), { toDebt: '0' })
    const items = data.finance['2026-09'].items
    expect(items.filter(i => i.type === 'in')).toHaveLength(1)
    expect(items.find(i => i.type === 'in')?.amount).toBeCloseTo(totals.gross, 6)
    expect(items.find(i => i.type === 'out')?.amount).toBeCloseTo(totals.totalExpenses, 6)
  })

  it('îngheață procentele, ca o setare de mâine să nu rescrie ziua', () => {
    const data = ready()
    run(dialogs(data).finish(data.workdays.w1), { toDebt: '0' })
    expect(data.workdays.w1.rates).toEqual(DEFAULT_RATES)
    expect(data.workdays.w1.done).toBe(true)
  })

  it('trimite banii la datoria aleasă, marcați cu ea', () => {
    const data = ready()
    run(dialogs(data).finish(data.workdays.w1), { toDebt: '30', debt: 'd1' })
    const payment = data.finance['2026-09'].items.find(i => i.debt === 'd1')
    expect(payment?.amount).toBe(30)
    expect(payment?.type).toBe('out')
  })

  it('nu scrie plata dacă n-ai ales o datorie', () => {
    const data = ready()
    run(dialogs(data).finish(data.workdays.w1), { toDebt: '30', debt: '' })
    expect(data.finance['2026-09'].items.some(i => i.debt)).toBe(false)
  })

  it('propune exact cât a rămas după rezerve', () => {
    const data = ready()
    const spec = dialogs(data).finish(data.workdays.w1)
    const suggested = spec.fields.find(f => f.key === 'toDebt')?.value
    expect(Number(suggested)).toBeCloseTo(totalsOf(data, data.workdays.w1).available, 2)
  })

  it('mișcările poartă id-ul turei, ca să poată fi luate înapoi exact', () => {
    const data = ready()
    run(dialogs(data).finish(data.workdays.w1), { toDebt: '0' })
    expect(data.finance['2026-09'].items.every(i => i.id.endsWith('-w1'))).toBe(true)
  })
})

describe('procentele de livrări', () => {
  it('se scriu ca numere întregi și se țin ca fracții', () => {
    const data = ready()
    run(dialogs(data).settings(), { taxPct: '25', niPct: '9', fuelPerKm: '0.15', vehPerKm: '0.06' })
    expect(data.settings.delivery).toEqual({ taxPct: 0.25, niPct: 0.09, fuelPerKm: 0.15, vehPerKm: 0.06 })
  })
})

describe('intrările vechi din istoric', () => {
  it('nu scriu nimic în Finanțe', () => {
    const data = ready()
    data.workdays.w1.archived = true
    run(dialogs(data).finish(data.workdays.w1))
    expect(data.finance['2026-09']).toBeUndefined()
  })

  it('se închid totuși, cu procentele lor', () => {
    const data = ready()
    data.workdays.w1.archived = true
    run(dialogs(data).finish(data.workdays.w1))
    expect(data.workdays.w1.done).toBe(true)
    expect(data.workdays.w1.rates).toEqual(DEFAULT_RATES)
  })

  it('nu întreabă la ce datorie merg banii, pentru că nu merg nicăieri', () => {
    const data = ready()
    data.workdays.w1.archived = true
    expect(dialogs(data).finish(data.workdays.w1).fields).toEqual([])
  })

  it('spun în fereastră că nu ating Finanțele', () => {
    const data = ready()
    data.workdays.w1.archived = true
    expect(String(dialogs(data).finish(data.workdays.w1).note)).toContain('nu se scrie nimic în Finanțe')
  })

  it('se socotesc ca oricare altă tură', () => {
    const data = ready()
    data.workdays.w1.archived = true
    data.workdays.w1.done = true
    expect(summarise(data, daysOf(data, 'livrari')).days).toBe(1)
  })
})
