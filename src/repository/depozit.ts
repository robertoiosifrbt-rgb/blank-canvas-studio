// Cache-ul: un snapshot complet al rândurilor utilizatorului, în IndexedDB,
// sub namespace = auth.uid().
//
// Nu se citește niciodată fără user-ul autentificat curent — altfel logout din
// A și login în B ar arăta, măcar o clipă, datele lui A. De-aia fiecare metodă
// cere owner-ul, nu îl ghicește.

import { dinRând } from './item'
import type { Item } from './item'

export type Depozit = {
  citeșteTot(owner: string): Promise<Item[]>
  cursorul(owner: string): Promise<string | null>
  /**
   * Șterge tot ce are owner-ul ăsta și pune la loc exact lista dată.
   * Numai un snapshot complet și reușit are dreptul la asta.
   */
  înlocuieșteSnapshot(
    owner: string,
    itemi: Item[],
    cursor: string | null,
  ): Promise<void>
  /**
   * Adaugă sau actualizează rând cu rând. NU șterge nimic.
   * `cursorNou === null` înseamnă „lasă cursorul cum era".
   */
  upsertă(owner: string, itemi: Item[], cursorNou: string | null): Promise<void>
}

const NUME_BAZĂ = 'life-control-centre'
const VERSIUNE = 1
const ITEMI = 'items'
const CURSOARE = 'cursoare'

function cerere<T>(cerută: IDBRequest<T>): Promise<T> {
  return new Promise((gata, cade) => {
    cerută.onsuccess = () => gata(cerută.result)
    cerută.onerror = () => cade(cerută.error ?? new Error('IndexedDB a refuzat'))
  })
}

function terminată(tranzacție: IDBTransaction): Promise<void> {
  return new Promise((gata, cade) => {
    tranzacție.oncomplete = () => gata()
    tranzacție.onabort = () => cade(tranzacție.error ?? new Error('Tranzacție anulată'))
    tranzacție.onerror = () => cade(tranzacție.error ?? new Error('Tranzacție căzută'))
  })
}

let bază: Promise<IDBDatabase> | null = null

function deschide(): Promise<IDBDatabase> {
  bază ??= new Promise((gata, cade) => {
    const cerută = indexedDB.open(NUME_BAZĂ, VERSIUNE)
    cerută.onupgradeneeded = () => {
      const bd = cerută.result
      if (!bd.objectStoreNames.contains(ITEMI)) {
        const magazin = bd.createObjectStore(ITEMI, { keyPath: 'id' })
        magazin.createIndex('owner', 'owner', { unique: false })
      }
      if (!bd.objectStoreNames.contains(CURSOARE)) {
        bd.createObjectStore(CURSOARE, { keyPath: 'owner' })
      }
    }
    cerută.onsuccess = () => gata(cerută.result)
    cerută.onerror = () => cade(cerută.error ?? new Error('IndexedDB nu s-a deschis'))
  })
  return bază
}

/** Un rând al altui utilizator nu are ce căuta în namespace-ul ăsta. */
function verificăProprietarul(owner: string, itemi: Item[]) {
  for (const item of itemi) {
    if (item.owner !== owner) {
      throw new Error(
        `Rândul ${item.id} e al lui ${item.owner}, nu al lui ${owner}`,
      )
    }
  }
}

async function scrie(
  owner: string,
  itemi: Item[],
  cursorNou: string | null,
  golește: boolean,
): Promise<void> {
  verificăProprietarul(owner, itemi)
  const bd = await deschide()
  const tranzacție = bd.transaction([ITEMI, CURSOARE], 'readwrite')
  const magazin = tranzacție.objectStore(ITEMI)

  if (golește) {
    const chei = await cerere(magazin.index('owner').getAllKeys(owner))
    for (const cheie of chei) magazin.delete(cheie)
  }
  for (const item of itemi) magazin.put(item)

  if (cursorNou !== null || golește) {
    tranzacție.objectStore(CURSOARE).put({ owner, cursor: cursorNou })
  }

  await terminată(tranzacție)
}

export const depozitul: Depozit = {
  async citeșteTot(owner) {
    const bd = await deschide()
    const tranzacție = bd.transaction(ITEMI, 'readonly')
    const rânduri: unknown = await cerere(
      tranzacție.objectStore(ITEMI).index('owner').getAll(owner),
    )
    if (!Array.isArray(rânduri)) throw new Error('Cache-ul nu a întors o listă')
    // Rândurile din cache se verifică la fel ca cele de la server. Un cache
    // scris de o versiune mai veche nu are voie să intre pe jumătate.
    return rânduri.map(dinRând)
  },

  async cursorul(owner) {
    const bd = await deschide()
    const tranzacție = bd.transaction(CURSOARE, 'readonly')
    const rând: unknown = await cerere(tranzacție.objectStore(CURSOARE).get(owner))
    if (typeof rând !== 'object' || rând === null) return null
    const cursor = (rând as Record<string, unknown>)['cursor']
    return typeof cursor === 'string' ? cursor : null
  },

  înlocuieșteSnapshot: (owner, itemi, cursor) => scrie(owner, itemi, cursor, true),

  upsertă: (owner, itemi, cursorNou) => scrie(owner, itemi, cursorNou, false),
}
