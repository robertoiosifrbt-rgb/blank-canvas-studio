import { describe, expect, it } from 'vitest'
import { searchDebts } from './debtSearch'
import { emptyOsData, type Debt, type OsData } from './types'

function board(): OsData {
  const data = emptyOsData()
  data.orgs.o1 = { id: 'o1', name: 'Lowell', kind: 'Recuperator', phone: '0113 335 3000' }
  data.debts.d1 = {
    id: 'd1', mod: 'datorii', name: 'Card Vanquis', direction: 'owe', total: 900,
    status: 'Activă', stage: 'În default',
    refs: [{ id: 'r1', value: 'REF-8842', label: 'de pe scrisoare' }],
    holders: [{ id: 'h1', org: 'o1', role: 'Proprietar curent', ref: 'LOW-2211' }],
    actions: [{ id: 'a1', date: '2026-08-01', kind: 'Telefon', summary: 'am cerut pauză o lună' }],
  }
  data.debts.d2 = {
    id: 'd2', mod: 'datorii', name: 'Council tax', direction: 'owe', total: 400,
    status: 'Activă', notes: 'plan vorbit la ghișeu',
  }
  return data
}

const all = (data: OsData): Debt[] => Object.values(data.debts)

describe('căutarea prin datorii', () => {
  it('găsește după firma care o ține', () => {
    const data = board()
    expect(searchDebts(data, all(data), 'lowell').map(d => d.id)).toEqual(['d1'])
  })

  it('găsește după referința de pe scrisoare', () => {
    const data = board()
    expect(searchDebts(data, all(data), 'ref-8842').map(d => d.id)).toEqual(['d1'])
  })

  it('găsește și după referința firmei', () => {
    const data = board()
    expect(searchDebts(data, all(data), 'low-2211').map(d => d.id)).toEqual(['d1'])
  })

  it('găsește după ce s-a vorbit', () => {
    const data = board()
    expect(searchDebts(data, all(data), 'pauză').map(d => d.id)).toEqual(['d1'])
  })

  it('găsește după note', () => {
    const data = board()
    expect(searchDebts(data, all(data), 'ghișeu').map(d => d.id)).toEqual(['d2'])
  })

  it('găsește după stadiu', () => {
    const data = board()
    expect(searchDebts(data, all(data), 'default').map(d => d.id)).toEqual(['d1'])
  })

  it('cere fiecare cuvânt', () => {
    const data = board()
    expect(searchDebts(data, all(data), 'lowell council')).toHaveLength(0)
  })

  it('le dă pe toate când nu cauți nimic', () => {
    const data = board()
    expect(searchDebts(data, all(data), '')).toHaveLength(2)
  })
})
