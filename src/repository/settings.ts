// What a kilometre costs, for one line of work.
//
// Tax used to sit beside this as two typed percentages. It does not any more:
// what a day owes depends on where its profit lands in the year, and only the
// year knows that. This is what is left — the cost of driving, which does
// belong to a line of work, because a different vehicle and a different way of
// driving cost different money.
//
// No cursor: one row per area, a handful, fetched whole on every sync. It does
// carry a version, because two devices editing one setting is a real thing.

import { asRecord, optionalNumber, requiredText, stampsOf } from './row'
import type { Row } from './row'

/** What a kilometre costs, for one area. */
export type RunningCosts = Omit<Row, 'id'> & {
  area_id: string
  fuel_per_km: number
  vehicle_per_km: number
}

export type RunningCostsPatch = { fuel_per_km: number; vehicle_per_km: number }

function requiredNumber(raw: Record<string, unknown>, key: string): number {
  const value = optionalNumber(raw, key)
  if (value === null) throw new Error(`Row without ${key}`)
  return value
}

export function runningCostsFromRow(row: unknown): RunningCosts {
  const raw = asRecord(row)
  const fuel_per_km = requiredNumber(raw, 'fuel_per_km')
  const vehicle_per_km = requiredNumber(raw, 'vehicle_per_km')
  if (fuel_per_km < 0) throw new Error(`Fuel below nothing: ${fuel_per_km}`)
  if (vehicle_per_km < 0) throw new Error(`Vehicle below nothing: ${vehicle_per_km}`)
  return {
    area_id: requiredText(raw, 'area_id'),
    owner: requiredText(raw, 'owner'),
    fuel_per_km,
    vehicle_per_km,
    ...stampsOf(raw),
  }
}

/** The costs for one area, or null when none are set. */
export function costsFor(
  costs: readonly RunningCosts[],
  area_id: string | null,
): RunningCosts | null {
  if (area_id === null) return null
  return costs.find((row) => row.area_id === area_id && row.deleted_at === null) ?? null
}

/** Whether an area has running costs. Used to say so before a shift needs them. */
export function hasCosts(costs: readonly RunningCosts[], area_id: string | null): boolean {
  return costsFor(costs, area_id) !== null
}
