import { getAllPhotoSets, onPhotoSetSaved, savePhotoSet } from '../progress-photos/db'
import { isValidPhotoSet, PHOTO_ANGLES, type PhotoAngle } from '../progress-photos/types'
import { deviceToken } from './cloud'

/**
 * Pozele de progres, sincronizate prin funcția `photo-api`.
 *
 * Ele nu stau în `localStorage` ca restul datelor sălii, ci în `indexedDB`,
 * pentru că sunt de ordinul sutelor de kilobytes fiecare. De aceea nu intră în
 * sertarul comun de text, ci în Supabase Storage, prin funcția care ține cheia
 * de Storage pe server. Aplicația nu vede niciodată cheia aia: trimite doar
 * codul de device, iar funcția îi dă doar dosarul lui.
 *
 * Un set e un dosar, `data~id`, cu patru fișiere înăuntru. Data stă în numele
 * dosarului pentru că altfel s-ar pierde: Storage ține fișiere, nu câmpuri.
 */

const PHOTO_API = 'https://xmhvkgoxhoiuiigimied.supabase.co/functions/v1/photo-api'

/*
 * Cheia publică a proiectului, cerută de poarta Supabase la fiecare apel de
 * funcție. Nu dă niciun drept: e făcută să stea în codul unei pagini web, iar
 * `photo-api` nu se uită la ea — ea cere `x-device-token` și ține cheia cu
 * drepturi (`service_role`) pe server. Fără antetul ăsta, poarta răspunde 401
 * înainte ca funcția să apuce să vadă cererea.
 */
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtaHZrZ294aG9pdWlpZ2ltaWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzOTg4NjQsImV4cCI6MjEwMTk3NDg2NH0' +
  '.DBTyUsE63fe6w5KxWy3LL_H7prQ7ERJDN1SQVfhgAGc'

interface Reply {
  files?: string[]
  data?: string
  error?: string
}

async function call(body: Record<string, unknown>): Promise<Reply> {
  const response = await fetch(PHOTO_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-token': deviceToken(),
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })
  const reply = (await response.json().catch(() => ({}))) as Reply
  if (!response.ok) {
    /* Funcția noastră scrie întotdeauna un motiv. Un răspuns fără el vine de
       dinaintea ei — de la poartă — și înseamnă aproape sigur că funcția nu e
       pusă în Supabase. Merită spus, altfel „eroare 404" nu ajută pe nimeni. */
    if (reply.error) throw new Error(reply.error)
    throw new Error(
      `Supabase a răspuns ${response.status} înainte de funcție. ` +
      'Verifică dacă funcția `photo-api` e pusă în proiect.',
    )
  }
  return reply
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(data: string): Blob {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: 'image/jpeg' })
}

export const folderOf = (date: string, id: string): string => `${date}~${id}`

/** Desface `2026-09-01~uuid` înapoi în data și id-ul setului. */
export function splitFolder(folder: string): { date: string; id: string } | null {
  const cut = folder.indexOf('~')
  if (cut < 1 || cut === folder.length - 1) return null
  return { date: folder.slice(0, cut), id: folder.slice(cut + 1) }
}

export interface PhotoSync {
  uploaded: number
  downloaded: number
  error: string | null
}

/**
 * Într-un singur sens nu ar fi de ajuns: telefonul are poze pe care laptopul
 * nu le are și invers. Se urcă ce lipsește sus, se coboară ce lipsește jos, și
 * nimic nu se șterge — un set lipsă înseamnă „nu a ajuns încă aici", nu
 * „șters".
 */
export async function syncPhotos(): Promise<PhotoSync> {
  let uploaded = 0
  let downloaded = 0
  try {
    const remote = new Set((await call({ action: 'list' })).files ?? [])
    const local = (await getAllPhotoSets()).filter(isValidPhotoSet)

    for (const set of local) {
      const folder = folderOf(set.date, set.id)
      for (const angle of PHOTO_ANGLES) {
        if (remote.has(`${folder}/${angle}.jpg`)) continue
        await call({
          action: 'put', folder, name: `${angle}.jpg`,
          data: await toBase64(set.photos[angle]),
        })
        uploaded += 1
      }
    }

    const here = new Set(local.map(set => set.id))
    const folders = new Set<string>()
    for (const file of remote) {
      const cut = file.indexOf('/')
      if (cut > 0) folders.add(file.slice(0, cut))
    }

    for (const folder of folders) {
      const parts = splitFolder(folder)
      if (!parts || here.has(parts.id)) continue
      const photos: Partial<Record<PhotoAngle, Blob>> = {}
      for (const angle of PHOTO_ANGLES) {
        if (!remote.has(`${folder}/${angle}.jpg`)) continue
        const reply = await call({ action: 'get', folder, name: `${angle}.jpg` })
        if (reply.data) photos[angle] = fromBase64(reply.data)
      }
      /* Un set incomplet nu se poate afișa — galeria cere patru unghiuri —
         așa că se lasă în cloud până ajung toate, nu se salvează pe jumătate. */
      if (PHOTO_ANGLES.every(angle => photos[angle])) {
        await savePhotoSet({
          id: parts.id, date: parts.date,
          photos: photos as Record<PhotoAngle, Blob>,
        })
        downloaded += 1
      }
    }

    return { uploaded, downloaded, error: null }
  } catch (error) {
    return { uploaded, downloaded, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * O poză nouă pleacă la 3 secunde după ce s-a salvat. Sunt patru scrieri
 * pentru un set și fiecare e de sute de kilobytes, deci nu pornim urcarea la
 * prima; și oricum utilizatorul mai adaugă unul imediat, de obicei.
 */
let timer: ReturnType<typeof setTimeout> | undefined
let running = false

export function watchPhotos(onDone: (result: PhotoSync) => void): () => void {
  const stop = onPhotoSetSaved(() => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (running) return
      running = true
      void syncPhotos().then(result => { running = false; onDone(result) })
    }, 3_000)
  })
  return () => { stop(); clearTimeout(timer) }
}
