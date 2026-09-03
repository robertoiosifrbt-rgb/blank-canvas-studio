/**
 * Sincronizare prin funcția Edge `state-api`, aceeași pe care o folosește
 * celălalt proiect. Nu cere cheie Supabase: se autentifică printr-un antet
 * `x-device-token`.
 *
 * Datele stau sub o cheie proprie în payload-ul comun, iar fiecare salvare
 * rescrie payload-ul cu doar acea cheie schimbată — restul aplicațiilor care
 * folosesc aceeași funcție rămân neatinse.
 */

const STATE_API = 'https://xmhvkgoxhoiuiigimied.supabase.co/functions/v1/state-api'
const TOKEN_KEY = 'pushDeviceToken'
export const OS_SLOT = 'roberto-os-v1'
export const GYM_SLOT = 'gym-app-v1'

type Payload = Record<string, string | null>

export function deviceToken(): string {
  try {
    let token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')
      localStorage.setItem(TOKEN_KEY, token)
    }
    return token
  } catch {
    return ''
  }
}

export function setDeviceToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token.trim())
  } catch {
    /* stocarea blocată: sincronizarea rămâne pe tokenul din memorie */
  }
}

async function call(body: unknown): Promise<{ state?: { payload?: Payload } }> {
  const response = await fetch(STATE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-device-token': deviceToken() },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error((data as { error?: string }).error ?? `eroare ${response.status}`)
  return data as { state?: { payload?: Payload } }
}

/** Ce e într-un sertar, sau `null` dacă nu s-a salvat nimic încă în el. */
export async function loadRemote(slot: string = OS_SLOT): Promise<unknown | null> {
  const payload = (await call({ action: 'load' })).state?.payload ?? {}
  const raw = payload[slot]
  if (typeof raw !== 'string' || !raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Citește payload-ul întreg, îl rescrie cu un singur sertar înlocuit.
 *
 * Sertarele sunt separate, dar salvarea e citire-apoi-scriere peste payload-ul
 * comun. Două salvări pornite în același timp — OS-ul și sala — ar citi
 * amândouă starea dinainte, iar a doua ar scrie peste ce tocmai a pus prima.
 * De aceea trec una după alta, nu în paralel.
 */
let queue: Promise<unknown> = Promise.resolve()

export function saveRemote(value: unknown, slot: string = OS_SLOT): Promise<void> {
  const next = queue.then(async () => {
    const current = (await call({ action: 'load' })).state?.payload ?? {}
    const payload: Payload = { ...current, [slot]: JSON.stringify(value) }
    await call({ action: 'save', payload })
  })
  /* Coada nu se oprește dacă o salvare eșuează; eroarea rămâne pentru apelant. */
  queue = next.catch(() => undefined)
  return next
}
