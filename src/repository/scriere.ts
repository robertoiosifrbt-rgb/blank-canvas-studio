// Scrierea: pe rând, nu rescriere de tot.
//
// Verificarea de versiune e atomică, într-un singur UPDATE condiționat. Nu
// „citesc 4, verific în JavaScript, scriu 5" — două device-uri pot trece
// verificarea în același timp.

import { cuFăcutLa, dinRând } from './item'
import type { Item, Patch } from './item'

export type Scriitor = {
  /** Inserează un rând nou. Owner-ul îl pune baza, din auth.uid(). */
  inserează(valori: { title: string }): Promise<unknown>
  /**
   * update items set <patch>
   * where id = :id and owner = auth.uid() and version = :version
   *
   * Întoarce rândurile afectate: unul, sau niciunul dacă versiunea nu se mai
   * potrivește.
   */
  actualizează(id: string, versiune: number, patch: Patch): Promise<unknown[]>
  /** Rândul curent, pentru o singură reîncercare. `null` = nu mai există. */
  citește(id: string): Promise<unknown>
}

/**
 * Patch-ul n-a putut fi scris nici după reîncercare.
 *
 * Poartă cu el itemul și patch-ul, ca ecranul să-l poată ține vizibil
 * nesalvat. Nu se persistă local: un draft persistat e outbox, iar outbox la
 * pasul 4 e sync-ul construit de două ori. Promisiunea mai mică e cea
 * adevărată — dacă închizi aplicația, pierzi acea editare.
 */
export class Conflict extends Error {
  readonly item: Item
  readonly patch: Patch

  constructor(item: Item, patch: Patch, mesaj: string) {
    super(mesaj)
    this.name = 'Conflict'
    this.item = item
    this.patch = patch
  }
}

/**
 * Captura: scrie doar titlul.
 *
 * Fără dată, fără întrebări: state='inbox' și kind=null vin din bază. Titlul
 * pleacă exact cum a fost scris — ce poate garanta baza nu se verifică aici.
 */
export async function creează(scriitor: Scriitor, titlu: string): Promise<Item> {
  return dinRând(await scriitor.inserează({ title: titlu }))
}

/**
 * Aplică un patch, cu o singură reîncercare peste versiunea nouă.
 *
 * Patch-ul e doar câmpurile schimbate. Altfel telefonul care schimbă due ar
 * scrie peste title schimbat pe laptop.
 */
export async function aplicăPatch(
  scriitor: Scriitor,
  item: Item,
  patch: Patch,
  azi: string,
): Promise<Item> {
  const deScris = cuFăcutLa(item, patch, azi)

  const dintâi = await scriitor.actualizează(item.id, item.version, deScris)
  if (dintâi.length === 1) return dinRând(dintâi[0])

  // Zero rânduri afectate: se recitește rândul și se reaplică același patch
  // peste versiunea nouă. O singură dată.
  const acum = await scriitor.citește(item.id)
  if (acum === null) {
    throw new Conflict(item, deScris, 'Rândul nu mai e acolo.')
  }
  const proaspăt = dinRând(acum)

  const adoua = await scriitor.actualizează(proaspăt.id, proaspăt.version, deScris)
  if (adoua.length === 1) return dinRând(adoua[0])

  // Și al doilea UPDATE a dat zero rânduri: se oprește.
  throw new Conflict(
    proaspăt,
    deScris,
    'Altcineva a schimbat rândul în același timp. Nesalvat.',
  )
}

/** Ștergerea e un UPDATE pe deleted_at. Clientul n-are DELETE. */
export function șterge(
  scriitor: Scriitor,
  item: Item,
  acum: Date,
  azi: string,
): Promise<Item> {
  return aplicăPatch(scriitor, item, { deleted_at: acum.toISOString() }, azi)
}
