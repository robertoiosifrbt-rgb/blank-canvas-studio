import { describe, expect, it } from 'vitest'
import { describeImport, importInto } from './transfer'
import { emptyOsData, type OsData } from './types'

const withDebt = (): OsData => {
  const data = emptyOsData()
  data.debts.d1 = { id: 'd1', mod: 'datorii', name: 'Vechi', direction: 'owe', total: 100, status: 'Activă' }
  return data
}

describe('importul datelor', () => {
  it('adaugă ce e nou fără să atingă ce ai', () => {
    const { data, added } = importInto(withDebt(), {
      docs: { x1: { title: 'Datorie DWP', mod: 'documente' } },
    })
    expect(data.debts.d1.name).toBe('Vechi')
    expect(data.docs.x1.title).toBe('Datorie DWP')
    expect(added).toEqual({ docs: 1 })
  })

  it('nu șterge nimic din ce lipsește din fișier', () => {
    const { data } = importInto(withDebt(), { docs: { x1: { title: 'x' } } })
    expect(Object.keys(data.debts)).toEqual(['d1'])
  })

  it('înlocuiește o intrare cu același id', () => {
    const start = withDebt()
    const { data } = importInto(start, { debts: { d1: { name: 'Actualizat', total: 200 } } })
    expect(data.debts.d1.name).toBe('Actualizat')
    expect(Object.keys(data.debts)).toHaveLength(1)
  })

  it('pune id-ul din cheie, ca intrarea să fie de găsit', () => {
    const { data } = importInto(emptyOsData(), { docs: { bun: { id: 'gresit', title: 'x' } } })
    expect(data.docs.bun.id).toBe('bun')
  })

  it('contopește finanțele lună cu lună, fără să piardă restul anului', () => {
    const start = emptyOsData()
    start.finance['2026-08'] = { items: [{ id: 'a', date: '2026-08-02', amount: 10, type: 'out' }] }
    const { data } = importInto(start, {
      finance: { '2026-09': { items: [{ id: 'b', date: '2026-09-02', amount: 20, type: 'out' }] } },
    })
    expect(Object.keys(data.finance).sort()).toEqual(['2026-08', '2026-09'])
  })

  it('nu adaugă a doua oară o mișcare pe care o ai deja', () => {
    const start = emptyOsData()
    start.finance['2026-09'] = { items: [{ id: 'b', date: '2026-09-02', amount: 20, type: 'out' }] }
    const { data, error } = importInto(start, {
      finance: { '2026-09': { items: [{ id: 'b', date: '2026-09-02', amount: 20, type: 'out' }] } },
    })
    expect(data.finance['2026-09'].items).toHaveLength(1)
    expect(error).toContain('nimic de adăugat')
  })

  it('refuză un fișier care nu e al aplicației', () => {
    expect(importInto(emptyOsData(), 'nu e un obiect').error).toContain('nu conține date')
    expect(importInto(emptyOsData(), { altceva: 1 }).error).toContain('nimic de adăugat')
  })

  it('lasă datele neatinse când refuză', () => {
    const start = withDebt()
    expect(importInto(start, { altceva: 1 }).data).toBe(start)
  })

  it('acceptă un fișier exportat, cu tot cu antetul lui', () => {
    const { added } = importInto(emptyOsData(), {
      app: 'Roberto OS', exportat: '2026-09-04T00:00:00Z',
      docs: { x1: { title: 'x' } }, debts: { d9: { name: 'y' } },
    })
    expect(added).toEqual({ debts: 1, docs: 1 })
  })

  it('spune în română ce a intrat', () => {
    expect(describeImport({ docs: 1, debts: 2 })).toBe('1 document, 2 datorii')
    expect(describeImport({ tasks: 1 })).toBe('1 task')
  })
})
