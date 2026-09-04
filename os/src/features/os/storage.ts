import { readJson, writeJson } from '../../shared/storage'
import { emptyOsData, type OsData } from './types'
import { loadRemote, saveRemote } from './cloud'

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
}

/**
 * Pornirea: arată imediat copia locală, apoi încearcă sincronizarea. Dacă
 * sertarul din cloud e gol, urcă ce e local — altfel nu s-ar crea niciodată.
 */
export async function pull(): Promise<PullResult> {
  const local = readLocal()
  try {
    const remote = await loadRemote()
    if (remote === null) {
      await saveRemote(local.value)
      return { data: local.value, mode: 'cloud', error: null }
    }
    const merged = recover(remote).value
    writeLocal(merged)
    return { data: merged, mode: 'cloud', error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { data: local.value, mode: 'local', error: message }
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

export function setPushErrorHandler(handler: (message: string) => void): void {
  onPushError = handler
}

function schedulePush(data: OsData): void {
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    saveRemote(data).catch((error: unknown) => {
      onPushError?.(error instanceof Error ? error.message : String(error))
    })
  }, 700)
}
