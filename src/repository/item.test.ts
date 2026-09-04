import { describe, expect, it } from 'vitest'

import { fromRow, localToday, withDoneAt } from './item'
import type { Item } from './item'

const GOOD_ROW = {
  id: 'i1',
  owner: 'a',
  kind: 'task',
  state: 'active',
  title: 'call X',
  due: '2026-09-05',
  done_at: null,
  version: 3,
  created_at: '2026-09-01T10:00:00+00:00',
  updated_at: '2026-09-02T10:00:00+00:00',
  deleted_at: null,
}

function item(over: Partial<Item> = {}): Item {
  return { ...fromRow(GOOD_ROW), ...over }
}

describe('fromRow', () => {
  it('accepts a whole row', () => {
    expect(fromRow(GOOD_ROW)).toEqual(GOOD_ROW)
  })

  it('accepts a captured item: no kind, no dates', () => {
    const captured = fromRow({ ...GOOD_ROW, state: 'inbox', kind: null, due: null })
    expect(captured.kind).toBeNull()
    expect(captured.state).toBe('inbox')
  })

  it.each(['id', 'title', 'owner', 'state', 'created_at', 'updated_at'])(
    'refuses a row without %s',
    (key) => {
      const trimmed: Record<string, unknown> = { ...GOOD_ROW }
      delete trimmed[key]
      expect(() => fromRow(trimmed)).toThrow(`Row without ${key}`)
    },
  )

  it('refuses a state or a kind it does not know', () => {
    expect(() => fromRow({ ...GOOD_ROW, state: 'dropped' })).toThrow('Unknown state')
    expect(() => fromRow({ ...GOOD_ROW, kind: 'note' })).toThrow('Unknown kind')
  })

  it('refuses a version that is not a whole number', () => {
    expect(() => fromRow({ ...GOOD_ROW, version: '3' })).toThrow('Row without version')
    expect(() => fromRow({ ...GOOD_ROW, version: 3.5 })).toThrow('Row without version')
  })

  it('refuses anything that is not an object', () => {
    expect(() => fromRow(null)).toThrow('not an object')
    expect(() => fromRow('a row')).toThrow('not an object')
  })
})

describe('localToday', () => {
  it('gives the day from the device clock, not from UTC', () => {
    // 1 September, 23:30, in the local time of the machine running the test.
    expect(localToday(new Date(2026, 8, 1, 23, 30))).toBe('2026-09-01')
  })

  it('pads with leading zeros', () => {
    expect(localToday(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05')
  })
})

describe('withDoneAt', () => {
  const TODAY = '2026-09-04'

  it('sets the local day when an item becomes done', () => {
    expect(withDoneAt(item(), { state: 'done' }, TODAY)).toEqual({
      state: 'done',
      done_at: TODAY,
    })
  })

  it('clears done_at when an item is reopened', () => {
    const done = item({ state: 'done', done_at: '2026-09-02' })
    expect(withDoneAt(done, { state: 'active' }, TODAY)).toEqual({
      state: 'active',
      done_at: null,
    })
  })

  it('leaves done_at alone when the state does not change', () => {
    expect(withDoneAt(item(), { title: 'another title' }, TODAY)).toEqual({
      title: 'another title',
    })
    const done = item({ state: 'done', done_at: '2026-09-02' })
    expect(withDoneAt(done, { title: 'another title' }, TODAY)).toEqual({
      title: 'another title',
    })
  })

  it('keeps a done_at passed on purpose, so the day can be corrected', () => {
    const done = item({ state: 'done', done_at: '2026-09-02' })
    expect(withDoneAt(done, { done_at: '2026-09-03' }, TODAY)).toEqual({
      done_at: '2026-09-03',
    })
  })

  it('does not re-stamp an item that was already done', () => {
    const done = item({ state: 'done', done_at: '2026-09-02' })
    expect(withDoneAt(done, { state: 'done' }, TODAY)).toEqual({ state: 'done' })
  })
})
