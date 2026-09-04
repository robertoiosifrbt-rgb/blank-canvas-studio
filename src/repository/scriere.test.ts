import { describe, expect, it } from 'vitest'

import type { Item, Patch } from './item'
import { aplicăPatch, Conflict, creează, șterge } from './scriere'
import type { Scriitor } from './scriere'

const AZI = '2026-09-04'

function item(peste: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    owner: 'a',
    kind: 'task',
    state: 'active',
    title: 'sun la X',
    due: null,
    done_at: null,
    version: 4,
    created_at: '2026-09-01T10:00:00+00:00',
    updated_at: '2026-09-01T10:00:00+00:00',
    deleted_at: null,
    ...peste,
  }
}

type Apel = { id: string; versiune: number; patch: Patch }

/**
 * Un scriitor care se comportă ca UPDATE-ul condiționat: scrie numai dacă
 * versiunea cerută e cea curentă.
 */
function scriitorCu(pornire: Item, opțiuni: { dispare?: boolean } = {}) {
  let curent = pornire
  const apeluri: Apel[] = []

  const scriitor: Scriitor = {
    inserează: (valori) =>
      Promise.resolve(item({ id: 'nou', state: 'inbox', kind: null, version: 1, ...valori })),
    actualizează: (id, versiune, patch) => {
      apeluri.push({ id, versiune, patch })
      if (versiune !== curent.version) return Promise.resolve([])
      curent = { ...curent, ...patch, version: curent.version + 1 }
      return Promise.resolve([curent])
    },
    citește: () => Promise.resolve(opțiuni.dispare === true ? null : curent),
  }

  return {
    scriitor,
    apeluri,
    get curent() {
      return curent
    },
    /** Cineva a schimbat rândul între timp. */
    schimbăPeAscuns(peste: Partial<Item>) {
      curent = { ...curent, ...peste, version: curent.version + 1 }
    },
  }
}

describe('creează', () => {
  it('scrie doar titlul, și primește un item de inbox', async () => {
    const bază = scriitorCu(item())
    const nou = await creează(bază.scriitor, 'sun la X')

    expect(nou.state).toBe('inbox')
    expect(nou.kind).toBeNull()
    expect(nou.title).toBe('sun la X')
  })

  it('nu curăță titlul: baza e cea care refuză un titlu gol', async () => {
    const bază = scriitorCu(item())
    const nou = await creează(bază.scriitor, '  sun la X  ')
    expect(nou.title).toBe('  sun la X  ')
  })
})

describe('aplicăPatch', () => {
  it('scrie cu versiunea pe care o are ecranul', async () => {
    const bază = scriitorCu(item({ version: 4 }))
    await aplicăPatch(bază.scriitor, item({ version: 4 }), { title: 'alt titlu' }, AZI)

    expect(bază.apeluri).toEqual([
      { id: 'i1', versiune: 4, patch: { title: 'alt titlu' } },
    ])
    expect(bază.curent.version).toBe(5)
  })

  it('trimite doar câmpurile schimbate', async () => {
    const bază = scriitorCu(item())
    await aplicăPatch(bază.scriitor, item(), { due: '2026-09-05' }, AZI)

    expect(bază.apeluri[0]?.patch).toEqual({ due: '2026-09-05' })
  })

  it('pune done_at din ziua locală când itemul devine done', async () => {
    const bază = scriitorCu(item())
    const după = await aplicăPatch(bază.scriitor, item(), { state: 'done' }, AZI)

    expect(bază.apeluri[0]?.patch).toEqual({ state: 'done', done_at: AZI })
    expect(după.done_at).toBe(AZI)
  })

  it('șterge done_at când itemul se redeschide', async () => {
    const gata = item({ state: 'done', done_at: '2026-09-02' })
    const bază = scriitorCu(gata)
    await aplicăPatch(bază.scriitor, gata, { state: 'active' }, AZI)

    expect(bază.apeluri[0]?.patch).toEqual({ state: 'active', done_at: null })
  })

  it('respectă un done_at trimis anume, ca să se poată corecta ziua', async () => {
    const gata = item({ state: 'done', done_at: '2026-09-02' })
    const bază = scriitorCu(gata)
    await aplicăPatch(bază.scriitor, gata, { done_at: '2026-09-03' }, AZI)

    expect(bază.apeluri[0]?.patch).toEqual({ done_at: '2026-09-03' })
  })

  it('reîncearcă o singură dată, cu același patch, peste versiunea nouă', async () => {
    const bază = scriitorCu(item({ version: 4 }))
    // Laptopul a schimbat titlul între timp: versiunea din ecran e depășită.
    bază.schimbăPeAscuns({ title: 'schimbat pe laptop' })

    const după = await aplicăPatch(
      bază.scriitor,
      item({ version: 4 }),
      { due: '2026-09-05' },
      AZI,
    )

    expect(bază.apeluri).toEqual([
      { id: 'i1', versiune: 4, patch: { due: '2026-09-05' } },
      { id: 'i1', versiune: 5, patch: { due: '2026-09-05' } },
    ])
    // Patch-ul s-a aplicat, iar schimbarea celuilalt device n-a fost călcată.
    expect(după.due).toBe('2026-09-05')
    expect(după.title).toBe('schimbat pe laptop')
  })

  it('se oprește după a doua încercare, cu patch-ul în eroare', async () => {
    const bază = scriitorCu(item({ version: 4 }))
    // Versiunea din ecran e deja depășită...
    bază.schimbăPeAscuns({ title: 'schimbat o dată' })
    // ...și rândul se schimbă din nou chiar la recitire: a doua încercare cade
    // și ea.
    const scriitor: Scriitor = {
      ...bază.scriitor,
      citește: async () => {
        const rând = await bază.scriitor.citește('i1')
        bază.schimbăPeAscuns({ title: 'și încă o dată' })
        return rând
      },
    }

    const cădere = await aplicăPatch(
      scriitor,
      item({ version: 4 }),
      { due: '2026-09-05' },
      AZI,
    ).catch((motiv: unknown) => motiv)

    expect(cădere).toBeInstanceOf(Conflict)
    expect((cădere as Conflict).patch).toEqual({ due: '2026-09-05' })
    expect(bază.apeluri).toHaveLength(2)
  })

  it('nu reîncearcă la nesfârșit', async () => {
    const bază = scriitorCu(item({ version: 4 }))
    const scriitor: Scriitor = {
      ...bază.scriitor,
      actualizează: (id, versiune, patch) => {
        bază.apeluri.push({ id, versiune, patch })
        return Promise.resolve([])
      },
    }

    await expect(
      aplicăPatch(scriitor, item({ version: 4 }), { title: 'x' }, AZI),
    ).rejects.toBeInstanceOf(Conflict)
    expect(bază.apeluri).toHaveLength(2)
  })

  it('spune limpede când rândul nu mai e acolo', async () => {
    const bază = scriitorCu(item({ version: 9 }), { dispare: true })

    await expect(
      aplicăPatch(bază.scriitor, item({ version: 4 }), { title: 'x' }, AZI),
    ).rejects.toThrow('nu mai e acolo')
  })
})

describe('șterge', () => {
  it('e un UPDATE pe deleted_at, nu un DELETE', async () => {
    const bază = scriitorCu(item())
    const acum = new Date('2026-09-04T18:30:00.000Z')
    await șterge(bază.scriitor, item(), acum, AZI)

    expect(bază.apeluri[0]?.patch).toEqual({
      deleted_at: '2026-09-04T18:30:00.000Z',
    })
  })
})
