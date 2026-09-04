/*
 * photo-api — pozele de progres, în Supabase Storage.
 *
 * De ce o funcție și nu apeluri directe din aplicație: cheia `anon` ajunge în
 * codul site-ului, deci o are oricine deschide aplicația. Un bucket care
 * acceptă `anon` ar fi, practic, public — iar astea sunt poze de progres.
 *
 * Aici cheia care are voie la Storage (`service_role`) rămâne pe server și nu
 * pleacă niciodată în browser. Cine cere ceva se legitimează cu `x-device-token`,
 * exact ca la `state-api`, iar tokenul e și dosarul în care stau pozele lui:
 * fără token nu se poate citi nimic, iar cu un token nu se poate ajunge la
 * pozele altuia.
 *
 * Se pune o singură dată, în panoul Supabase → Edge Functions, cu numele
 * `photo-api`. Bucket-urile le creează singură, la prima urcare în fiecare.
 */

/*
 * Două depozite, ținute separat: pozele de progres și scanurile documentelor.
 * Numele vine din cerere, dar numai din lista asta — o cerere nu are voie să
 * inventeze un bucket, altcineva l-ar putea umple cu ce vrea.
 */
const BUCKETS = ['progress-photos', 'documents'] as const
const DEFAULT_BUCKET = 'progress-photos'

/* Ce se poate urca. Fără listă, un fișier .html urcat aici s-ar deschide ca
   pagină pe domeniul Supabase, cu tot ce înseamnă asta. */
const TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

const pickBucket = (value: unknown): string =>
  BUCKETS.includes(value as typeof BUCKETS[number]) ? (value as string) : DEFAULT_BUCKET

const pickType = (value: unknown): string =>
  TYPES.includes(value as typeof TYPES[number]) ? (value as string) : 'image/jpeg'

const storage = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/storage/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...(init.headers ?? {}),
    },
  })

/* Bucket privat: nimic nu se citește fără cheia de serviciu, deci nici cu
   adresa fișierului ghicită. 409 înseamnă că există deja. */
async function ensureBucket(bucket: string): Promise<void> {
  const response = await storage('bucket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: bucket, name: bucket, public: false }),
  })
  if (!response.ok && response.status !== 409) {
    throw new Error(`bucket ${bucket}: ${await response.text()}`)
  }
}

function decodeBase64(data: string): Uint8Array {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/* Numai ce poate sta într-o cale de fișier. Tokenul și numele vin din cerere,
   deci nu au voie să iasă din dosarul lor cu `..` sau cu bare. */
const safe = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/[^A-Za-z0-9~._-]/g, '') : ''

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const token = safe(request.headers.get('x-device-token'))
  if (token.length < 16) return json({ error: 'device token lipsă' }, 401)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return json({ error: 'corp invalid' }, 400)
  }

  const action = body.action
  const folder = safe(body.folder)
  const name = safe(body.name)
  /* Lipsă, e cel al pozelor: aplicația veche nu trimite nimic aici și trebuie
     să meargă mai departe neschimbată. */
  const bucket = pickBucket(body.bucket)

  try {
    if (action === 'list') {
      await ensureBucket(bucket)
      const response = await storage(`object/list/${bucket}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: `${token}/`, limit: 10_000 }),
      })
      if (!response.ok) throw new Error(await response.text())
      /* Storage listează un nivel odată: întâi dosarele setului, apoi
         fișierele din fiecare. */
      const folders = (await response.json()) as Array<{ name: string }>
      const files: string[] = []
      for (const entry of folders) {
        const inner = await storage(`object/list/${bucket}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix: `${token}/${entry.name}/`, limit: 1_000 }),
        })
        if (!inner.ok) continue
        for (const file of (await inner.json()) as Array<{ name: string }>) {
          files.push(`${entry.name}/${file.name}`)
        }
      }
      return json({ files })
    }

    if (action === 'put') {
      if (!folder || !name) return json({ error: 'cale lipsă' }, 400)
      await ensureBucket(bucket)
      const response = await storage(`object/${bucket}/${token}/${folder}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': pickType(body.type), 'x-upsert': 'true' },
        body: decodeBase64(String(body.data ?? '')),
      })
      if (!response.ok) throw new Error(await response.text())
      return json({ ok: true })
    }

    if (action === 'get') {
      if (!folder || !name) return json({ error: 'cale lipsă' }, 400)
      const response = await storage(`object/${bucket}/${token}/${folder}/${name}`)
      if (!response.ok) return json({ error: 'nu există' }, 404)
      return json({
        type: response.headers.get('content-type') ?? 'application/octet-stream',
        data: encodeBase64(new Uint8Array(await response.arrayBuffer())),
      })
    }

    if (action === 'delete') {
      if (!folder) return json({ error: 'cale lipsă' }, 400)
      const response = await storage(`object/${bucket}/${token}/${folder}/${name}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error(await response.text())
      return json({ ok: true })
    }

    return json({ error: 'acțiune necunoscută' }, 400)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
