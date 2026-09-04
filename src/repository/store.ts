// The cache: a complete snapshot of the user's rows, in IndexedDB, under
// namespace = auth.uid().
//
// It is never read without the currently authenticated user — otherwise
// signing out of A and into B would show, if only for a moment, A's data.
// That is why every method takes the owner instead of guessing it.

import { fromRow } from './item'
import type { Item } from './item'

export type Store = {
  readAll(owner: string): Promise<Item[]>
  cursor(owner: string): Promise<string | null>
  /**
   * Deletes everything this owner has and puts back exactly the given list.
   * Only a complete, successful snapshot has the right to do this.
   */
  replaceSnapshot(
    owner: string,
    items: Item[],
    cursor: string | null,
  ): Promise<void>
  /**
   * Adds or updates row by row. Deletes NOTHING.
   * `nextCursor === null` means "leave the cursor as it was".
   */
  upsert(owner: string, items: Item[], nextCursor: string | null): Promise<void>
}

const DB_NAME = 'life-control-centre'
const DB_VERSION = 1
const ITEMS = 'items'
const CURSORS = 'cursors'

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB refused'))
  })
}

function completed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'))
    tx.onerror = () => reject(tx.error ?? new Error('Transaction failed'))
  })
}

let db: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const opened = req.result
      if (!opened.objectStoreNames.contains(ITEMS)) {
        const items = opened.createObjectStore(ITEMS, { keyPath: 'id' })
        items.createIndex('owner', 'owner', { unique: false })
      }
      if (!opened.objectStoreNames.contains(CURSORS)) {
        opened.createObjectStore(CURSORS, { keyPath: 'owner' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB did not open'))
  })
  return db
}

/** Another user's row has no business in this namespace. */
function assertOwner(owner: string, items: Item[]) {
  for (const item of items) {
    if (item.owner !== owner) {
      throw new Error(`Row ${item.id} belongs to ${item.owner}, not to ${owner}`)
    }
  }
}

async function write(
  owner: string,
  items: Item[],
  nextCursor: string | null,
  clear: boolean,
): Promise<void> {
  assertOwner(owner, items)
  const opened = await open()
  const tx = opened.transaction([ITEMS, CURSORS], 'readwrite')
  const store = tx.objectStore(ITEMS)

  if (clear) {
    const keys = await request(store.index('owner').getAllKeys(owner))
    for (const key of keys) store.delete(key)
  }
  for (const item of items) store.put(item)

  if (nextCursor !== null || clear) {
    tx.objectStore(CURSORS).put({ owner, cursor: nextCursor })
  }

  await completed(tx)
}

export const store: Store = {
  async readAll(owner) {
    const opened = await open()
    const tx = opened.transaction(ITEMS, 'readonly')
    const rows: unknown = await request(
      tx.objectStore(ITEMS).index('owner').getAll(owner),
    )
    if (!Array.isArray(rows)) throw new Error('The cache did not return a list')
    // Rows from the cache are checked exactly like rows from the server. A
    // cache written by an older version must not enter half-formed.
    return rows.map(fromRow)
  },

  async cursor(owner) {
    const opened = await open()
    const tx = opened.transaction(CURSORS, 'readonly')
    const row: unknown = await request(tx.objectStore(CURSORS).get(owner))
    if (typeof row !== 'object' || row === null) return null
    const cursor = (row as Record<string, unknown>)['cursor']
    return typeof cursor === 'string' ? cursor : null
  },

  replaceSnapshot: (owner, items, cursor) => write(owner, items, cursor, true),

  upsert: (owner, items, nextCursor) => write(owner, items, nextCursor, false),
}
