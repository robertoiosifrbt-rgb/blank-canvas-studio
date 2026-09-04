import { deviceToken } from './cloud'

/**
 * Notificări pe telefon, prin funcțiile care există deja în Supabase.
 *
 * `push-api` primește abonamentul acestui telefon și, separat, lista de
 * alarme; `send-push-alarms` le trimite când le vine ora. Se legitimează cu
 * același cod de device ca restul aplicației, deci nu e nimic nou de pus.
 *
 * Lista se trimite întreagă de fiecare dată, nu pe bucăți: serverul o
 * înlocuiește. Așa, o alarmă ștearsă de aici chiar dispare, în loc să rămână
 * acolo și să sune pentru ceva ce nu mai există.
 */

const PUSH_API = 'https://xmhvkgoxhoiuiigimied.supabase.co/functions/v1/push-api'
const PUBLISHABLE_KEY = 'sb_publishable_0Qj9Bhx7hFvcRJ2AI_8R8g_WFw2uGwy'
const VAPID_PUBLIC_KEY =
  'BJZ22QScbxYl8uXqm6hylyXxZHs10hGieEwBLz5nxENiTjq2UckaT7qPhMsR5rrhQIUOOaz9biNnfiJOEl1bXGQ'

export interface Alarm {
  id: string
  title: string
  body: string
  url: string
  scheduledAt: string
}

function serverKey(): ArrayBuffer {
  const padded = VAPID_PUBLIC_KEY + '='.repeat((4 - VAPID_PUBLIC_KEY.length % 4) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

async function call(body: unknown): Promise<void> {
  const response = await fetch(PUSH_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-token': deviceToken(),
      apikey: PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const raw = await response.text()
    let said = raw.slice(0, 200)
    try { said = (JSON.parse(raw) as { error?: string }).error ?? said } catch { /* text brut */ }
    throw new Error(`${response.status}: ${said}`)
  }
}

const isIOS = (): boolean => /iPad|iPhone|iPod/.test(navigator.userAgent)

const installed = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

/** Ce se poate spune despre notificări fără să ceri nimic utilizatorului. */
export type PushState = 'pornite' | 'oprite' | 'refuzate' | 'nu-se-poate' | 'de-instalat'

export async function pushState(): Promise<PushState> {
  /* Pe iPhone, Apple dă voie la notificări web numai din aplicația pusă pe
     ecranul principal. Din Safari obișnuit nu există cale de ocolit. */
  if (isIOS() && !installed()) return 'de-instalat'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'nu-se-poate'
  }
  if (Notification.permission === 'denied') return 'refuzate'
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    return subscription ? 'pornite' : 'oprite'
  } catch {
    return 'oprite'
  }
}

/** Cere permisiunea, abonează telefonul, îl înregistrează la server. */
export async function enablePush(): Promise<void> {
  if (isIOS() && !installed()) {
    throw new Error('Pe iPhone, notificările merg doar din aplicația instalată. Share → Add to Home Screen, apoi deschide-o de acolo.')
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Browserul ăsta nu știe notificări push.')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(`Permisiunea e „${permission}". Dă-o din setările telefonului.`)

  await navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href)
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
    ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: serverKey(),
    })
  await call({ action: 'subscribe', subscription: subscription.toJSON() })
}

/** Trimite lista de alarme. `false` dacă telefonul nu e abonat încă. */
export async function syncAlarms(alarms: Alarm[]): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return false
  await call({ action: 'sync', endpoint: subscription.endpoint, alarms })
  return true
}
