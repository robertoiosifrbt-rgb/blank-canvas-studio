import { describe, expect, it } from 'vitest'
import { dayItems } from './calendar'
import { emptyOsData, type Doc, type OsData } from './types'

const withDocs = (docs: Doc[]): OsData => ({
  ...emptyOsData(),
  docs: Object.fromEntries(docs.map(doc => [doc.id, doc])),
})

const doc = (extra: Partial<Doc> = {}): Doc =>
  ({ id: 'd1', mod: 'documente', title: 'Datorie DWP', ...extra })

describe('documentele în calendar', () => {
  it('apar în ziua termenului, nu în ziua hârtiei', () => {
    const data = withDocs([doc({ date: '2026-08-25', due: '2026-09-10' })])
    expect(dayItems(data, '2026-08-25')).toEqual([])
    expect(dayItems(data, '2026-09-10').map(i => i.title)).toEqual(['Datorie DWP'])
  })

  it('nu apar deloc dacă n-au termen', () => {
    const data = withDocs([doc({ date: '2026-08-25' })])
    expect(dayItems(data, '2026-08-25')).toEqual([])
  })

  it('arată cine a trimis hârtia, ca să se recunoască din listă', () => {
    const data = withDocs([doc({ due: '2026-09-10', from: 'DWP Debt Management' })])
    expect(dayItems(data, '2026-09-10')[0].sub).toBe('DWP Debt Management')
  })

  it('trec pe verde când sunt rezolvate', () => {
    const open = withDocs([doc({ due: '2026-09-10' })])
    const done = withDocs([doc({ due: '2026-09-10', done: true })])
    expect(dayItems(open, '2026-09-10')[0].cls).toBe('warn')
    expect(dayItems(done, '2026-09-10')[0].cls).toBe('good')
  })

  it('duc suma mai departe, ca ziua să arate cât te costă', () => {
    const data = withDocs([doc({ due: '2026-09-10', amount: 240 })])
    expect(dayItems(data, '2026-09-10')[0].amount).toBe(240)
  })

  it('nu cad pe date salvate înainte ca modulul să existe', () => {
    const old = { ...emptyOsData() } as OsData & { docs?: unknown }
    delete old.docs
    expect(() => dayItems(old as OsData, '2026-09-10')).not.toThrow()
  })
})
