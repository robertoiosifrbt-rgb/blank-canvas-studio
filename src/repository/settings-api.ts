// The settings, as the screens ask for them.

import { currentSession } from './auth'
import { taxYearFromRow } from './hmrc-year'
import type { TaxYearPatch, TaxYearRow } from './hmrc-year'
import { reservesFromRow, runningCostsFromRow } from './settings'
import type { Reserves, RunningCosts } from './settings'
import { settingsStore } from './settings-store'
import { supabaseSettings, supabaseSettingsWriter } from './source'

async function requireAccount(owner: string): Promise<void> {
  const session = await currentSession()
  if (session === null) {
    throw new Error('Nobody is signed in. The cache is not read.')
  }
  if (session.userId !== owner) {
    throw new Error('The requested cache belongs to another account.')
  }
}

/** Reads both settings from the server and puts them in the cache. */
export async function syncSettings(owner: string): Promise<void> {
  const fetched = await supabaseSettings()
  // A person has one row or none. More than one would mean the primary key
  // let go, and taking the first would hide that rather than say it.
  if (fetched.reserves.length > 1) {
    throw new Error(`${fetched.reserves.length} reserve rows for one account`)
  }
  const reserves =
    fetched.reserves.length === 1 ? reservesFromRow(fetched.reserves[0]) : null
  await settingsStore.replaceReserves(owner, reserves)
  await settingsStore.replaceCosts(owner, fetched.costs.map(runningCostsFromRow))
  await settingsStore.replaceTaxYears(owner, fetched.years.map(taxYearFromRow))
}

export async function reservesOf(owner: string): Promise<Reserves | null> {
  await requireAccount(owner)
  return settingsStore.reserves(owner)
}

/** Every tax year the person has set up. A handful, fetched whole. */
export async function taxYearsOf(owner: string): Promise<TaxYearRow[]> {
  await requireAccount(owner)
  return settingsStore.taxYears(owner)
}

export async function runningCostsOf(owner: string): Promise<RunningCosts[]> {
  await requireAccount(owner)
  return settingsStore.costs(owner)
}

/** The percentages, once, for the person. */
export async function saveReserves(
  owner: string,
  tax_pct: number,
  ni_pct: number,
): Promise<void> {
  await requireAccount(owner)
  await supabaseSettingsWriter().saveReserves({ tax_pct, ni_pct })
  await syncSettings(owner)
}

/**
 * One tax year, saved whole.
 *
 * All of its figures at once, because a bill worked out from half of them is a
 * number that looks like an answer with the expensive half missing.
 *
 * A year is its own row. Setting up 2027/28 next April leaves 2026/27 exactly
 * as it was, which is the difference between a record and a setting.
 */
export async function saveTaxYear(owner: string, year: TaxYearPatch): Promise<void> {
  await requireAccount(owner)
  await supabaseSettingsWriter().saveTaxYear({ ...year })
  await syncSettings(owner)
}

/** What a kilometre costs, for one area. */
export async function saveRunningCosts(
  owner: string,
  area_id: string,
  fuel_per_km: number,
  vehicle_per_km: number,
): Promise<void> {
  await requireAccount(owner)
  await supabaseSettingsWriter().saveCosts({ area_id, fuel_per_km, vehicle_per_km })
  await syncSettings(owner)
}
