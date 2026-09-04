import { useCallback, useEffect, useState } from 'react'

import {
  all,
  capture as captureItem,
  Conflict,
  discard as discardItem,
  exportAll,
  syncAccount,
  update as updateItem,
} from '../repository/items'
import type { Item, Patch } from '../repository/items'
import { downloadText } from '../ui/download'

/**
 * What the sync indicator is allowed to say.
 *
 * There is no state that means "synced" while it is not. A failure stays
 * visible with its reason, because the rows on screen then come from the cache
 * and may be stale.
 */
export type SyncState =
  | { kind: 'never' }
  | { kind: 'syncing' }
  | { kind: 'synced'; at: Date; fetched: number }
  | { kind: 'failed'; reason: string }

/** A patch that could not be written, kept visible until you retry it. */
export type Unsaved = { item: Item; patch: Patch; reason: string }

export type ItemsHandle = {
  items: Item[]
  loading: boolean
  sync: SyncState
  unsaved: Unsaved[]
  resync: () => void
  capture: (title: string) => Promise<void>
  update: (item: Item, patch: Patch) => Promise<void>
  discard: (item: Item) => Promise<void>
  retry: (itemId: string) => Promise<void>
  download: () => Promise<void>
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The items of the signed-in account, and everything you can do to them.
 *
 * It reads the cache first so the screen paints straight away, then syncs and
 * reads it again. A failed sync leaves the cached rows alone — that is the
 * whole point of holding a snapshot.
 */
export function useItems(owner: string): ItemsHandle {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [sync, setSync] = useState<SyncState>({ kind: 'never' })
  const [unsaved, setUnsaved] = useState<Unsaved[]>([])
  const [round, setRound] = useState(0)

  const reload = useCallback(async () => {
    setItems(await all(owner))
  }, [owner])

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const cached = await all(owner)
        if (active) {
          setItems(cached)
          setLoading(false)
        }
      } catch (error) {
        // An unreadable cache is not a reason to hide the app: the sync below
        // replaces it with a full snapshot.
        console.warn('The cache could not be read:', error)
        if (active) setLoading(false)
      }

      if (active) setSync({ kind: 'syncing' })
      try {
        const result = await syncAccount(owner)
        const fresh = await all(owner)
        if (active) {
          setItems(fresh)
          setSync({ kind: 'synced', at: new Date(), fetched: result.fetched })
        }
      } catch (error) {
        if (active) setSync({ kind: 'failed', reason: reasonOf(error) })
      }
    }

    void run()
    return () => {
      active = false
    }
  }, [owner, round])

  /** Runs a write, keeping an unresolved conflict visible instead of losing it. */
  const write = useCallback(
    async (body: () => Promise<Item>) => {
      try {
        await body()
      } catch (error) {
        if (error instanceof Conflict) {
          setUnsaved((left) => [
            ...left.filter((u) => u.item.id !== error.item.id),
            { item: error.item, patch: error.patch, reason: error.message },
          ])
        } else {
          setSync({ kind: 'failed', reason: reasonOf(error) })
          throw error
        }
      } finally {
        await reload()
      }
    },
    [reload],
  )

  return {
    items,
    loading,
    sync,
    unsaved,

    resync: () => setRound((n) => n + 1),

    capture: (title) => write(() => captureItem(owner, title)),

    update: (item, patch) =>
      write(async () => {
        const written = await updateItem(owner, item, patch, new Date())
        setUnsaved((left) => left.filter((u) => u.item.id !== item.id))
        return written
      }),

    discard: (item) =>
      write(async () => {
        const written = await discardItem(owner, item, new Date())
        setUnsaved((left) => left.filter((u) => u.item.id !== item.id))
        return written
      }),

    retry: async (itemId) => {
      const stuck = unsaved.find((u) => u.item.id === itemId)
      if (stuck === undefined) return
      const fresh = items.find((i) => i.id === itemId) ?? stuck.item
      await write(async () => {
        const written = await updateItem(owner, fresh, stuck.patch, new Date())
        setUnsaved((left) => left.filter((u) => u.item.id !== itemId))
        return written
      })
    },

    download: async () => {
      const file = await exportAll(owner, new Date())
      downloadText(file.name, file.contents)
    },
  }
}
