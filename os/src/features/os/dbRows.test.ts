import { describe, expect, it } from 'vitest'
import { changesBetween, fromRows, isEmpty, toRows, TABLES } from './dbRows'
import { emptyOsData, type OsData } from './types'

/** O stare cu câte ceva din fiecare, ca traducerea să fie pusă la treabă. */
function full(): OsData {
  const data = emptyOsData()
  data.settings = {
    currency: '£', seeded: true, alerts: { lead: 2, hour: 8 },
    delivery: { taxPct: 0.2, niPct: 0.06, fuelPerKm: 0.12, vehPerKm: 0.05 },
  }
  data.modules.m1 = { id: 'm1', name: 'Business', kind: 'area', createdAt: '2026-01-01T10:00:00.000Z' }
  data.modules.m2 = { id: 'm2', name: 'Livrări', kind: 'delivery', parent: 'm1' }
  data.goals.g1 = {
    id: 'g1', name: '100k', kind: 'sum', target: 100000, main: true, habits: ['h1'],
    contrib: [{ id: 'c1', date: '2026-08-01', amount: 500, note: 'din tură' }],
  }
  data.goals.g2 = {
    id: 'g2', name: 'Talie', kind: 'metric', unit: 'cm', start: 104, source: 'gym:waistCm',
    reads: [{ id: 'r1', date: '2026-08-02', value: 101 }],
  }
  data.tasks.t1 = { id: 't1', mod: 'm1', title: 'sunat DWP', due: '2026-09-10', done: false }
  data.habits.h1 = { id: 'h1', mod: 'm1', name: 'mers pe jos', log: { '2026-09-01': 1, '2026-09-02': 2 } }
  data.notes.n1 = { id: 'n1', mod: 'm1', title: 'idei', body: 'text', updatedAt: '2026-09-01T10:00:00.000Z' }
  data.orgs.o1 = { id: 'o1', name: 'Lowell', kind: 'Recuperator', phone: '0113' }
  data.debts.d1 = {
    id: 'd1', mod: 'm1', name: 'Card', direction: 'owe', total: 900, status: 'Activă',
    stage: 'În default', due: '2026-09-20',
    holders: [{ id: 'hh1', org: 'o1', role: 'Proprietar curent', ref: 'LOW-1' }],
    refs: [{ id: 'rr1', value: 'REF-8842', label: 'de pe scrisoare' }],
    plans: [{ id: 'pp1', amount: 50, every: 'month', status: 'Activ', next: '2026-09-15' }],
    actions: [{ id: 'aa1', date: '2026-08-01', kind: 'Telefon', summary: 'am sunat', followUp: '2026-09-01' }],
    files: [{ id: 'ff1', name: 'scrisoare.pdf', type: 'application/pdf', size: 1200 }],
  }
  data.debts.d2 = { id: 'd2', mod: 'm1', name: 'Client', direction: 'owed', total: 500, status: 'Activă' }
  data.finance['2026-09'] = { items: [
    { id: 'mv1', date: '2026-09-02', type: 'out', amount: 50, cat: 'Datorii', debt: 'd1' },
    { id: 'mv2', date: '2026-09-03', type: 'in', amount: 120, cat: 'Livrări' },
  ] }
  data.docs.dc1 = {
    id: 'dc1', mod: 'm1', title: 'Scrisoare DWP', from: 'DWP', date: '2026-08-20',
    ref: 'NINO', amount: 340, due: '2026-09-05', debt: 'd1', done: false,
    files: [{ id: 'df1', name: 'dwp.pdf', type: 'application/pdf', size: 900 }],
  }
  data.vehicles.v1 = { id: 'v1', name: 'Corsa', plate: 'AB12 CDE', fuelPerKm: 0.11 }
  data.workdays.w1 = {
    id: 'w1', mod: 'm2', date: '2026-09-01', from: '11:00', to: '14:00', breakMinutes: 15,
    vehicle: 'v1', odoStart: 1000, odoEnd: 1120, personalKm: 10, uber: 60, tips: 8,
    parking: 4, expenses: 2, toDebt: 30, debt: 'd1', done: true, archived: true,
    rates: { taxPct: 0.2, niPct: 0.06, fuelPerKm: 0.12, vehPerKm: 0.05 },
    periods: [{ id: 'p1', from: '17:00', to: '22:00', breakMinutes: 10 }],
  }
  data.fuel.f1 = { id: 'f1', mod: 'm2', date: '2026-09-02', vehicle: 'v1', odometer: 1120, litres: 40, cost: 62, full: true }
  data.carCosts.cc1 = {
    id: 'cc1', mod: 'm2', date: '2026-07-01', category: 'Asigurare', amount: 600,
    businessPct: 0.8, from: '2026-07-01', to: '2027-06-30',
  }
  return data
}

