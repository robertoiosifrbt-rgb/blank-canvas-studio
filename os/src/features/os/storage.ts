import { readJson, writeJson } from '../../shared/storage'
import { emptyOsData, type OsData } from './types'
import { loadRemote } from './cloud'
import { applyChanges, currentSession, loadRows } from './db'
import { changesBetween, fromRows, isEmpty, toRows, type Rows } from './dbRows'

/**
 * Copia locală e oglinda: aplicația se deschide instant și merge fără
 * internet. Sincronizarea vine peste ea când răspunde.
 */
export const OS_KEY = 'roberto-os-v1'

/** Umple câmpurile lipsă în loc să arunce datele care nu se potrivesc exact. */
function recover(parsed: unknown): { value: OsData; dropped: number } {
  const base = emptyOsData()
  if (!parsed || typeof parsed !== 'object') return { value: base, dropped: 0 }
  const raw = parsed as Partial<OsData>
  const pick = <K extends keyof OsData>(key: K): OsData[K] => {
    const value = raw[key]
    return value && typeof value === 'object' ? (value as OsData[K]) : base[key]
  }
  return {
    value: {
      modules: pick('modules'), goals: pick('goals'), tasks: pick('tasks'),
      habits: pick('habits'), notes: pick('notes'), debts: pick('debts'),
      orgs: pick('orgs'), vehicles: pick('vehicles'), workdays: pick('workdays'),
      fuel: pick('fuel'), carCosts: pick('carCosts'),
      docs: pick('docs'), finance: pick('finance'),
      settings: { ...base.settings, ...(raw.settings ?? {}) },
    },
    dropped: 0,
  }
}

export function readLocal(): { value: OsData; error: string | null } {
  return readJson<OsData>(OS_KEY, emptyOsData(), recover)
}

export function writeLocal(data: OsData): { ok: boolean; error?: string } {
  const result = writeJson(OS_KEY, data)
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}

export type SyncMode = 'cloud' | 'local'

export interface PullResult {
  data: OsData
  mode: SyncMode
  error: string | null
  /** Fără cont nu există cloud: datele rămân pe telefon până te loghezi. */
  signedIn: boolean
}

/** Ce credem că ține baza acum. Din el se scade ce s-a schimbat. */
let known: Rows | null = null
let owner: string | null = null

const has = (data: OsData): boolean =>
  [data.modules, data.goals, data.tasks, data.habits, data.notes, data.debts, data.orgs,
    data.vehicles, data.workdays, data.fuel, data.carCosts, data.docs, data.finance]
    .some(group => Object.keys(group).length > 0)

/**
 * Datele dinainte de mutare: textul din `app_state`.
 *
 * Se citește o singură dată, la prima intrare cu cont, și numai dacă baza e
 * goală. Nu se șterge după — dacă ceva nu iese cum trebuie, de acolo se ia
 * înapoi.
 */
async function oldBlob(): Promise<OsData | null> {
  try {
    const remote = await loadRemote()
    return remote ? recover(remote).value : null
  } catch {
    return null
  }
}

/**
 * Pornirea: copia locală se vede imediat, apoi vine ce e în bază.
 *
 * Dacă baza e goală, urcăm ce avem — întâi copia locală, iar dacă nici ea nu
 * are nimic, textul vechi. Așa mutarea se face singură, de pe orice device
 * te loghezi prima oară.
 */
export async function pull(): Promise<PullResult> {
  const local = readLocal()
  const session = await currentSession()
  if (!session) {
    known = null
    owner = null
    return { data: local.value, mode: 'local', error: null, signedIn: false }
  }
  owner = session.user.id

  try {
    const rows = await loadRows()
    if (isEmpty(rows)) {
      const source = has(local.value) ? local.value : (await oldBlob()) ?? local.value
      const next = toRows(source)
      await applyChanges(changesBetween(rows, next), owner)
      known = next
      writeLocal(source)
      return { data: source, mode: 'cloud', error: null, signedIn: true }
    }
    const data = fromRows(rows)
    known = rows
    writeLocal(data)
    return { data, mode: 'cloud', error: null, signedIn: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { data: local.value, mode: 'local', error: message, signedIn: true }
  }
}

/** Salvează local imediat; urcarea e amânată ca să nu plece la fiecare tastă. */
export function persist(data: OsData, mode: SyncMode): { ok: boolean; error?: string } {
  const written = writeLocal(data)
  if (mode === 'cloud') schedulePush(data)
  return written
}

let pushTimer: ReturnType<typeof setTimeout> | undefined
let onPushError: ((message: string) => void) | undefined
/* Salvările trec una după alta: două deodată ar pleca amândouă de la aceeași
   stare știută, iar a doua ar crede că nu s-a schimbat ce tocmai a scris prima. */
let queue: Promise<void> = Promise.resolve()

export function setPushErrorHandler(handler: (message: string) => void): void {
  onPushError = handler
}

function schedulePush(data: OsData): void {
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    const next = queue.then(async () => {
      if (!owner || !known) return
      const after = toRows(data)
      const changes = changesBetween(known, after)
      if (changes.length === 0) return
      await applyChanges(changes, owner)
      known = after
    })
    queue = next.catch(() => undefined)
    next.catch((error: unknown) => {
      onPushError?.(error instanceof Error ? error.message : String(error))
    })
  }, 700)
}

/** După logare sau delogare, ce știam despre bază nu mai e valabil. */
export function forgetKnown(): void {
  known = null
  owner = null
}
