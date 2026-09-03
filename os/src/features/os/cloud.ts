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

/** Ce e în sertarul nostru, sau `null` dacă nu s-a salvat nimic încă. */
export async function loadRemote(): Promise<unknown | null> {
  const payload = (await call({ action: 'load' })).state?.payload ?? {}
  const raw = payload[OS_SLOT]
  if (typeof raw !== 'string' || !raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Citește payload-ul întreg, îl rescrie cu sertarul nostru înlocuit. */
export async function saveRemote(value: unknown): Promise<void> {
  const current = (await call({ action: 'load' })).state?.payload ?? {}
  const payload: Payload = { ...current, [OS_SLOT]: JSON.stringify(value) }
  await call({ action: 'save', payload })
}