describe('traducerea în rânduri', () => {
  it('dă înapoi exact ce a intrat', () => {
    const data = full()
    expect(fromRows(toRows(data))).toEqual(data)
  })

  it('e stabilă: a doua traducere dă aceleași rânduri', () => {
    const once = toRows(full())
    expect(toRows(fromRows(once))).toEqual(once)
  })

  it('nu pierde nimic dintr-o stare goală', () => {
    expect(fromRows(toRows(emptyOsData()))).toEqual(emptyOsData())
  })

  it('pune fiecare lucru în tabelul lui', () => {
    const rows = toRows(full())
    expect(Object.keys(rows.workdays)).toEqual(['w1'])
    expect(Object.keys(rows.work_periods)).toEqual(['p1'])
    expect(Object.keys(rows.movements).sort()).toEqual(['mv1', 'mv2'])
    expect(Object.keys(rows.habit_ticks).sort()).toEqual(['h1:2026-09-01', 'h1:2026-09-02'])
    expect(Object.keys(rows.debt_actions)).toEqual(['aa1'])
  })

  it('leagă copiii de părintele lor', () => {
    const rows = toRows(full())
    expect(rows.work_periods.p1.workday_id).toBe('w1')
    expect(rows.debt_refs.rr1.debt_id).toBe('d1')
    expect(rows.doc_files.df1.doc_id).toBe('dc1')
    expect(rows.goal_contributions.c1.goal_id).toBe('g1')
  })

  it('știe când e gol', () => {
    expect(isEmpty(toRows(emptyOsData()))).toBe(false)
    expect(isEmpty(Object.fromEntries(TABLES.map(t => [t, {}])))).toBe(true)
  })
})

describe('ce s-a schimbat', () => {
  it('nu trimite nimic când nu s-a atins nimic', () => {
    expect(changesBetween(toRows(full()), toRows(full()))).toEqual([])
  })

  it('trimite doar tura atinsă, nu tot anul', () => {
    const before = full()
    const after = full()
    after.workdays.w1.tips = 12
    const changes = changesBetween(toRows(before), toRows(after))
    expect(changes).toHaveLength(1)
    expect(changes[0].table).toBe('workdays')
    expect(changes[0].upserts).toHaveLength(1)
    expect(changes[0].upserts[0].tips).toBe(12)
  })

  it('vede ce a apărut', () => {
    const before = full()
    const after = full()
    after.fuel.f2 = { id: 'f2', mod: 'm2', date: '2026-09-09', litres: 30 }
    const changes = changesBetween(toRows(before), toRows(after))
    expect(changes.map(c => c.table)).toEqual(['fuel'])
    expect(changes[0].upserts[0].id).toBe('f2')
  })

  it('vede ce a dispărut', () => {
    const before = full()
    const after = full()
    delete after.workdays.w1
    const changes = changesBetween(toRows(before), toRows(after))
    const tables = changes.map(c => c.table)
    expect(tables).toContain('workdays')
    expect(tables).toContain('work_periods')
    expect(changes.find(c => c.table === 'workdays')?.deletes).toEqual(['w1'])
  })

  it('scrie părintele înaintea copilului', () => {
    const before = emptyOsData()
    const changes = changesBetween(toRows(before), toRows(full()))
    const order = changes.map(c => c.table)
    expect(order.indexOf('debts')).toBeLessThan(order.indexOf('debt_refs'))
    expect(order.indexOf('workdays')).toBeLessThan(order.indexOf('work_periods'))
    expect(order.indexOf('goals')).toBeLessThan(order.indexOf('goal_contributions'))
    expect(order.indexOf('habits')).toBeLessThan(order.indexOf('habit_ticks'))
  })

  it('o bifă ștearsă pleacă singură, fără obiceiul ei', () => {
    const before = full()
    const after = full()
    delete after.habits.h1.log['2026-09-01']
    const changes = changesBetween(toRows(before), toRows(after))
    expect(changes).toHaveLength(1)
    expect(changes[0].table).toBe('habit_ticks')
    expect(changes[0].deletes).toEqual(['h1:2026-09-01'])
  })
})
