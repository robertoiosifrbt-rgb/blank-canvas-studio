// Fața pe care o văd ecranele. Cer și primesc; Supabase nu se vede niciodată.
//
//     UI → repository → Supabase

import { sesiuneaCurentă } from './auth'
import type { Sesiune } from './auth'
import { depozitul } from './depozit'
import { fișierDeExport } from './export'
import type { Fișier } from './export'
import { pentruAzi, pentruCalendar } from './filtre'
import type { GrupuriAzi, ZiDeCalendar } from './filtre'
import { aziLocal } from './item'
import type { Item, Patch } from './item'
import { aplicăPatch, creează, șterge } from './scriere'
import { sincronizează } from './sincronizare'
import type { Sincronizare } from './sincronizare'
import { scriitorulSupabase, sursaSupabase } from './sursa'

export type { Item, Patch } from './item'
export type { GrupuriAzi, ZiDeCalendar } from './filtre'
export type { Sincronizare } from './sincronizare'
export { Conflict } from './scriere'

/**
 * Verifică că namespace-ul cerut e chiar al utilizatorului autentificat acum.
 *
 * Cache-ul nu se citește niciodată fără user-ul curent: altfel logout din A și
 * login în B ar arăta, măcar o clipă, datele lui A.
 */
export function confirmăContul(owner: string, sesiune: Sesiune | null): void {
  if (sesiune === null) {
    throw new Error('Nu e nimeni autentificat. Cache-ul nu se citește.')
  }
  if (sesiune.utilizator !== owner) {
    throw new Error(
      `Cache-ul cerut e al lui ${owner}, dar contul curent e altul.`,
    )
  }
}

async function contul(owner: string): Promise<void> {
  confirmăContul(owner, await sesiuneaCurentă())
}

/** Aduce ce s-a schimbat și pune în cache. Prima dată, tot. */
export async function sincronizeazăContul(owner: string): Promise<Sincronizare> {
  await contul(owner)
  return sincronizează(owner, sursaSupabase(), depozitul)
}

/** Tot ce e în cache pentru contul ăsta, inclusiv rândurile șterse. */
export async function totul(owner: string): Promise<Item[]> {
  await contul(owner)
  return depozitul.citeșteTot(owner)
}

/** Ce ai de făcut acum. Filtru peste snapshot, nu interogare nouă. */
export async function azi(owner: string, acum: Date): Promise<GrupuriAzi> {
  await contul(owner)
  return pentruAzi(await depozitul.citeșteTot(owner), aziLocal(acum))
}

/** Zilele, cu ce ai planificat și ce ai făcut. */
export async function calendar(owner: string): Promise<ZiDeCalendar[]> {
  await contul(owner)
  return pentruCalendar(await depozitul.citeșteTot(owner))
}

/** Captura: un titlu, nimic altceva. */
export async function capturează(owner: string, titlu: string): Promise<Item> {
  await contul(owner)
  return păstrează(owner, await creează(scriitorulSupabase(owner), titlu))
}

/** Modifică un item, cu verificare de versiune. Aruncă Conflict dacă nu ține. */
export async function modifică(
  owner: string,
  item: Item,
  patch: Patch,
  acum: Date,
): Promise<Item> {
  await contul(owner)
  return păstrează(
    owner,
    await aplicăPatch(scriitorulSupabase(owner), item, patch, aziLocal(acum)),
  )
}

/** Ștergerea e un UPDATE pe deleted_at. Rândul rămâne, ca sync-ul să-l ducă. */
export async function aruncă(owner: string, item: Item, acum: Date): Promise<Item> {
  await contul(owner)
  return păstrează(
    owner,
    await șterge(scriitorulSupabase(owner), item, acum, aziLocal(acum)),
  )
}

/** „Descarcă tot": snapshot-ul întreg, ca fișier. */
export async function exportăTot(owner: string, acum: Date): Promise<Fișier> {
  await contul(owner)
  const [itemi, cursor] = await Promise.all([
    depozitul.citeșteTot(owner),
    depozitul.cursorul(owner),
  ])
  return fișierDeExport(owner, itemi, cursor, acum)
}

/**
 * Rândul întors de server intră în cache pe loc.
 *
 * Cursorul nu se mișcă: rândul ăsta va veni oricum la următorul delta, iar un
 * cursor mutat pe o singură scriere ar putea sări peste ce a scris altcineva
 * între timp.
 */
async function păstrează(owner: string, item: Item): Promise<Item> {
  await depozitul.upsertă(owner, [item], null)
  return item
}
