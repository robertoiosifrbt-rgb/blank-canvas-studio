// IndexedDB does not exist in Node, so a fake implementation of the same API
// is used. What gets exercised is the real adapter, not a test double.
import 'fake-indexeddb/auto'

import { describe, expect, it } from 'vitest'

import type { Item } from './item'
import { store } from './store'

function item(id: string, owner: string, over: Partial<Item> = {}): Item {
  return {
    id,
    owner,
    kind: null,
    state: 'inbox',
    title: `title ${id}`,
    due: null,
    done_at: null,
    version: 1,
    created_at: '2026-09-01T10:00:00+00:00',
    updated_at: '2026-09-01T10:00:00+00:00',
    deleted_at: null,
    ...over,
  }
}

describe('store', () => {
  it('keeps each account inside its own namespace', async () => {
    const [a, b] = ['n1-a', 'n1-b']
    await store.replaceSnapshot(a, [item('a1', a)], 'cursor-a')
    await store.replaceSnapshot(b, [item('b1', b)], 'cursor-b')

    expect((await store.readAll(a)).map((i) => i.id)).toEqual(['a1'])
    expect((await store.readAll(b)).map((i) => i.id)).toEqual(['b1'])
    expect(await store.cursor(a)).toBe('cursor-a')
    expect(await store.cursor(b)).toBe('cursor-b')
  })

  it('one account snapshot does not touch the other account', async () => {
    const [a, b] = ['n2-a', 'n2-b']
    await store.replaceSnapshot(a, [item('a1', a)], 'c-a')
    await store.replaceSnapshot(b, [item('b1', b), item('b2', b)], 'c-b')

    await store.replaceSnapshot(a, [], null)

    expect(await store.readAll(a)).toEqual([])
    expect((await store.readAll(b)).map((i) => i.id).sort()).toEqual(['b1', 'b2'])
    expect(await store.cursor(b)).toBe('c-b')
  })

  it('an account with nothing cached has no cursor', async () => {
    expect(await store.cursor('n3-new')).toBeNull()
    expect(await store.readAll('n3-new')).toEqual([])
  })

  it('upsert adds and updates, but deletes nothing', async () => {
    const a = 'n4-a'
    await store.replaceSnapshot(a, [item('one', a), item('two', a)], 'c1')

    await store.upsert(
      a,
      [item('two', a, { title: 'changed', version: 2 }), item('three', a)],
      'c2',
    )

    const items = await store.readAll(a)
    expect(items.map((i) => i.id).sort()).toEqual(['one', 'three', 'two'])
    expect(items.find((i) => i.id === 'two')?.title).toBe('changed')
    expect(await store.cursor(a)).toBe('c2')
  })

  it('an empty upsert with a null cursor leaves everything exactly as it was', async () => {
    const a = 'n5-a'
    await store.replaceSnapshot(a, [item('one', a)], 'c1')

    await store.upsert(a, [], null)

    expect((await store.readAll(a)).map((i) => i.id)).toEqual(['one'])
    expect(await store.cursor(a)).toBe('c1')
  })

  it('keeps deleted rows too — that is why we hold them', async () => {
    const a = 'n6-a'
    await store.replaceSnapshot(
      a,
      [item('deleted', a, { deleted_at: '2026-09-02T08:00:00+00:00' })],
      'c1',
    )
    expect(await store.readAll(a)).toHaveLength(1)
  })

  it('refuses a row belonging to another account', async () => {
    const a = 'n7-a'
    await expect(
      store.upsert(a, [item('smuggled', 'someone-else')], null),
    ).rejects.toThrow('not to n7-a')
    expect(await store.readAll(a)).toEqual([])
  })

  it('does not pass on a broken row from the cache', async () => {
    const a = 'n8-a'
    await store.replaceSnapshot(a, [item('good', a)], 'c1')

    // A row written by an older version of the app, with no title.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('life-control-centre')
      req.onsuccess = () => {
        const tx = req.result.transaction('items', 'readwrite')
        tx.objectStore('items').put({ id: 'broken', owner: a })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(new Error('could not break it'))
      }
      req.onerror = () => reject(new Error('did not open'))
    })

    await expect(store.readAll(a)).rejects.toThrow(/Row without/)
  })
})
