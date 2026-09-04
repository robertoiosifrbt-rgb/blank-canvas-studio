import { describe, expect, it } from 'vitest'

import { aziLocal, cuFăcutLa, dinRând } from './item'
import type { Item } from './item'

const RÂND_BUN = {
  id: 'i1',
  owner: 'a',
  kind: 'task',
  state: 'active',
  title: 'sun la X',
  due: '2026-09-05',
  done_at: null,
  version: 3,
  created_at: '2026-09-01T10:00:00+00:00',
  updated_at: '2026-09-02T10:00:00+00:00',
  deleted_at: null,
}

function item(peste: Partial<Item> = {}): Item {
  return { ...dinRând(RÂND_BUN), ...peste }
}

describe('dinRând', () => {
  it('acceptă un rând întreg', () => {
    expect(dinRând(RÂND_BUN)).toEqual(RÂND_BUN)
  })

  it('acceptă un item de captură: fără fel, fără date', () => {
    const capturat = dinRând({
      ...RÂND_BUN,
      state: 'inbox',
      kind: null,
      due: null,
    })
    expect(capturat.kind).toBeNull()
    expect(capturat.state).toBe('inbox')
  })

  it.each([
    ['id', {}],
    ['title', {}],
    ['owner', {}],
    ['state', {}],
    ['created_at', {}],
    ['updated_at', {}],
  ])('refuză un rând fără %s', (cheie) => {
    const ciuntit: Record<string, unknown> = { ...RÂND_BUN }
    delete ciuntit[cheie]
    expect(() => dinRând(ciuntit)).toThrow(`Rând fără ${cheie}`)
  })

  it('refuză o stare sau un fel pe care nu le știe', () => {
    expect(() => dinRând({ ...RÂND_BUN, state: 'dropped' })).toThrow(
      'Stare necunoscută',
    )
    expect(() => dinRând({ ...RÂND_BUN, kind: 'note' })).toThrow('Fel necunoscut')
  })

  it('refuză o versiune care nu e număr întreg', () => {
    expect(() => dinRând({ ...RÂND_BUN, version: '3' })).toThrow('Rând fără version')
    expect(() => dinRând({ ...RÂND_BUN, version: 3.5 })).toThrow('Rând fără version')
  })

  it('refuză ce nu e obiect', () => {
    expect(() => dinRând(null)).toThrow('nu e un obiect')
    expect(() => dinRând('un rând')).toThrow('nu e un obiect')
  })
})

describe('aziLocal', () => {
  it('dă ziua din ceasul dispozitivului, nu din UTC', () => {
    // 1 septembrie, 23:30, ora locală a mașinii care rulează testul.
    const local = new Date(2026, 8, 1, 23, 30)
    expect(aziLocal(local)).toBe('2026-09-01')
  })

  it('pune zerouri în față', () => {
    expect(aziLocal(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05')
  })
})

describe('cuFăcutLa', () => {
  const AZI = '2026-09-04'

  it('pune ziua locală când itemul devine done', () => {
    expect(cuFăcutLa(item(), { state: 'done' }, AZI)).toEqual({
      state: 'done',
      done_at: AZI,
    })
  })

  it('șterge done_at când itemul se redeschide', () => {
    const gata = item({ state: 'done', done_at: '2026-09-02' })
    expect(cuFăcutLa(gata, { state: 'active' }, AZI)).toEqual({
      state: 'active',
      done_at: null,
    })
  })

  it('nu atinge done_at când starea nu se schimbă', () => {
    expect(cuFăcutLa(item(), { title: 'alt titlu' }, AZI)).toEqual({
      title: 'alt titlu',
    })
    const gata = item({ state: 'done', done_at: '2026-09-02' })
    expect(cuFăcutLa(gata, { title: 'alt titlu' }, AZI)).toEqual({
      title: 'alt titlu',
    })
  })

  it('lasă un done_at trimis anume, ca ziua să poată fi corectată', () => {
    const gata = item({ state: 'done', done_at: '2026-09-02' })
    expect(cuFăcutLa(gata, { done_at: '2026-09-03' }, AZI)).toEqual({
      done_at: '2026-09-03',
    })
  })

  it('nu pune done_at pe un item care era deja done', () => {
    const gata = item({ state: 'done', done_at: '2026-09-02' })
    expect(cuFăcutLa(gata, { state: 'done' }, AZI)).toEqual({ state: 'done' })
  })
})
