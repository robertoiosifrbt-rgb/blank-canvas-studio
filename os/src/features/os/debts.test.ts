import { describe, expect, it } from 'vitest'
import {
  allRefs, currentHolder, currentRef, isSettled, nextDate, nextDue, openFollowUps, paidOn,
  paymentsFor, progress, remaining, summariseDebts,
} from './debts'
import { emptyOsData, type Debt, type OsData } from './types'

const debt = (extra: Partial<Debt> = {}): Debt =>
  ({ id: 'd1', mod: 'datorii', name: 'DWP', direction: 'owe', total: 1000, status: 'Activă', ...extra })

function withPayments(rows: Array<{ date: string; amount: number; debt?: string }>): OsData {
  const data = emptyOsData()
  for (const row of rows) {
    const month = row.date.slice(0, 7)
    data.finance[month] ??= { items: [] }
    data.finance[month].items.push({
      id: `m${row.date}${row.amount}`, date: row.date, type: 'out',
      amount: row.amount, debt: row.debt ?? 'd1',
    })
  }
  return data
}

describe('banii unei datorii', () => {
  it('vin din Finanțe, nu din datorie', () => {
    const data = withPayments([{ date: '2026-08-02', amount: 100 }, { date: '2026-09-02', amount: 150 }])
    expect(paidOn(data, 'd1')).toBe(250)
    expect(remaining(data, debt())).toBe(750)
  })

  it('nu numără plățile altei datorii', () => {
    const data = withPayments([{ date: '2026-08-02', amount: 100, debt: 'altceva' }])
    expect(paidOn(data, 'd1')).toBe(0)
  })

  it('nu numără cheltuielile obișnuite', () => {
    const data = emptyOsData()
    data.finance['2026-08'] = { items: [{ id: 'x', date: '2026-08-02', type: 'out', amount: 90 }] }
    expect(paidOn(data, 'd1')).toBe(0)
  })

  it('adună plăți din luni diferite, în ordine', () => {
    const data = withPayments([{ date: '2026-09-02', amount: 50 }, { date: '2026-07-02', amount: 30 }])
    expect(paymentsFor(data, 'd1').map(p => p.date)).toEqual(['2026-07-02', '2026-09-02'])
  })

  it('nu coboară sub zero când ai plătit mai mult decât era', () => {
    const data = withPayments([{ date: '2026-08-02', amount: 1200 }])
    expect(remaining(data, debt())).toBe(0)
    expect(progress(data, debt())).toBe(100)
  })
})

describe('cine ține datoria', () => {
  it('e proprietarul curent, când e trecut ca atare', () => {
    const d = debt({ holders: [
      { id: 'h1', org: 'o1', role: 'Creditor inițial', to: '2026-03-01' },
      { id: 'h2', org: 'o2', role: 'Proprietar curent', ref: 'AB123' },
    ] })
    expect(currentHolder(d)?.org).toBe('o2')
    expect(currentRef(d)).toBe('AB123')
  })

  it('altfel, primul fără dată de sfârșit', () => {
    const d = debt({ holders: [
      { id: 'h1', org: 'o1', role: 'Creditor inițial', to: '2026-03-01' },
      { id: 'h2', org: 'o2', role: 'Agenție de colectare', ref: 'CD9' },
    ] })
    expect(currentRef(d)).toBe('CD9')
  })

  it('lipsă cu totul, nu cade', () => {
    expect(currentHolder(debt())).toBeUndefined()
    expect(currentRef(debt())).toBeUndefined()
  })
})

describe('următoarea scadență', () => {
  const plan = { id: 'p1', amount: 50, every: 'month' as const, status: 'Activ', next: '2026-01-15' }

  it('mută data înainte cât e nevoie, fără să fie atinsă manual', () => {
    expect(nextDue(plan, new Date('2026-09-04T12:00:00'))).toBe('2026-09-12')
  })

  it('lasă în pace o dată care e deja în față', () => {
    expect(nextDue({ ...plan, next: '2026-12-01' }, new Date('2026-09-04T12:00:00'))).toBe('2026-12-01')
  })

  it('o plată unică rămâne unde e, oricât ar fi trecut', () => {
    expect(nextDue({ ...plan, every: 'once' }, new Date('2026-09-04T12:00:00'))).toBe('2026-01-15')
  })

  it('fără dată, nu inventează una', () => {
    expect(nextDue({ ...plan, next: undefined })).toBeUndefined()
  })
})

describe('follow-up-urile din jurnal', () => {
  it('rămân doar cele care n-au trecut', () => {
    const d = debt({ actions: [
      { id: 'a1', date: '2026-08-01', kind: 'Telefon', summary: 'Sunat', followUp: '2026-08-10' },
      { id: 'a2', date: '2026-09-01', kind: 'Telefon', summary: 'Resunat', followUp: '2026-09-20' },
      { id: 'a3', date: '2026-09-02', kind: 'Email', summary: 'Fără urmare' },
    ] })
    expect(openFollowUps(d, '2026-09-04')).toEqual([{ date: '2026-09-20', about: 'Resunat' }])
  })
})

