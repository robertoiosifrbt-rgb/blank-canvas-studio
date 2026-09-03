import { beforeEach, describe, expect, it } from 'vitest'
import { OS_KEY, readLocal, writeLocal } from './storage'
import { emptyOsData } from './types'

describe('stocarea Roberto OS', () => {
  beforeEach(() => localStorage.clear())

  it('pornește gol când nu s-a salvat nimic', () => {
    const { value, error } = readLocal()
    expect(error).toBeNull()
    expect(value.settings.currency).toBe('£')
    expect(Object.keys(value.goals)).toHaveLength(0)
  })

  it('scrie și citește înapoi aceleași date', () => {
    const data = emptyOsData()
    data.goals.g1 = { id: 'g1', name: '100k', kind: 'sum', target: 100000, main: true }
    expect(writeLocal(data).ok).toBe(true)
    expect(readLocal().value.goals.g1.target).toBe(100000)
  })

  it('nu cade pe date corupte și păstrează originalul', () => {
    localStorage.setItem(OS_KEY, '{ nu e json')
    const { value } = readLocal()
    expect(value.settings.currency).toBe('£')
    expect(localStorage.getItem(`${OS_KEY}:corrupt`)).toBe('{ nu e json')
  })

  it('completează secțiunile lipsă în loc să arunce tot', () => {
    localStorage.setItem(OS_KEY, JSON.stringify({ goals: { g1: { id: 'g1', name: 'x', kind: 'sum' } } }))
    const { value } = readLocal()
    expect(value.goals.g1.name).toBe('x')
    expect(value.tasks).toEqual({})
    expect(value.settings.currency).toBe('£')
  })
})
