import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TABLES, rowForDb, toRows } from './dbRows'
import { emptyOsData, type OsData } from './types'

/*
 * Aplicația și baza trebuie să vorbească aceeași limbă.
 *
 * Un câmp trimis către o coloană care nu există nu strică nimic la build, nu
 * pică niciun test de logică și nu se vede pe ecran: cererea pleacă, baza o
 * refuză, iar datele rămân doar pe telefon. Așa s-a întâmplat cu `settings`,
 * care n-are coloană `id` — și fiind primul tabel scris, oprea toată salvarea
 * după el.
 *
 * De aia se citește SQL-ul adevărat, cel pe care l-a rulat Roberto, și se
 * cere ca fiecare câmp trimis să aibă coloana lui acolo.
 */

const sql = readFileSync('../supabase/migrations/20260904_roberto_os_tables.sql', 'utf8')

/** Coloanele unui tabel, citite din `create table`. */
function columnsOf(table: string): Set<string> {
  const start = sql.indexOf(`create table if not exists public.${table} (`)
  if (start === -1) return new Set()
  const body = sql.slice(sql.indexOf('(', start) + 1, sql.indexOf('\n);', start))
  const names = body.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('--'))
    .filter(line => !/^(primary key|foreign key|unique|constraint|check)\b/i.test(line))
    .map(line => line.split(/\s+/)[0])
  return new Set(names)
}

/** O stare cu câte ceva peste tot, ca fiecare câmp să apuce să fie trimis. */
function full(): OsData {
  const data = emptyOsData()
  data.settings = {
    currency: '£', seeded: true, alerts: { lead: 2, hour: 8 },
    delivery: { taxPct: 0.2, niPct: 0.06, fuelPerKm: 0.12, vehPerKm: 0.05 },
  }
  data.modules.m1 = { id: 'm1', name: 'Business', kind: 'area', parent: 'x', createdAt: 'acum' }
  data.goals.g1 = {
    id: 'g1', name: 'g', kind: 'sum', target: 1, unit: 'cm', start: 2, source: 's', due: '2026-01-01',
    main: true, habits: ['h1'], createdAt: 'acum',
    contrib: [{ id: 'c1', date: '2026-01-01', amount: 1, note: 'n' }],
    reads: [{ id: 'r1', date: '2026-01-01', value: 1, note: 'n' }],
  }
  data.tasks.t1 = { id: 't1', mod: 'm1', title: 't', due: '2026-01-01', proj: 'p', done: false, createdAt: 'acum' }
  data.habits.h1 = { id: 'h1', mod: 'm1', name: 'h', log: { '2026-01-01': 1 }, createdAt: 'acum' }
  data.notes.n1 = { id: 'n1', mod: 'm1', title: 't', body: 'b', createdAt: 'acum', updatedAt: 'acum' }
  data.orgs.o1 = { id: 'o1', name: 'o', kind: 'k', phone: 'p', email: 'e', web: 'w', address: 'a', notes: 'n', createdAt: 'acum' }
  data.debts.d1 = {
    id: 'd1', mod: 'm1', name: 'd', direction: 'owe', category: 'c', total: 1, status: 's', stage: 'st',
    since: '2026-01-01', defaulted: '2026-01-01', due: '2026-01-01', notes: 'n', createdAt: 'acum',
    holders: [{ id: 'h', org: 'o1', role: 'r', from: '2026-01-01', to: '2026-01-02', ref: 'x', notes: 'n' }],
    refs: [{ id: 'r', value: 'v', label: 'l', org: 'o1' }],
    plans: [{ id: 'p', kind: 'k', amount: 1, every: 'month', next: '2026-01-01', from: '2026-01-01', to: '2026-01-02', status: 's', notes: 'n' }],
    actions: [{ id: 'a', date: '2026-01-01', kind: 'k', summary: 's', outcome: 'o', followUp: '2026-01-02', org: 'o1' }],
    files: [{ id: 'f', name: 'n', type: 't', size: 1 }],
  }
  data.finance['2026-01'] = { items: [{ id: 'mv', date: '2026-01-01', type: 'out', amount: 1, cat: 'c', note: 'n', debt: 'd1' }] }
  data.docs.dc1 = {
    id: 'dc1', mod: 'm1', title: 't', from: 'f', date: '2026-01-01', ref: 'r', amount: 1,
    due: '2026-01-02', note: 'n', debt: 'd1', done: false, createdAt: 'acum',
    files: [{ id: 'df', name: 'n', type: 't', size: 1 }],
  }
  data.vehicles.v1 = { id: 'v1', name: 'v', plate: 'p', fuelPerKm: 1, notes: 'n', createdAt: 'acum' }
  data.workdays.w1 = {
    id: 'w1', mod: 'm1', date: '2026-01-01', from: '10:00', to: '18:00', breakMinutes: 1, vehicle: 'v1',
    odoStart: 1, odoEnd: 2, personalKm: 1, uber: 1, deliveroo: 1, justEat: 1, otherPlatform: 1, tips: 1,
    bonuses: 1, parking: 1, tolls: 1, otherCost: 1, expenses: 1, recurring: 1, toDebt: 1, debt: 'd1',
    notes: 'n', done: true, archived: true, createdAt: 'acum',
    rates: { taxPct: 0.2, niPct: 0.06, fuelPerKm: 0.12, vehPerKm: 0.05 },
    periods: [{ id: 'p1', from: '17:00', to: '22:00', breakMinutes: 1 }],
  }
  data.fuel.f1 = { id: 'f1', mod: 'm1', date: '2026-01-01', vehicle: 'v1', odometer: 1, litres: 1, cost: 1, full: true, notes: 'n', createdAt: 'acum' }
  data.carCosts.c1 = {
    id: 'c1', mod: 'm1', date: '2026-01-01', vehicle: 'v1', category: 'c', what: 'w', amount: 1,
    businessPct: 1, from: '2026-01-01', to: '2026-01-02', notes: 'n', createdAt: 'acum',
  }
  return data
}

describe('aplicația și baza vorbesc aceeași limbă', () => {
  const rows = toRows(full())

  it.each(TABLES)('%s: fiecare câmp trimis are coloana lui', table => {
    const columns = columnsOf(table)
    expect(columns.size).toBeGreaterThan(0)
    const sent = new Set(Object.values(rows[table])
      .flatMap(row => Object.keys(rowForDb(table, row))))
    expect([...sent].filter(field => !columns.has(field))).toEqual([])
  })

  it('trimite ceva în fiecare tabel, altfel verificarea de mai sus nu spune nimic', () => {
    expect(TABLES.filter(table => Object.keys(rows[table]).length === 0)).toEqual([])
  })
})
