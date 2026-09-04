import { deviceToken } from './cloud'
import type { DocFile } from './types'

/**
 * Scanurile documentelor, în Supabase Storage.
 *
 * Merg prin aceeași funcție ca pozele de progres, dar în alt bucket:
 * `documents`. Fișierul stă sub dosarul documentului, iar dosarul sub tokenul
 * tău — fără el nu se ajunge la nimic, cu al tău nu se ajunge la altcineva.
 *
 * Lista fișierelor stă în document, deci se sincronizează cu restul datelor;
 * conținutul stă în Storage, pentru că un PDF n-are ce căuta într-o coloană
 * de text.
 */

const PHOTO_API = 'https://xmhvkgoxhoiuiigimied.supabase.co/functions/v1/photo-api'
const PUBLISHABLE_KEY = 'sb_publishable_0Qj9Bhx7hFvcRJ2AI_8R8g_WFw2uGwy'
const BUCKET = 'documents'

/** Peste atât, o cerere devine incomodă pentru funcție. Un scan A4 e sub 1 MB. */
export const MAX_FILE_BYTES = 4_000_000

export const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'] as const

const EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

interface Reply { data?: string; type?: string; error?: string; message?: string }

async function call(body: Record<string, unknown>): Promise<Reply> {
  const response = await fetch(PHOTO_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-token': deviceToken(),
      apikey: PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ ...body, bucket: BUCKET }),
  })
  const raw = await response.text()
  let reply: Reply = {}
  try { reply = JSON.parse(raw) as Reply } catch { /* rămâne textul brut */ }
  if (!response.ok) throw new Error(reply.error ?? reply.message ?? raw.slice(0, 200) ?? `eroare ${response.status}`)
  return reply
}

async function toBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  /* Pe bucăți: `String.fromCharCode(...bytes)` cu un fișier de un megabyte
     depășește numărul de argumente pe care le acceptă un apel. */
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  return btoa(binary)
}

function fromBase64(data: string, type: string): Blob {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

/** Numele din Storage; cel scris de om rămâne în document, cu diacritice cu tot. */
const storedName = (file: DocFile): string => `${file.id}.${EXTENSION[file.type] ?? 'bin'}`

export async function uploadDocFile(docId: string, file: File): Promise<DocFile> {
  if (!ALLOWED.includes(file.type as typeof ALLOWED[number])) {
    throw new Error('Se pot atașa doar PDF-uri și poze.')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`Fișierul are ${Math.round(file.size / 1024 / 1024 * 10) / 10} MB; limita e 4 MB.`)
  }
  const stored: DocFile = { id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size }
  await call({ action: 'put', folder: docId, name: storedName(stored), type: file.type, data: await toBase64(file) })
  return stored
}

export async function openDocFile(docId: string, file: DocFile): Promise<string> {
  const reply = await call({ action: 'get', folder: docId, name: storedName(file) })
  if (!reply.data) throw new Error('Fișierul nu mai e în cloud.')
  return URL.createObjectURL(fromBase64(reply.data, reply.type ?? file.type))
}

export async function deleteDocFile(docId: string, file: DocFile): Promise<void> {
  await call({ action: 'delete', folder: docId, name: storedName(file) })
}
