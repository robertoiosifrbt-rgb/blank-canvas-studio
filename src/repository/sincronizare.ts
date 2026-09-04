// Snapshot, nu cache pe query.
//
// Regula cea mai importantă din tot planul stă aici: un delta cu două rânduri
// NU înlocuiește snapshot-ul, și un delta gol înseamnă „nimic nu s-a
// schimbat", nu „golește cache-ul". Un răspuns parțial nu e niciodată tratat
// ca adevăr întreg.

import type { Depozit } from './depozit'
import { dinRând } from './item'
import type { Item } from './item'

/** Supabase întoarce implicit maximum 1000 de rânduri per request. */
export const PAGINĂ = 1000

export type Sursă = {
  /**
   * O pagină de rânduri, inclusiv cele cu deleted_at — de-aia le ținem.
   * `dinCursor === null` cere tot; altfel cere `updated_at >= dinCursor`.
   */
  pagină(opțiuni: {
    deLa: number
    pânăLa: number
    dinCursor: string | null
  }): Promise<unknown[]>
}

export type Sincronizare = {
  fel: 'complet' | 'delta'
  aduse: number
  cursor: string | null
}

/**
 * Toate paginile, până una vine mai scurtă decât maximul.
 *
 * Fără paginare, „se aduc toate" devine fals la al 1001-lea item — și devine
 * fals în silence, care e mai rău.
 */
async function adunăTot(sursă: Sursă, dinCursor: string | null): Promise<Item[]> {
  const itemi: Item[] = []
  for (let deLa = 0; ; deLa += PAGINĂ) {
    const rânduri = await sursă.pagină({
      deLa,
      pânăLa: deLa + PAGINĂ - 1,
      dinCursor,
    })
    for (const rând of rânduri) itemi.push(dinRând(rând))
    if (rânduri.length < PAGINĂ) return itemi
  }
}

/**
 * Cel mai nou updated_at din rândurile aduse, sau null dacă n-a venit niciunul.
 *
 * Cursorul vine de la server, niciodată de la ceasul telefonului: e chiar
 * valoarea pe care baza a scris-o prin trigger.
 */
export function celMaiNou(itemi: readonly Item[]): string | null {
  let cursor: string | null = null
  let cânt = -Infinity
  for (const item of itemi) {
    const clipa = Date.parse(item.updated_at)
    if (Number.isNaN(clipa)) throw new Error(`updated_at nevalid: ${item.updated_at}`)
    if (clipa > cânt) {
      cânt = clipa
      cursor = item.updated_at
    }
  }
  return cursor
}

/**
 * Aduce ce s-a schimbat și pune în cache.
 *
 * Orice eșec al aducerii se aruncă înainte să se atingă cache-ul: un fetch
 * căzut nu are voie să strice ce era deja bun.
 */
export async function sincronizează(
  owner: string,
  sursă: Sursă,
  depozit: Depozit,
): Promise<Sincronizare> {
  const cursorVechi = await cursorulDacăEUnul(owner, depozit)

  if (cursorVechi === null) {
    // Prima intrare cu contul ăsta: snapshot complet.
    const itemi = await adunăTot(sursă, null)
    const cursor = celMaiNou(itemi)
    // Un snapshot complet și reușit înlocuiește cache-ul chiar dacă e gol —
    // golul poate fi legitim, ai șters ultimul item.
    await depozit.înlocuieșteSnapshot(owner, itemi, cursor)
    return { fel: 'complet', aduse: itemi.length, cursor }
  }

  // Cursorul e inclusiv, nu deștept: pentru că upsert-ul e idempotent, un rând
  // adus de două ori nu strică nimic. Așa dispare problema a două modificări
  // cu același updated_at, fără cursor compus.
  const itemi = await adunăTot(sursă, cursorVechi)
  const cursorNou = celMaiNou(itemi)
  // Upsert rând cu rând. Nu înlocuiește nimic, deci un delta gol lasă cache-ul
  // exact cum era.
  await depozit.upsertă(owner, itemi, cursorNou)
  return { fel: 'delta', aduse: itemi.length, cursor: cursorNou ?? cursorVechi }
}

/** Un cache neinițializat sau necitibil se tratează ca prima intrare. */
async function cursorulDacăEUnul(
  owner: string,
  depozit: Depozit,
): Promise<string | null> {
  try {
    return await depozit.cursorul(owner)
  } catch {
    return null
  }
}
