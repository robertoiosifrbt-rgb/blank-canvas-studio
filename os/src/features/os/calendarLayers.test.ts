import { describe, expect, it } from 'vitest'
import { dayDots, dayItems, keepLayers } from './calendar'
import { emptyOsData, type Debt, type OsData } from './types'

function withDebt(extra: Partial<Debt>): OsData {
  const data = emptyOsData()
  data.orgs.o1 = { id: 'o1', name: 'Lowell', phone: '0800 123 456' }
  data.debts.d1 = {
    id: 'd1', mod: 'datorii', name: 'Card Barclays', direction: 'owe',
    total: 1000, status: 'Activă', stage: 'Vândută',
    holders: [{ id: 'h1', org: 'o1', role: 'Proprietar curent', ref: 'LW-77' }],
    ...extra,
  }
  data.tasks.t1 = { id: 't1', mod: 'taskuri', title: 'Altceva', due: '2026-09-10', done: false }
  return data
}

describe('datoriile în calendar', () => {
  it('aduc informația de care ai nevoie ca să suni', () => {
    const data = withDebt({ due: '2026-09-10' })
    const item = dayItems(data, '2026-09-10').find(i => i.kind === 'debt')
    expect(item?.lines).toEqual(['Lowell', '0800 123 456', 'ref. LW-77', 'Vândută'])
  })

  it('arată rata unui plan activ în ziua scadenței', () => {
    const data = withDebt({ plans: [{ id: 'p1', amount: 50, every: 'month', status: 'Activ', next: '2026-09-12' }] })
    const item = dayItems(data, '2026-09-12').find(i => i.kind === 'debt')
    expect(item?.sub).toBe('rată lunar')
    expect(item?.amount).toBe(50)
  })

  it('nu arată rata unei datorii deja plătite', () => {
    const data = withDebt({ plans: [{ id: 'p1', amount: 50, every: 'month', status: 'Activ', next: '2026-09-12' }] })
    data.finance['2026-08'] = { items: [{ id: 'm1', date: '2026-08-01', type: 'out', amount: 1000, debt: 'd1' }] }
    expect(dayItems(data, '2026-09-12').some(i => i.kind === 'debt')).toBe(false)
  })

  it('scoate follow-up-ul din jurnal, cu ce s-a discutat', () => {
    const data = withDebt({ actions: [
      { id: 'a1', date: '2026-09-01', kind: 'Telefon', summary: 'Cerut extras', followUp: '2026-09-15' },
    ] })
    const item = dayItems(data, '2026-09-15').find(i => i.kind === 'debt')
    expect(item?.sub).toBe('de reluat')
    expect(item?.lines?.[0]).toBe('Cerut extras')
  })

  it('duce mai departe modulul de deschis', () => {
    const data = withDebt({ due: '2026-09-10' })
    expect(dayItems(data, '2026-09-10').find(i => i.kind === 'debt')?.goto).toBe('datorii')
  })
})

describe('straturile calendarului', () => {
  const data = withDebt({ due: '2026-09-10' })

  it('nimic debifat înseamnă că se vede tot', () => {
    expect(keepLayers(dayItems(data, '2026-09-10'), [])).toHaveLength(2)
  })

  it('debifat, stratul dispare, restul rămâne', () => {
    const left = keepLayers(dayItems(data, '2026-09-10'), ['debt'])
    expect(left.map(i => i.kind)).toEqual(['task'])
  })

  it('punctele de sub zi urmează straturile, ca ziua să nu mintă', () => {
    expect(dayDots(data, '2026-09-10')).toHaveLength(2)
    expect(dayDots(data, '2026-09-10', ['debt', 'task'])).toHaveLength(0)
  })
})
