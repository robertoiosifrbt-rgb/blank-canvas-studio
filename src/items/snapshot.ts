// Everything the screens hold, read from the cache in one go.
//
// One function because it was written out three times — on first paint, after
// a sync, and after every write — and three copies of "what the screens need"
// drift apart the moment a sixth thing is added. The fifth one was added
// today and two of the three copies had to be found by the compiler.

import {
  all,
  areasOf,
  reservesOf,
  runningCostsOf,
  shiftsOf,
} from '../repository/items'
import type { Area, Item, Reserves, RunningCosts, Shift } from '../repository/items'

export type Snapshot = {
  items: Item[]
  areas: Area[]
  shifts: Shift[]
  reserves: Reserves | null
  costs: RunningCosts[]
}

/**
 * The whole cache for one account.
 *
 * Together, not one after another: an item names an area and a shift carries
 * rates, so a screen holding one of them fresh and another stale shows a row
 * pointing at nothing, or a cost of nothing where there is a cost.
 */
export async function readSnapshot(owner: string): Promise<Snapshot> {
  const [items, areas, shifts, reserves, costs] = await Promise.all([
    all(owner),
    areasOf(owner),
    shiftsOf(owner),
    reservesOf(owner),
    runningCostsOf(owner),
  ])
  return { items, areas, shifts, reserves, costs }
}
