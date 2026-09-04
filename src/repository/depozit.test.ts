// IndexedDB nu există în Node, deci se folosește o implementare falsă a
// aceluiași API. Ce se verifică e adaptorul adevărat, nu unul de test.
import 'fake-indexeddb/auto'

import { describe, expect, it } from 'vitest'

import { depozitul } from './depozit'
import type { Item } from './item'

function item(id: string, owner: string, peste: Partial<Item> = {}): Item {
  return {
    id,
    owner,
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

describe('depozitul', () => {
  it('ține datele fiecărui cont în namespace-ul lui', async () => {
    const [a, b] = ['n1-a', 'n1-b']
    await depozitul.înlocuieșteSnapshot(a, [item('a1', a)], 'cursor-a')
    await depozitul.înlocuieșteSnapshot(b, [item('b1', b)], 'cursor-b')

    expect((await depozitul.citeșteTot(a)).map((i) => i.id)).toEqual(['a1'])
    expect((await depozitul.citeșteTot(b)).map((i) => i.id)).toEqual(['b1'])
    expect(await depozitul.cursorul(a)).toBe('cursor-a')
    expect(await depozitul.cursorul(b)).toBe('cursor-b')
  })

  it('un snapshot al unui cont nu atinge datele celuilalt', async () => {
    const [a, b] = ['n2-a', 'n2-b']
    await depozitul.înlocuieșteSnapshot(a, [item('a1', a)], 'c-a')
    await depozitul.înlocuieșteSnapshot(b, [item('b1', b), item('b2', b)], 'c-b')

    await depozitul.înlocuieșteSnapshot(a, [], null)

    expect(await depozitul.citeșteTot(a)).toEqual([])
    expect((await depozitul.citeșteTot(b)).map((i) => i.id).sort()).toEqual([
      'b1',
      'b2',
    ])
    expect(await depozitul.cursorul(b)).toBe('c-b')
  })

  it('un cont fără nimic în cache nu are cursor', async () => {
    expect(await depozitul.cursorul('n3-nou')).toBeNull()
    expect(await depozitul.citeșteTot('n3-nou')).toEqual([])
  })

  it('upsert adaugă și actualizează, dar nu șterge nimic', async () => {
    const a = 'n4-a'
    await depozitul.înlocuieșteSnapshot(
      a,
      [item('unu', a), item('doi', a)],
      'c1',
    )

    await depozitul.upsertă(
      a,
      [item('doi', a, { title: 'schimbat', version: 2 }), item('trei', a)],
      'c2',
    )

    const itemi = await depozitul.citeșteTot(a)
    expect(itemi.map((i) => i.id).sort()).toEqual(['doi', 'trei', 'unu'])
    expect(itemi.find((i) => i.id === 'doi')?.title).toBe('schimbat')
    expect(await depozitul.cursorul(a)).toBe('c2')
  })

  it('un upsert gol cu cursor null lasă tot exact cum era', async () => {
    const a = 'n5-a'
    await depozitul.înlocuieșteSnapshot(a, [item('unu', a)], 'c1')

    await depozitul.upsertă(a, [], null)

    expect((await depozitul.citeșteTot(a)).map((i) => i.id)).toEqual(['unu'])
    expect(await depozitul.cursorul(a)).toBe('c1')
  })

  it('ține și rândurile șterse', async () => {
    const a = 'n6-a'
    await depozitul.înlocuieșteSnapshot(
      a,
      [item('șters', a, { deleted_at: '2026-09-02T08:00:00+00:00' })],
      'c1',
    )
    expect(await depozitul.citeșteTot(a)).toHaveLength(1)
  })

  it('refuză un rând care e al altui cont', async () => {
    const a = 'n7-a'
    await expect(
      depozitul.upsertă(a, [item('strecurat', 'altcineva')], null),
    ).rejects.toThrow('nu al lui n7-a')
    expect(await depozitul.citeșteTot(a)).toEqual([])
  })

  it('nu dă mai departe un rând stricat din cache', async () => {
    const a = 'n8-a'
    await depozitul.înlocuieșteSnapshot(a, [item('bun', a)], 'c1')

    // Un rând scris de o versiune mai veche a aplicației, fără title.
    await new Promise<void>((gata, cade) => {
      const cerută = indexedDB.open('life-control-centre')
      cerută.onsuccess = () => {
        const tranzacție = cerută.result.transaction('items', 'readwrite')
        tranzacție.objectStore('items').put({ id: 'stricat', owner: a })
        tranzacție.oncomplete = () => gata()
        tranzacție.onerror = () => cade(new Error('nu s-a putut strica'))
      }
      cerută.onerror = () => cade(new Error('nu s-a deschis'))
    })

    await expect(depozitul.citeșteTot(a)).rejects.toThrow(/Rând fără/)
  })
})
