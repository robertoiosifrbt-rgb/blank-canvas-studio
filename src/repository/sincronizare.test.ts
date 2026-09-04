import { describe, expect, it, vi } from 'vitest'

import type { Depozit } from './depozit'
import type { Item } from './item'
import { celMaiNou, PAGINĂ, sincronizează } from './sincronizare'
import type { Sursă } from './sincronizare'

const A = 'utilizator-a'

function item(id: string, peste: Partial<Item> = {}): Item {
  return {
    id,
    owner: A,
    kind: null,
    state: 'inbox',
    title: `titlul ${id}`,
    due: null,
    done_at: null,
    version: 1,
    created_at: '2026-09-01T10:00:00+00:00',
    updated_at: '2026-09-01T10:00:00+00:00',
    deleted_at: null,
    ...peste,
  }
}

/** Un depozit în memorie, cu aceleași reguli ca cel din IndexedDB. */
function depozitÎnMemorie(pornire: Item[] = [], cursor: string | null = null) {
  const rânduri = new Map(pornire.map((i) => [i.id, i]))
  let cursorul = cursor

  const depozit: Depozit = {
    citeșteTot: () => Promise.resolve([...rânduri.values()]),
    cursorul: () => Promise.resolve(cursorul),
    înlocuieșteSnapshot: (_owner, itemi, cursorNou) => {
      rânduri.clear()
      for (const i of itemi) rânduri.set(i.id, i)
      cursorul = cursorNou
      return Promise.resolve()
    },
    upsertă: (_owner, itemi, cursorNou) => {
      for (const i of itemi) rânduri.set(i.id, i)
      if (cursorNou !== null) cursorul = cursorNou
      return Promise.resolve()
    },
  }

  return {
    depozit,
    get itemi() {
      return [...rânduri.values()]
    },
    get cursor() {
      return cursorul
    },
  }
}

/** O sursă care întoarce paginile date, în ordine. */
function sursăCu(...pagini: Item[][]): Sursă & { cereri: unknown[] } {
  const cereri: unknown[] = []
  let i = 0
  return {
    cereri,
    pagină: (opțiuni) => {
      cereri.push(opțiuni)
      return Promise.resolve(pagini[i++] ?? [])
    },
  }
}

describe('sincronizează — cele trei cazuri distincte', () => {
  it('eroare: un fetch căzut nu atinge cache-ul', async () => {
    const cache = depozitÎnMemorie([item('vechi')], '2026-09-01T10:00:00+00:00')
    const sursă: Sursă = { pagină: () => Promise.reject(new Error('rețeaua')) }

    await expect(sincronizează(A, sursă, cache.depozit)).rejects.toThrow('rețeaua')

    expect(cache.itemi.map((i) => i.id)).toEqual(['vechi'])
    expect(cache.cursor).toBe('2026-09-01T10:00:00+00:00')
  })

  it('snapshot gol valid: înlocuiește cache-ul, chiar dacă e gol', async () => {
    // Fără cursor = prima intrare. Golul poate fi legitim: ai șters ultimul item.
    const cache = depozitÎnMemorie([item('rămas-de-undeva')], null)
    const rezultat = await sincronizează(A, sursăCu([]), cache.depozit)

    expect(rezultat).toEqual({ fel: 'complet', aduse: 0, cursor: null })
    expect(cache.itemi).toEqual([])
    expect(cache.cursor).toBeNull()
  })

  it('delta gol: nu golește nimic și lasă cursorul cum era', async () => {
    const cache = depozitÎnMemorie(
      [item('unu'), item('doi')],
      '2026-09-01T10:00:00+00:00',
    )
    const rezultat = await sincronizează(A, sursăCu([]), cache.depozit)

    expect(rezultat.fel).toBe('delta')
    expect(rezultat.aduse).toBe(0)
    expect(cache.itemi.map((i) => i.id)).toEqual(['unu', 'doi'])
    expect(cache.cursor).toBe('2026-09-01T10:00:00+00:00')
  })
})

