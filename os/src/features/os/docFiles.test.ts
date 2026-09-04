import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./cloud', () => ({ deviceToken: () => 'token-de-test-1234567890' }))

const { deleteDocFile, openDocFile, uploadDocFile, MAX_FILE_BYTES } = await import('./docFiles')

const sent: Array<Record<string, unknown>> = []
const answer = (value: unknown, ok = true, status = 200) => ({
  ok, status, text: () => Promise.resolve(JSON.stringify(value)),
})

function server(reply: unknown = { ok: true }) {
  vi.stubGlobal('fetch', vi.fn((_url: string, init: { body: string; headers: Record<string, string> }) => {
    sent.push({ ...JSON.parse(init.body), headers: init.headers })
    return Promise.resolve(answer(reply))
  }))
}

const pdf = (bytes = 10, type = 'application/pdf') =>
  new File([new Uint8Array(bytes)], 'scrisoare.pdf', { type })

describe('scanurile atașate documentelor', () => {
  beforeEach(() => { sent.length = 0; vi.unstubAllGlobals() })

  it('urcă în bucketul documentelor, nu peste poze', async () => {
    server()
    await uploadDocFile('doc1', pdf())
    expect(sent[0].bucket).toBe('documents')
    expect(sent[0].folder).toBe('doc1')
  })

  it('trimite tipul fișierului, ca să nu ajungă un PDF salvat ca poză', async () => {
    server()
    await uploadDocFile('doc1', pdf())
    expect(sent[0].type).toBe('application/pdf')
  })

  it('păstrează numele scris de om și îl salvează sub un id', async () => {
    server()
    const stored = await uploadDocFile('doc1', pdf())
    expect(stored.name).toBe('scrisoare.pdf')
    expect(sent[0].name).toBe(`${stored.id}.pdf`)
  })

  it('refuză ce nu e PDF sau poză', async () => {
    server()
    await expect(uploadDocFile('doc1', new File(['x'], 'a.html', { type: 'text/html' })))
      .rejects.toThrow(/PDF/)
    expect(sent).toHaveLength(0)
  })

  it('refuză un fișier prea mare, spunând cât are', async () => {
    server()
    await expect(uploadDocFile('doc1', pdf(MAX_FILE_BYTES + 1))).rejects.toThrow(/limita e 4 MB/)
    expect(sent).toHaveLength(0)
  })

  it('se legitimează cu codul de device și cu cheia publică', async () => {
    server()
    await uploadDocFile('doc1', pdf())
    const headers = sent[0].headers as Record<string, string>
    expect(headers['x-device-token']).toBe('token-de-test-1234567890')
    expect(headers.apikey.startsWith('sb_publishable_')).toBe(true)
  })

  it('citește fișierul înapoi ca adresă de deschis', async () => {
    server({ data: 'AQID', type: 'application/pdf' })
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} })
    const url = await openDocFile('doc1', { id: 'f1', name: 'x.pdf', type: 'application/pdf', size: 3 })
    expect(url).toBe('blob:test')
  })

  it('spune când fișierul nu mai e în cloud', async () => {
    server({})
    await expect(openDocFile('doc1', { id: 'f1', name: 'x.pdf', type: 'application/pdf', size: 3 }))
      .rejects.toThrow(/nu mai e/)
  })

  it('șterge fix fișierul cerut, din bucketul lui', async () => {
    server()
    await deleteDocFile('doc1', { id: 'f1', name: 'x.pdf', type: 'application/pdf', size: 3 })
    expect(sent[0]).toMatchObject({ action: 'delete', bucket: 'documents', folder: 'doc1', name: 'f1.pdf' })
  })
})
