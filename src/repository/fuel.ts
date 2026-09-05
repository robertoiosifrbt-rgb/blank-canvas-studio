// What a kilometre of fuel actually costs, worked out from the pump.
//
// Full tank to full tank, and nothing else. Between two full tanks the amount
// burnt is known exactly — the tank was full at both ends — so the money
// spent in between divided by the distance is a real number. Between partial
// fills it is not: some of what you paid for is still in the tank.
//
// A partial fill still counts its money. It just does not close a leg: it
// belongs to the leg that ends at the next full tank.

export type Fill = {
  /** What was paid, in pence, so the addition is exact. */
  pence: number
  /** The odometer at the pump. */
  odo: number
  /** Whether the tank was filled to the top. */
  full: boolean
}

export type FuelRate = {
  /** Pounds per kilometre, or null when no complete leg exists yet. */
  perKm: number | null
  /** How many full-tank-to-full-tank legs it is worked out from. */
  legs: number
  /** The distance those legs covered. */
  km: number
  /**
   * Why there is no rate, when there is none.
   *
   * Said rather than left as a bare null: "no rate yet" and "your readings
   * are unusable" need different answers from the person reading it.
   */
  reason: 'ok' | 'no-fills' | 'one-full-tank-only' | 'no-distance'
}

/**
 * The rate over every complete leg.
 *
 * Every leg together rather than the last one: a single tank measures the
 * week it was burnt in — motorway one week, town the next — and a rate that
 * jumps forty percent between fill-ups is not a rate, it is the weather.
 */
export function fuelRate(fills: readonly Fill[]): FuelRate {
  if (fills.length === 0) {
    return { perKm: null, legs: 0, km: 0, reason: 'no-fills' }
  }

  // By odometer, not by date: the odometer is what the distance is measured
  // in, and a receipt entered a week late must not reorder the legs.
  const ordered = [...fills].sort((one, other) => one.odo - other.odo)

  let legs = 0
  let km = 0
  let pence = 0
  let sinceFull: number | null = null
  let pending = 0

  for (const fill of ordered) {
    if (sinceFull !== null) pending += fill.pence
    if (!fill.full) continue

    if (sinceFull !== null) {
      const distance = fill.odo - sinceFull
      // Two full tanks at the same reading measure nothing. Skipping the leg
      // keeps its money out of the average as well — counting the money
      // without the distance would push the rate up for nothing.
      if (distance > 0) {
        legs += 1
        km += distance
        pence += pending
      }
    }
    sinceFull = fill.odo
    pending = 0
  }

  if (legs === 0) {
    const fullTanks = ordered.filter((fill) => fill.full).length
    return {
      perKm: null,
      legs: 0,
      km: 0,
      reason: fullTanks >= 2 ? 'no-distance' : 'one-full-tank-only',
    }
  }

  // Four decimals, which is what the column holds: at £0.116 a kilometre,
  // rounding to the penny would throw away most of the number.
  return {
    perKm: Math.round((pence / 100 / km) * 10000) / 10000,
    legs,
    km,
    reason: 'ok',
  }
}
