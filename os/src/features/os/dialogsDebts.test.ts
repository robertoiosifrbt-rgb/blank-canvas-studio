import { describe, expect, it } from 'vitest'
import { debtDialogs } from './dialogsDebts'
import { emptyOsData, type OsData } from './types'

/** Completează fereastra cu ce ai scris tu peste valorile ei implicite. */
function run(spec: {
  fields: Array<{ key: string; value?: string }>
  submit: (values: Record<string, string>) => string | void
}, typed: Record<string, string>) {
  const values: Record<string, string> = {}
  for (const field of spec.fields) values[field.key] = field.value ?? ''
  Object.assign(values, typed)
  return spec.submit(values)
}

function withOrgs(names: string[]): OsData {
  const data = emptyOsData()
  names.forEach((name, i) => { data.orgs[`o${i}`] = { id: `o${i}`, name } })
  return data
}

const dialogs = (data: OsData) => {
  const draft = data
  return debtDialogs(data, change => change(draft))
}

describe('firma scrisă în fereastra datoriei', () => {
  it('propune firmele pe care le ai deja, în ordine', () => {
    const spec = dialogs(withOrgs(['Lowell', 'Cabot'])).debt('datorii')
    const field = spec.fields.find(f => f.key === 'org')
    expect(field?.suggest).toEqual(['Cabot', 'Lowell'])
  })

  it('creează firma dacă numele e nou', () => {
    const data = withOrgs([])
    run(dialogs(data).debt('datorii'), { name: 'Card', total: '500', org: 'Lowell', ref: 'LW-1' })
    expect(Object.values(data.orgs).map(o => o.name)).toEqual(['Lowell'])
  })

  it('o refolosește pe cea existentă, oricum ai scrie-o', () => {
    const data = withOrgs(['Lowell'])
    run(dialogs(data).debt('datorii'), { name: 'Card', total: '500', org: 'lowell' })
    expect(Object.keys(data.orgs)).toHaveLength(1)
  })

  it('leagă firma de datorie ca proprietar curent, cu referința ei', () => {
    const data = withOrgs([])
    run(dialogs(data).debt('datorii'), { name: 'Card', total: '500', org: 'Lowell', ref: 'LW-1' })
    const debt = Object.values(data.debts)[0]
    expect(debt.holders?.[0]).toMatchObject({ role: 'Proprietar curent', ref: 'LW-1' })
    expect(data.orgs[debt.holders?.[0].org ?? '']?.name).toBe('Lowell')
  })

  it('merge și fără firmă — o pui când o afli', () => {
    const data = withOrgs([])
    run(dialogs(data).debt('datorii'), { name: 'Card', total: '500' })
    expect(Object.values(data.debts)[0].holders).toEqual([])
    expect(Object.keys(data.orgs)).toHaveLength(0)
  })

  it('cere numele și suma, nu firma', () => {
    const data = withOrgs([])
    expect(run(dialogs(data).debt('datorii'), { name: '', total: '500' })).toMatch(/pentru ce/)
    expect(run(dialogs(data).debt('datorii'), { name: 'Card', total: '0' })).toMatch(/în total/)
  })
})
