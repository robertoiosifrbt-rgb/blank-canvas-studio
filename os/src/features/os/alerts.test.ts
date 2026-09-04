import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_ALERTS, buildAlarms } from './alerts'
import { emptyOsData, type OsData } from './types'

const NOW = new Date('2026-09-04T08:00:00Z')

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
afterEach(() => vi.useRealTimers())

function base(): OsData {
  const data = emptyOsData()
  data.orgs.o1 = { id: 'o1', name: 'Lowell', phone: '0800 123 456' }
  data.debts.d1 = {
    id: 'd1', mod: 'datorii', name: 'Card', direction: 'owe', total: 500, status: 'Activă',
    holders: [{ id: 'h1', org: 'o1', role: 'Proprietar curent', ref: 'LW-77' }],
  }
  return data
}

describe('alarmele scoase din date', () => {
  it('sună înainte de termen, la ora stabilită', () => {
    const data = base()
    data.tasks.t1 = { id: 't1', mod: 'taskuri', title: 'Sună', due: '2026-09-20', done: false }
    const alarm = buildAlarms(data)[0]
    expect(alarm.scheduledAt.slice(0, 10)).toBe('2026-09-19')
    expect(new Date(alarm.scheduledAt).getHours()).toBe(DEFAULT_ALERTS.hour)
  })

  it('respectă câte zile înainte ai cerut', () => {
    const data = base()
    data.tasks.t1 = { id: 't1', mod: 'taskuri', title: 'Sună', due: '2026-09-20', done: false }
    expect(buildAlarms(data, { lead: 3, hour: 8 })[0].scheduledAt.slice(0, 10)).toBe('2026-09-17')
  })

  it('nu sună pentru ce a trecut', () => {
    const data = base()
    data.tasks.t1 = { id: 't1', mod: 'taskuri', title: 'Vechi', due: '2026-08-01', done: false }
    expect(buildAlarms(data)).toEqual([])
  })

  it('nu sună pentru ce e bifat sau rezolvat', () => {
    const data = base()
    data.tasks.t1 = { id: 't1', mod: 'taskuri', title: 'Gata', due: '2026-09-20', done: true }
    data.docs.x1 = { id: 'x1', mod: 'documente', title: 'Gata', due: '2026-09-21', done: true }
    expect(buildAlarms(data)).toEqual([])
  })

  it('duce în text telefonul și referința, nu doar numele', () => {
    const data = base()
    data.debts.d1.due = '2026-09-20'
    const alarm = buildAlarms(data).find(a => a.id.startsWith('debt:'))
    expect(alarm?.body).toContain('0800 123 456')
    expect(alarm?.body).toContain('LW-77')
  })

  it('tace pentru o datorie deja plătită', () => {
    const data = base()
    data.debts.d1.due = '2026-09-20'
    data.finance['2026-08'] = { items: [{ id: 'm1', date: '2026-08-01', type: 'out', amount: 500, debt: 'd1' }] }
    expect(buildAlarms(data)).toEqual([])
  })

  it('sună pentru rata următoare a unui plan activ', () => {
    const data = base()
    data.debts.d1.plans = [{ id: 'p1', amount: 40, every: 'month', status: 'Activ', next: '2026-01-15' }]
    const alarm = buildAlarms(data).find(a => a.id.startsWith('plan:'))
    expect(alarm?.title).toContain('rată lunar')
  })

  it('sună pentru follow-up-urile din jurnal', () => {
    const data = base()
    data.debts.d1.actions = [
      { id: 'a1', date: '2026-09-01', kind: 'Telefon', summary: 'Cerut extras', followUp: '2026-09-25' },
    ]
    expect(buildAlarms(data).find(a => a.id === 'follow:a1')?.body).toContain('Cerut extras')
  })

  it('dă aceleași id-uri la recalculare, ca să nu se dubleze', () => {
    const data = base()
    data.debts.d1.due = '2026-09-20'
    expect(buildAlarms(data).map(a => a.id)).toEqual(buildAlarms(data).map(a => a.id))
  })

  it('le pune în ordinea în care sună', () => {
    const data = base()
    data.tasks.t1 = { id: 't1', mod: 'taskuri', title: 'Târziu', due: '2026-10-01', done: false }
    data.tasks.t2 = { id: 't2', mod: 'taskuri', title: 'Devreme', due: '2026-09-10', done: false }
    expect(buildAlarms(data).map(a => a.title)).toEqual(['Devreme', 'Târziu'])
  })
})
