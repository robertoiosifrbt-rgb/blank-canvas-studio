import { onWrite } from '../../shared/storage'
import { GYM_SLOT, loadRemote, saveRemote } from './cloud'

/**
 * Aplicația de sală nu are server: scrie tot în browserul de pe device-ul
 * unde ai introdus datele. Aici i se pune același cloud ca al OS-ului, fără
 * să se umble în codul ei.
 *
 * Merge pe cheile brute din `localStorage`, nu pe structurile ei. Așa
 * sincronizarea nu trebuie schimbată când sala își schimbă formatul, și nu
 * poate strica date pe care nu le înțelege: ce urcă e exact ce era scris.
 *
 * Pozele de progres NU intră aici. Ele stau în `indexedDB`, sunt de ordinul
 * megabyte-ilor și ar umple sertarul comun. Rămân pe device, cu exportul din
 * setările sălii ca singură copie.
 */

const PREFIX = 'gym-app:'
const CORRUPT = ':corrupt'

/** Peste atât nu urcăm: sertarul e o singură coloană de text în Supabase. */
const MAX_BYTES = 700_000

export type Snapshot = Record<string, string>

/** Adevărat cât timp scriem noi, ca aplicarea de la cloud să nu se re-urce. */
let applying = false

function gymKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX) && !key.endsWith(CORRUPT)) keys.push(key)
  }
  return keys
}

export function localSnapshot(): Snapshot {
  const snapshot: Snapshot = {}
  try {
    for (const key of gymKeys()) {
      const raw = localStorage.getItem(key)
      if (raw !== null) snapshot[key] = raw
    }
  } catch {
    /* stocare blocată: se sincronizează ce am apucat să citim */
  }
  return snapshot
}

/** Ce a venit din cloud e text străin până se dovedește altfel. */
export function asSnapshot(value: unknown): Snapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const snapshot: Snapshot = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith(PREFIX) && typeof raw === 'string') snapshot[key] = raw
  }
  return snapshot
}

/** Numele cheii cu cel mai mult text, pentru mesajul de eroare. */
export function biggestKey(snapshot: Snapshot): string {
  let name = ''
  let size = -1
  for (const [key, raw] of Object.entries(snapshot)) {
    if (raw.length > size) { name = key; size = raw.length }
  }
  return name
}

function applySnapshot(snapshot: Snapshot): void {
  applying = true
  try {
    /* Snapshot-ul e complet, deci ce lipsește din el a fost șters pe celălalt
       device. Fără pasul ăsta, ștergerile nu s-ar propaga niciodată. */
    for (const key of gymKeys()) {
      if (!(key in snapshot)) localStorage.removeItem(key)
    }
    for (const [key, raw] of Object.entries(snapshot)) localStorage.setItem(key, raw)
  } catch {
    /* stocarea a refuzat: rămân datele locale, se reîncearcă la următoarea pornire */
  } finally {
    applying = false
  }
}

export interface GymPull {
  /** Câte chei au venit din cloud. `null` când sertarul era gol. */
  applied: number | null
  error: string | null
}

/**
 * La pornire: dacă sertarul din cloud are date, ele câștigă — sunt cele mai
 * recente de pe oricare device. Dacă e gol, urcăm ce e pe device-ul ăsta,
 * altfel nu s-ar crea niciodată.
 */
export async function pullGym(): Promise<GymPull> {
  try {
    const remote = asSnapshot(await loadRemote(GYM_SLOT))
    if (remote === null || Object.keys(remote).length === 0) {
      const local = localSnapshot()
      if (Object.keys(local).length > 0) await pushGym()
      return { applied: null, error: null }
    }
    applySnapshot(remote)
    return { applied: Object.keys(remote).length, error: null }
  } catch (error) {
    return { applied: null, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function pushGym(): Promise<void> {
  const snapshot = localSnapshot()
  const size = JSON.stringify(snapshot).length
  if (size > MAX_BYTES) {
    const key = biggestKey(snapshot)
    throw new Error(
      `Datele de la sală au ajuns la ${Math.round(size / 1024)} KB și nu mai încap în cloud. ` +
      `Cel mai mult ocupă „${key}”. Până se face loc, sala rămâne doar pe device-ul ăsta.`,
    )
  }
  await saveRemote(snapshot, GYM_SLOT)
}

/**
 * Urcă la 1,5 secunde după ultima scriere. Sala salvează la fiecare serie
 * bifată, iar fără amânare fiecare bifă ar fi o cerere de rețea.
 */
let timer: ReturnType<typeof setTimeout> | undefined

export function watchGym(onError: (message: string) => void): () => void {
  const stop = onWrite(key => {
    if (applying || !key.startsWith(PREFIX) || key.endsWith(CORRUPT)) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      pushGym().catch((error: unknown) => {
        onError(error instanceof Error ? error.message : String(error))
      })
    }, 1_500)
  })
  return () => { stop(); clearTimeout(timer) }
}
