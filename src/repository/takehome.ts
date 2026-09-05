// What a day's work leaves you, worked out in one place.
//
// One place because it will be asked in several: a shift's own sheet, and
// every total over a week, a month or a year that comes after it. The same
// question answered twice is the same question answered two ways eventually.
//
// It is a reserve, not a tax calculation, and it cannot be anything else. A
// flat percentage does not know that the first £12,570 of profit is untaxed,
// or that National Insurance falls to 2% above £50,270. It puts aside too
// much early in the year and too little late, and the right numbers come from
// an accountant, not from here.

import { earnedPence, kilometres } from './shift'
import type { Shift } from './shift'

export type TakeHome = {
  /** Platforms and tips, before anything is taken off. */
  grossPence: number
  /** Fuel and vehicle wear over the kilometres driven. */
  costsPence: number
  /** What the tax is worked out on: gross less the costs of earning it. */
  profitPence: number
  taxPence: number
  niPence: number
  /** What is actually yours. */
  netPence: number
  /**
   * What could not be worked out, and why the numbers above are short.
   *
   * Never silently zero. A shift with no rates set has an unknown reserve, not
   * a reserve of nothing, and a screen that shows £0 tax is lying in the
   * direction that costs money.
   */
  missing: ('rates' | 'costs' | 'kilometres')[]
}

/** Percent of an amount in pence, rounded to the penny. */
function percentOf(pence: number, percent: number): number {
  return Math.round((pence * percent) / 100)
}

/**
 * The whole sum for one shift, from the rates pinned on it.
 *
 * The rates come from the shift, never from today's settings: the shift was
 * worked under what was set then, and that is what it keeps.
 */
export function takeHome(shift: Shift): TakeHome {
  const grossPence = earnedPence(shift)
  const km = kilometres(shift)
  const missing: TakeHome['missing'] = []

  const fuel = shift.rate_fuel_per_km
  const vehicle = shift.rate_vehicle_per_km
  const tax = shift.rate_tax_pct
  const ni = shift.rate_ni_pct

  let costsPence = 0
  if (fuel === null || vehicle === null) missing.push('costs')
  else if (km === null) missing.push('kilometres')
  else costsPence = Math.round(km * (fuel + vehicle) * 100)

  const profitPence = grossPence - costsPence

  let taxPence = 0
  let niPence = 0
  if (tax === null || ni === null) {
    missing.push('rates')
  } else if (profitPence > 0) {
    // A day that lost money owes nothing on it. Reserving a percentage of a
    // negative profit would hand money back, which is not how any of this
    // works.
    taxPence = percentOf(profitPence, tax)
    niPence = percentOf(profitPence, ni)
  }

  return {
    grossPence,
    costsPence,
    profitPence,
    taxPence,
    niPence,
    netPence: profitPence - taxPence - niPence,
    missing,
  }
}

/** The same sum over many shifts: every part added, then nothing re-rounded. */
export function takeHomeOfAll(shifts: readonly Shift[]): TakeHome {
  const total: TakeHome = {
    grossPence: 0,
    costsPence: 0,
    profitPence: 0,
    taxPence: 0,
    niPence: 0,
    netPence: 0,
    missing: [],
  }
  const missing = new Set<TakeHome['missing'][number]>()
  for (const shift of shifts) {
    const one = takeHome(shift)
    total.grossPence += one.grossPence
    total.costsPence += one.costsPence
    total.profitPence += one.profitPence
    total.taxPence += one.taxPence
    total.niPence += one.niPence
    total.netPence += one.netPence
    for (const gap of one.missing) missing.add(gap)
  }
  total.missing = [...missing]
  return total
}
