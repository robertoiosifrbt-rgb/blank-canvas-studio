// Azi și Calendarul sunt filtre peste snapshot, aici, într-un singur loc.
//
// Regula „nu se filtrează în JavaScript" rămâne respectată: ce interzicea ea
// era logica împrăștiată prin ecrane, nu locul unde rulează.
//
// Un item mutat pe săptămâna viitoare nu iese din snapshot, iese doar din
// rezultatul Azi — „nu mai e în Azi" nu se poate confunda cu „nu mai există".

import type { Item } from './item'

/** Filtrul deleted_at is null, într-un singur loc. */
export function vii(itemi: readonly Item[]): Item[] {
  return itemi.filter((item) => item.deleted_at === null)
}

const dupăCreare = (a: Item, b: Item) => a.created_at.localeCompare(b.created_at)

const dupăScadență = (a: Item, b: Item) =>
  (a.due ?? '').localeCompare(b.due ?? '') || dupăCreare(a, b)

export type GrupuriAzi = {
  /** Lucruri capturate, despre care încă nu știi ce sunt. */
  inbox: Item[]
  azi: Item[]
  restanțe: Item[]
  fărăDată: Item[]
}

/**
 * Ce ai de făcut acum.
 *
 * OR-ul pe state e obligatoriu: Captura creează un item fără due, iar
 * `null <= azi` e fals — fără el, scrii „sun la X" și nu apare nicăieri.
 *
 * OR-ul pe „due is null" e la fel de obligatoriu: procesezi „să cumpăr
 * bormașină" ca task fără dată, iese din inbox, devine active — și fără el ar
 * dispărea. O acțiune corectă nu are voie să facă un lucru să se evapore.
 */
export function pentruAzi(itemi: readonly Item[], azi: string): GrupuriAzi {
  const deLuat = vii(itemi).filter(
    (item) =>
      item.state === 'inbox' ||
      (item.state === 'active' && (item.due === null || item.due <= azi)),
  )

  return {
    inbox: deLuat.filter((item) => item.state === 'inbox').sort(dupăCreare),
    azi: deLuat
      .filter((item) => item.state === 'active' && item.due === azi)
      .sort(dupăScadență),
    restanțe: deLuat
      .filter((item) => item.state === 'active' && item.due !== null && item.due < azi)
      .sort(dupăScadență),
    fărăDată: deLuat
      .filter((item) => item.state === 'active' && item.due === null)
      .sort(dupăCreare),
  }
}

export type ZiDeCalendar = {
  /** Ziua, ca 'YYYY-MM-DD'. */
  zi: string
  /** Ce ai planificat pe ziua asta: due. */
  planificat: Item[]
  /** Ce s-a întâmplat în ziua asta: done_at. */
  făcut: Item[]
}

/**
 * Zilele, cu ce ai planificat și ce ai făcut. Fără tabel nou.
 *
 * Un task due luni și terminat miercuri apare la ambele. Un task fără dată,
 * terminat, apare miercuri — de-aia done_at există, ca nimic terminat să nu
 * dispară din toate ecranele.
 */
export function pentruCalendar(itemi: readonly Item[]): ZiDeCalendar[] {
  const zile = new Map<string, ZiDeCalendar>()

  const ziua = (zi: string): ZiDeCalendar => {
    const existentă = zile.get(zi)
    if (existentă !== undefined) return existentă
    const nouă: ZiDeCalendar = { zi, planificat: [], făcut: [] }
    zile.set(zi, nouă)
    return nouă
  }

  for (const item of vii(itemi)) {
    if (item.due !== null) ziua(item.due).planificat.push(item)
    if (item.done_at !== null) ziua(item.done_at).făcut.push(item)
  }

  for (const zi of zile.values()) {
    zi.planificat.sort(dupăCreare)
    zi.făcut.sort(dupăCreare)
  }

  return [...zile.values()].sort((a, b) => a.zi.localeCompare(b.zi))
}
