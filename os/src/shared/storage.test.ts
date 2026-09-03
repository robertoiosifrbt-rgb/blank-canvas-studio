import { describe, expect, it, vi } from 'vitest'
import { CORRUPT_SUFFIX, readJson, recoverArray, writeJson } from './storage'

interface Item {
  id: string
}

const recoverItems = recoverArray<Item>((entry) =>
  typeof entry === 'object' && entry !== null && typeof (entry as Item).id === 'string'
    ? { value: { id: (entry as Item).id } }
    : null,
)

const KEY = 'test:items'

describe('readJson', () => {
  it('returns the fallback without an error when nothing is stored', () => {
    expect(readJson(KEY, [], recoverItems)).toEqual({ value: [], error: null })
  })

  it('returns stored data untouched when it is valid', () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 'a' }, { id: 'b' }]))
    expect(readJson(KEY, [], recoverItems)).toEqual({
      value: [{ id: 'a' }, { id: 'b' }],
      error: null,
    })
  })

  // The bug this guards: a bare JSON.parse threw during the first render, and
  // the whole page went down — including the keys that were still fine.
  it('does not throw on corrupt JSON, and reports it', () => {
    localStorage.setItem(KEY, '{"broken')

    const result = readJson(KEY, [], recoverItems)

    expect(result.value).toEqual([])
    expect(result.error).toMatch(/unreadable/i)
  })

  it('keeps a copy of corrupt JSON instead of discarding it', () => {
    localStorage.setItem(KEY, '{"broken')

    readJson(KEY, [], recoverItems)

    expect(localStorage.getItem(`${KEY}${CORRUPT_SUFFIX}`)).toBe('{"broken')
  })

  it('never overwrites an existing backup with a later, more damaged value', () => {
    localStorage.setItem(`${KEY}${CORRUPT_SUFFIX}`, 'the original')
    localStorage.setItem(KEY, 'not json either')

    readJson(KEY, [], recoverItems)

    expect(localStorage.getItem(`${KEY}${CORRUPT_SUFFIX}`)).toBe('the original')
  })

  it('keeps the usable entries when only some are malformed', () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 'a' }, { nope: 1 }, 42, { id: 'b' }]))

    const result = readJson(KEY, [], recoverItems)

    expect(result.value).toEqual([{ id: 'a' }, { id: 'b' }])
    expect(result.error).toMatch(/2 saved entries could not be read/i)
    expect(localStorage.getItem(`${KEY}${CORRUPT_SUFFIX}`)).not.toBeNull()
  })

  it('reports entries that were kept with values blanked out', () => {
    const recoverLossy = recoverArray<Item>(() => ({ value: { id: 'x' }, lossy: true }))
    localStorage.setItem(KEY, JSON.stringify([{ id: 'a' }]))

    const result = readJson(KEY, [], recoverLossy)

    expect(result.value).toEqual([{ id: 'x' }])
    expect(result.error).toMatch(/left blank/i)
  })

  it('falls back when the stored value is valid JSON of the wrong shape', () => {
    localStorage.setItem(KEY, JSON.stringify({ notAnArray: true }))

    const result = readJson(KEY, [], recoverItems)

    expect(result.value).toEqual([])
    expect(result.error).not.toBeNull()
  })

  it('survives storage being unavailable entirely', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('access denied', 'SecurityError')
    })

    const result = readJson(KEY, [], recoverItems)

    expect(result.value).toEqual([])
    expect(result.error).toMatch(/could not be read/i)
    getItem.mockRestore()
  })
})

describe('writeJson', () => {
  it('stores the value and reports success', () => {
    expect(writeJson(KEY, [{ id: 'a' }])).toEqual({ ok: true })
    expect(localStorage.getItem(KEY)).toBe('[{"id":"a"}]')
  })

  // The bug this guards: a refused write used to leave the UI showing the new
  // value, so the change looked saved until the next reload.
  it('reports failure when the quota is exceeded', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('exceeded', 'QuotaExceededError')
    })

    const result = writeJson(KEY, [{ id: 'a' }])

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/out of storage space/i)
    setItem.mockRestore()
  })

  it('reports failure when storage is blocked', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    const result = writeJson(KEY, [{ id: 'a' }])

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/private browsing/i)
    setItem.mockRestore()
  })

  it('reports failure for values that cannot be serialised', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(writeJson(KEY, circular).ok).toBe(false)
  })
})
