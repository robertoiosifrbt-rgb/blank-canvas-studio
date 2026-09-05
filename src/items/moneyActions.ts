// Everything you do to money: the shifts, what went out, and the settings
// behind both.
//
// Apart from useItems because that file is a hook with a lifecycle in it —
// what to read, when to read it again, what to do about a write that failed —
// and this is a plain list of writes. They grew together past the 300 lines
// the checker allows, which was the point at which the difference between
// them became worth having.
//
// Every one goes through the same `write`: a failed write is still a failed
// write whether it was a task, a fill-up or a percentage.

import {
  createShift,
  endSession as endShiftSession,
  recordExpense,
  removeExpense,
  removeSession as removeShiftSession,
  saveReserves,
  saveRunningCosts,
  saveTaxYear,
  saveShift,
  setEarning,
  startSession,
} from '../repository/items'
import type {
  Category,
  Item,
  Platform,
  ShiftPatch,
  TaxYearPatch,
} from '../repository/items'

type Write = (body: () => Promise<unknown>) => Promise<void>

export type MoneyActions = {
  spend: (what: {
    day: string
    area_id: string | null
    title: string
    category: Category
    amount: number
    odo: number | null
    full_tank: boolean | null
  }) => Promise<void>
  unspend: (item: Item) => Promise<void>
  saveReserves: (tax_pct: number, ni_pct: number) => Promise<void>
  saveTaxYear: (year: TaxYearPatch) => Promise<void>
  saveCosts: (
    area_id: string,
    fuel_per_km: number,
    vehicle_per_km: number,
  ) => Promise<void>
  startShift: (day: string, area_id: string | null) => Promise<void>
  saveShiftParts: (item_id: string, patch: ShiftPatch) => Promise<void>
  clockOn: (item_id: string) => Promise<void>
  clockOff: (sessionId: string) => Promise<void>
  dropSession: (sessionId: string) => Promise<void>
  setPaid: (item_id: string, platform: Platform, amount: number) => Promise<void>
}

export function moneyActions(owner: string, write: Write): MoneyActions {
  return {
  unspend: (item) => write(() => removeExpense(owner, item, new Date())),

  spend: (what) => write(() => recordExpense(owner, what)),

  saveReserves: (tax_pct, ni_pct) => write(() => saveReserves(owner, tax_pct, ni_pct)),

  saveTaxYear: (year) => write(() => saveTaxYear(owner, year)),

  saveCosts: (area_id, fuel_per_km, vehicle_per_km) =>
    write(() => saveRunningCosts(owner, area_id, fuel_per_km, vehicle_per_km)),

  // A shift is made already processed: it is not something you found in
  // your pocket, it is a day you worked. So it goes in with its kind, its
  // day and its area, and never passes through the inbox.
  startShift: (day, area_id) =>
    write(() =>
      createShift(owner, day, area_id).then((anchor) =>
        saveShift(owner, anchor.id, {}),
      ),
    ),

  saveShiftParts: (item_id, patch) => write(() => saveShift(owner, item_id, patch)),
  clockOn: (item_id) => write(() => startSession(owner, item_id, new Date())),
  clockOff: (sessionId) => write(() => endShiftSession(owner, sessionId, new Date())),
  dropSession: (sessionId) => write(() => removeShiftSession(owner, sessionId)),
  setPaid: (item_id, platform, amount) =>
    write(() => setEarning(owner, item_id, platform, amount)),
  }
}
