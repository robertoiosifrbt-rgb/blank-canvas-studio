import { beforeEach, describe, expect, it, vi } from 'vitest'

const sets: Array<{ id: string; date: string; photos: Record<string, Blob> }> = []
const saved: Array<{ id: string; date: string }> = []

vi.mock('../progress-photos/db', () => ({
  getAllPhotoSets: () => Promise.resolve(sets),
  savePhotoSet: (set: { id: string; date: string }) => { saved.push(set); return Promise.resolve() },
  onPhotoSetSaved: () => () => {},
}))

vi.mock('./cloud', () => ({ deviceToken: () => 'token-de-test-1234567890' }))

const { folderOf, splitFolder, syncPhotos } = await import('./photoCloud')

const jpeg = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
const fullSet = (id: string, date: string) => ({
  id, date,
  photos: { front: jpeg(), back: jpeg(), left: jpeg(), right: jpeg() },
})

/** Ține minte ce a cerut aplicația și răspunde ca funcția `photo-api`. */
function server(files: string[]) {
  const calls: Array<Record<string, unknown>> = []
  const fetchMock = vi.fn((_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as Record<string, unknown>
    calls.push(body)
    if (body.action === 'list') return Promise.resolve(reply({ files }))
    if (body.action === 'get') return Promise.resolve(reply({ data: 'AQID' }))
    return Promise.resolve(reply({ ok: true }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

const reply = (value: unknown) => ({ ok: true, json: () => Promise.resolve(value) })

describe('sincronizarea pozelor de progres', () => {
  beforeEach(() => {
    sets.length = 0
    saved.length = 0
    vi.unstubAllGlobals()
  })

  it('ține data setului în numele dosarului, ca să nu se piardă', () => {
    expect(folderOf('2026-09-01', 'abc')).toBe('2026-09-01~abc')
    expect(splitFolder('2026-09-01~abc')).toEqual({ date: '2026-09-01', id: 'abc' })
  })

  it('nu confundă un nume fără despărțitor cu un set', () => {
    expect(splitFolder('fara-tilda')).toBeNull()
    expect(splitFolder('~abc')).toBeNull()
    expect(splitFolder('2026-09-01~')).toBeNull()
  })

  it('urcă toate cele patru unghiuri ale unui set pe care cloud-ul nu-l are', async () => {
    sets.push(fullSet('a1', '2026-09-01'))
    const calls = server([])
    const result = await syncPhotos()
    expect(result.uploaded).toBe(4)
    expect(calls.filter(c => c.action === 'put')).toHaveLength(4)
  })

  it('nu urcă a doua oară ce e deja sus', async () => {
    sets.push(fullSet('a1', '2026-09-01'))
    server(['2026-09-01~a1/front.jpg', '2026-09-01~a1/back.jpg',
      '2026-09-01~a1/left.jpg', '2026-09-01~a1/right.jpg'])
    expect((await syncPhotos()).uploaded).toBe(0)
  })

  it('aduce un set făcut pe alt aparat', async () => {
    server(['2026-08-20~b2/front.jpg', '2026-08-20~b2/back.jpg',
      '2026-08-20~b2/left.jpg', '2026-08-20~b2/right.jpg'])
    const result = await syncPhotos()
    expect(result.downloaded).toBe(1)
    expect(saved[0]).toMatchObject({ id: 'b2', date: '2026-08-20' })
  })

  it('nu salvează un set căruia îi lipsesc unghiuri', async () => {
    server(['2026-08-20~b2/front.jpg', '2026-08-20~b2/back.jpg'])
    const result = await syncPhotos()
    expect(result.downloaded).toBe(0)
    expect(saved).toHaveLength(0)
  })

  it('nu aduce înapoi un set care e deja pe aparat', async () => {
    sets.push(fullSet('a1', '2026-09-01'))
    server(['2026-09-01~a1/front.jpg', '2026-09-01~a1/back.jpg',
      '2026-09-01~a1/left.jpg', '2026-09-01~a1/right.jpg'])
    expect((await syncPhotos()).downloaded).toBe(0)
  })

  it('spune de ce n-a mers, în loc să pară că a mers', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false, json: () => Promise.resolve({ error: 'funcția nu e pusă' }),
    })))
    const result = await syncPhotos()
    expect(result.error).toBe('funcția nu e pusă')
  })

  it('se legitimează cu codul de device, nu cu o cheie cu drepturi', async () => {
    sets.push(fullSet('a1', '2026-09-01'))
    const seen: RequestInit[] = []
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
      seen.push(init)
      return Promise.resolve(reply({ files: [] }))
    }))
    await syncPhotos()
    const headers = seen[0].headers as Record<string, string>
    expect(headers['x-device-token']).toBe('token-de-test-1234567890')

    /* Cheia din antet trece doar de poarta Supabase. Trebuie să fie cea
       publică: `service_role` în codul unei pagini web ar da oricui drepturi
       depline pe baza de date. */
    const role = JSON.parse(atob(headers.apikey.split('.')[1])) as { role: string }
    expect(role.role).toBe('anon')
  })

  it('spune că lipsește funcția când poarta răspunde fără motiv', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false, status: 404, json: () => Promise.resolve({}),
    })))
    expect((await syncPhotos()).error).toContain('photo-api')
  })
})
