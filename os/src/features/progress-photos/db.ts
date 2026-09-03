import type { ProgressPhotoSet } from './types'

const DB_NAME = 'gym-app'
const STORE_NAME = 'progress-photos'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (error) {
      // Private windows and some locked-down configurations throw here rather
      // than firing onerror.
      reject(error instanceof Error ? error : new Error(String(error)))
      return
    }
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the photo database'))
    // Without this, an open request held up by another tab never settles and
    // the caller waits forever with no error to show.
    request.onblocked = () =>
      reject(new Error('Another tab is using an older version of this app — close it and reload'))
  })
}

export async function getAllPhotoSets(): Promise<ProgressPhotoSet[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not read the saved photos'))
  })
}

export async function savePhotoSet(photoSet: ProgressPhotoSet): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(photoSet)
    // Resolve on `oncomplete`, not on the put's `onsuccess`: only a completed
    // transaction means the data is actually durable.
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not save the photos'))
    tx.onabort = () => reject(tx.error ?? new Error('Saving the photos was interrupted'))
  })
}

/**
 * Replaces every saved photo set in one IndexedDB transaction.
 * `clear` and all `put`s either commit together or the browser rolls the whole
 * transaction back, so a failed restore cannot leave half old / half new photos.
 */
export async function replaceAllPhotoSets(photoSets: ProgressPhotoSet[]): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.clear()
    for (const photoSet of photoSets) store.put(photoSet)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not restore the progress photos'))
    tx.onabort = () => reject(tx.error ?? new Error('Restoring the progress photos was interrupted'))
  })
}
