import { describe, expect, it } from 'vitest'
import { dayItems } from './calendar'
import { itemsUnder } from './modules'
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
    /* Datele vechi din cloud n-au deloc cheia `docs`. */
    const { docs: _dropped, ...old } = emptyOsData()
    expect(() => dayItems(old as OsData, '2026-09-10')).not.toThrow()
  })
})

describe('documentele pe submodule', () => {
  const tree = (): OsData => ({
    ...emptyOsData(),
    modules: {
      dwp: { id: 'dwp', name: 'DWP', kind: 'docs', parent: 'documente' },
      apel: { id: 'apel', name: 'Apeluri', kind: 'docs', parent: 'dwp' },
      hmrc: { id: 'hmrc', name: 'HMRC', kind: 'docs', parent: 'documente' },
    },
    docs: {
      a: doc({ id: 'a', mod: 'documente', title: 'Direct' }),
      b: doc({ id: 'b', mod: 'dwp', title: 'Din DWP' }),
      c: doc({ id: 'c', mod: 'apel', title: 'Din apeluri' }),
      d: doc({ id: 'd', mod: 'hmrc', title: 'Din HMRC' }),
    },
  })

  it('părintele le arată pe toate cele de sub el, la orice adâncime', () => {
    const under = itemsUnder(tree(), tree().docs, 'documente')
    expect(under.map(x => x.title).sort())
      .toEqual(['Din DWP', 'Din HMRC', 'Din apeluri', 'Direct'].sort())
  })

  it('un submodul arată doar ce e sub el, nu ce e la fratele lui', () => {
    expect(itemsUnder(tree(), tree().docs, 'dwp').map(x => x.title).sort())
      .toEqual(['Din DWP', 'Din apeluri'])
  })

  it('o frunză arată doar ce e în ea', () => {
    expect(itemsUnder(tree(), tree().docs, 'hmrc').map(x => x.title)).toEqual(['Din HMRC'])
  })
})