describe('sincronizează', () => {
  it('un delta cu două rânduri nu șterge restul din cache', async () => {
    const cache = depozitÎnMemorie(
      [item('unu'), item('doi'), item('trei')],
      '2026-09-01T10:00:00+00:00',
    )
    const nou = item('doi', {
      title: 'schimbat',
      version: 2,
      updated_at: '2026-09-02T09:00:00+00:00',
    })
    await sincronizează(A, sursăCu([nou, item('patru')]), cache.depozit)

    expect(cache.itemi.map((i) => i.id).sort()).toEqual([
      'doi',
      'patru',
      'trei',
      'unu',
    ])
    expect(cache.itemi.find((i) => i.id === 'doi')?.title).toBe('schimbat')
  })

  it('cere delta de la cursorul din cache, inclusiv', async () => {
    const cache = depozitÎnMemorie([item('unu')], '2026-09-01T10:00:00+00:00')
    const sursă = sursăCu([])
    await sincronizează(A, sursă, cache.depozit)

    expect(sursă.cereri).toEqual([
      { deLa: 0, pânăLa: PAGINĂ - 1, dinCursor: '2026-09-01T10:00:00+00:00' },
    ])
  })

  it('aduce toate paginile, nu doar prima', async () => {
    const primaPagină = Array.from({ length: PAGINĂ }, (_, i) =>
      item(`i${String(i).padStart(4, '0')}`),
    )
    const cache = depozitÎnMemorie()
    const sursă = sursăCu(primaPagină, [item('ultimul')])

    const rezultat = await sincronizează(A, sursă, cache.depozit)

    expect(rezultat.aduse).toBe(PAGINĂ + 1)
    expect(sursă.cereri).toEqual([
      { deLa: 0, pânăLa: PAGINĂ - 1, dinCursor: null },
      { deLa: PAGINĂ, pânăLa: 2 * PAGINĂ - 1, dinCursor: null },
    ])
  })

  it('ține și rândurile șterse — de-aia le păstrăm', async () => {
    const cache = depozitÎnMemorie()
    await sincronizează(
      A,
      sursăCu([item('șters', { deleted_at: '2026-09-02T08:00:00+00:00' })]),
      cache.depozit,
    )

    expect(cache.itemi).toHaveLength(1)
    expect(cache.itemi[0]?.deleted_at).not.toBeNull()
  })

  it('cursorul e cel mai nou updated_at venit de la server', async () => {
    const cache = depozitÎnMemorie()
    const rezultat = await sincronizează(
      A,
      sursăCu([
        item('unu', { updated_at: '2026-09-02T08:00:00+00:00' }),
        item('doi', { updated_at: '2026-09-03T07:00:00+00:00' }),
        item('trei', { updated_at: '2026-09-01T23:00:00+00:00' }),
      ]),
      cache.depozit,
    )

    expect(rezultat.cursor).toBe('2026-09-03T07:00:00+00:00')
    expect(cache.cursor).toBe('2026-09-03T07:00:00+00:00')
  })

  it('un cursor pe care cache-ul nu-l poate da se tratează ca prima intrare', async () => {
    const cache = depozitÎnMemorie([item('unu')], '2026-09-01T10:00:00+00:00')
    const stricat: Depozit = {
      ...cache.depozit,
      cursorul: () => Promise.reject(new Error('cache ilizibil')),
    }
    const sursă = sursăCu([item('adus')])

    const rezultat = await sincronizează(A, sursă, stricat)

    expect(rezultat.fel).toBe('complet')
    expect(sursă.cereri).toEqual([{ deLa: 0, pânăLa: PAGINĂ - 1, dinCursor: null }])
  })

  it('nu scrie în cache înainte să aducă tot', async () => {
    const cache = depozitÎnMemorie([item('vechi')], null)
    const înlocuiește = vi.spyOn(cache.depozit, 'înlocuieșteSnapshot')
    const primaPagină = Array.from({ length: PAGINĂ }, (_, i) => item(`i${i}`))
    let cereri = 0
    const sursă: Sursă = {
      pagină: () => {
        cereri += 1
        if (cereri === 1) return Promise.resolve(primaPagină)
        return Promise.reject(new Error('a picat la a doua pagină'))
      },
    }

    await expect(sincronizează(A, sursă, cache.depozit)).rejects.toThrow(
      'a doua pagină',
    )
    expect(înlocuiește).not.toHaveBeenCalled()
    expect(cache.itemi.map((i) => i.id)).toEqual(['vechi'])
  })
})

describe('celMaiNou', () => {
  it('e null pe o listă goală', () => {
    expect(celMaiNou([])).toBeNull()
  })

  it('nu acceptă un updated_at nevalid', () => {
    expect(() => celMaiNou([item('x', { updated_at: 'ieri' })])).toThrow(
      'updated_at nevalid',
    )
  })
})
