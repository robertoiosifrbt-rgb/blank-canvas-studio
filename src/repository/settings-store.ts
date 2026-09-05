// Where the settings sit in the cache.
//
// Apart from store.ts because that file was at 295 of its 300 lines, and
// because these two are not snapshots of a synced table: they are one row for
// the person and one per area, replaced whole, with no cursor between them.

import type { Expense } from './expense'
import type { Reserves, RunningCosts } from './settings'
import { completed, open, request, STORES } from './store'

const { RESERVES, COSTS, EXPENSES } = STORES

/**
 * The settings, kept the same way the shift parts are: whole, no cursor.
 *
 * Reserves are one row keyed by the person, so there is no index to read them
 * by — the key is the account. Running costs are one per area, so they are
 * read by owner like everything else.
 */
export const settingsStore = {
  async reserves(owner: string): Promise<Reserves | null> {
    const opened = await open()
    const tx = opened.transaction(RESERVES, 'readonly')
    const row: unknown = await request(tx.objectStore(RESERVES).get(owner))
    return row === undefined ? null : (row as Reserves)
  },

  async replaceReserves(owner: string, reserves: Reserves | null): Promise<void> {
    if (reserves !== null && reserves.owner !== owner) {
      throw new Error(`Reserves belong to ${reserves.owner}, not to ${owner}`)
    }
    const opened = await open()
    const tx = opened.transaction(RESERVES, 'readwrite')
    if (reserves === null) tx.objectStore(RESERVES).delete(owner)
    else tx.objectStore(RESERVES).put(reserves)
    await completed(tx)
  },

  async costs(owner: string): Promise<RunningCosts[]> {
    const opened = await open()
    const tx = opened.transaction(COSTS, 'readonly')
    const rows: unknown = await request(
      tx.objectStore(COSTS).index('owner').getAll(owner),
    )
    if (!Array.isArray(rows)) throw new Error('The cache did not return a list')
    return rows as RunningCosts[]
  },

  async replaceCosts(owner: string, costs: readonly RunningCosts[]): Promise<void> {
    for (const row of costs) {
      if (row.owner !== owner) {
        throw new Error(`Costs for ${row.area_id} belong to ${row.owner}`)
      }
    }
    const opened = await open()
    const tx = opened.transaction(COSTS, 'readwrite')
    const store = tx.objectStore(COSTS)
    const keys = await request(store.index('owner').getAllKeys(owner))
    for (const key of keys) store.delete(key)
    for (const row of costs) store.put(row)
    await completed(tx)
  },
}

/** The expenses, replaced whole for the same reason the shift parts are. */
export const expenseStore = {
  async readAll(owner: string): Promise<Expense[]> {
    const opened = await open()
    const tx = opened.transaction(EXPENSES, 'readonly')
    const rows: unknown = await request(
      tx.objectStore(EXPENSES).index('owner').getAll(owner),
    )
    if (!Array.isArray(rows)) throw new Error('The cache did not return a list')
    return rows as Expense[]
  },

  async replaceAll(owner: string, expenses: readonly Expense[]): Promise<void> {
    for (const expense of expenses) {
      if (expense.owner !== owner) {
        throw new Error(`Expense ${expense.item_id} belongs to ${expense.owner}`)
      }
    }
    const opened = await open()
    const tx = opened.transaction(EXPENSES, 'readwrite')
    const store = tx.objectStore(EXPENSES)
    const keys = await request(store.index('owner').getAllKeys(owner))
    for (const key of keys) store.delete(key)
    for (const expense of expenses) store.put(expense)
    await completed(tx)
  },
}
