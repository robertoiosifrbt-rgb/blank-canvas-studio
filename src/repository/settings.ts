// The two settings, and what they are for.
//
// They are apart on purpose. Tax and National Insurance are yours: one HMRC,
// one allowance, one bill. Fuel and vehicle wear per kilometre belong to a
// line of work, because a different vehicle and a different way of driving
// cost different money.
//
// Neither carries a cursor. There is one reserves row per person and one
// running-costs row per area — a handful, fetched whole on every sync. They do
// carry a version, because two devices editing one setting is a real thing.

import { asRecord, optionalNumber, requiredText, stampsOf } from './row'
import type { Row } from './row'

/** The percentages, one set for the whole person. */
export type Reserves = Omit<Row, 'id'> & {
  tax_pct: number
  ni_pct: number
}

/** What a kilometre costs, for one area. */
export type RunningCosts = Omit<Row, 'id'> & {
  area_id: string
  fuel_per_km: number
  vehicle_per_km: number
}

export type ReservesPatch = { tax_pct: number; ni_pct: number }
export type RunningCostsPatch = { fuel_per_km: number; vehicle_per_km: number }

function requiredNumber(raw: Record<string, unknown>, key: string): number {
  const value = optionalNumber(raw, key)
  if (value === null) throw new Error(`Row without ${key}`)
  return value
}

export function reservesFromRow(row: unknown): Reserves {
  const raw = asRecord(row)
  const tax_pct = requiredNumber(raw, 'tax_pct')
  const ni_pct = requiredNumber(raw, 'ni_pct')
  // The same three the database checks. A row breaking them did not come from
  // there as it stands.
  if (tax_pct < 0 || tax_pct > 100) throw new Error(`Tax outside 0–100: ${tax_pct}`)
  if (ni_pct < 0 || ni_pct > 100) throw new Error(`NI outside 0–100: ${ni_pct}`)
  if (tax_pct + ni_pct > 100) {
    throw new Error(`Reserving more than there is: ${tax_pct} + ${ni_pct}`)
  }
  return { owner: requiredText(raw, 'owner'), tax_pct, ni_pct, ...stampsOf(raw) }
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