describe('referințele unei datorii', () => {
  it('le arată pe toate, și pe cele scrise pe firme', () => {
    const d = debt({
      refs: [{ id: 'r1', value: 'CLI-1', label: 'număr de client' }],
      holders: [{ id: 'h1', org: 'o1', role: 'Proprietar curent', ref: 'LW-77' }],
    })
    expect(allRefs(d).map(r => r.value)).toEqual(['CLI-1', 'LW-77'])
  })

  it('nu o repetă pe cea care e și în listă, și pe firmă', () => {
    const d = debt({
      refs: [{ id: 'r1', value: 'LW-77' }],
      holders: [{ id: 'h1', org: 'o1', role: 'Proprietar curent', ref: 'LW-77' }],
    })
    expect(allRefs(d)).toHaveLength(1)
  })

  it('la telefon o dă pe cea a firmei care o ține acum', () => {
    const d = debt({
      refs: [{ id: 'r1', value: 'VECHI-1', org: 'o9' }, { id: 'r2', value: 'NOU-2', org: 'o2' }],
      holders: [{ id: 'h1', org: 'o2', role: 'Proprietar curent' }],
    })
    expect(currentRef(d)).toBe('NOU-2')
  })

  it('dacă nu se știe a cui e, o dă pe prima', () => {
    const d = debt({ refs: [{ id: 'r1', value: 'UNU' }, { id: 'r2', value: 'DOI' }] })
    expect(currentRef(d)).toBe('UNU')
  })
})

describe('situația datoriilor', () => {
  function board(): OsData {
    const data = withPayments([
      { date: '2026-09-04', amount: 120 },
      { date: '2026-08-04', amount: 100 },
    ])
    data.debts.d1 = debt({ due: '2026-08-20' })
    data.debts.d2 = debt({ id: 'd2', name: 'Client', direction: 'owed', total: 500, due: '2026-09-10' })
    data.debts.d3 = debt({ id: 'd3', name: 'Card vechi', total: 300, status: 'Plătită' })
    data.finance['2026-09'].items.push({
      id: 'in1', date: '2026-09-03', type: 'in', amount: 50, debt: 'd2',
    })
    return data
  }

  const list = (data: OsData): Debt[] => Object.values(data.debts)

  it('ține despărțit ce datorezi de ce ți se datorează', () => {
    const s = summariseDebts(board(), list(board()), '2026-09-04')
    expect(s.owe).toBe(780)
    expect(s.oweCount).toBe(1)
    expect(s.owed).toBe(450)
    expect(s.owedCount).toBe(1)
  })

  it('nu numără datoriile închise', () => {
    const s = summariseDebts(board(), list(board()), '2026-09-04')
    expect(s.oweCount).toBe(1)
  })

  it('spune cât a ieșit și cât a intrat luna asta', () => {
    const s = summariseDebts(board(), list(board()), '2026-09-04')
    expect(s.paidMonth).toBe(120)
    expect(s.gotMonth).toBe(50)
  })

  it('numără restanțele separat de ce vine', () => {
    const s = summariseDebts(board(), list(board()), '2026-09-04')
    expect(s.overdue).toBe(1)
    expect(s.soon).toBe(1)
  })

  it('dă cea mai apropiată zi cu ceva de făcut', () => {
    const s = summariseDebts(board(), list(board()), '2026-09-04')
    expect(s.next).toBe('2026-08-20')
  })

  it('nu se sperie de nimic', () => {
    const s = summariseDebts(emptyOsData(), [], '2026-09-04')
    expect(s.owe).toBe(0)
    expect(s.overdue).toBe(0)
    expect(s.next).toBeUndefined()
  })
})

describe('ziua următoare a unei datorii', () => {
  it('o ia pe cea mai apropiată dintre plan și termen', () => {
    const d = debt({
      due: '2026-09-20',
      plans: [{ id: 'p1', amount: 50, every: 'month', status: 'Activ', next: '2026-09-10' }],
    })
    expect(nextDate(d, new Date('2026-09-04T12:00:00'))).toBe('2026-09-10')
  })

  it('nu inventează una când nu e niciuna', () => {
    expect(nextDate(debt())).toBeUndefined()
  })
})

describe('datoria închisă', () => {
  it('e cea plătită, stinsă sau închisă', () => {
    expect(isSettled(debt({ status: 'Plătită' }))).toBe(true)
    expect(isSettled(debt({ status: 'Stinsă' }))).toBe(true)
    expect(isSettled(debt({ status: 'Activă' }))).toBe(false)
    expect(isSettled(debt({ status: 'Plan de plată' }))).toBe(false)
  })
})
