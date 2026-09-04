import { num } from './format'
import type { Fuel, OsData } from './types'

/**
 * Consumul real, socotit din alimentări.
 *
 * Se poate socoti numai **plin la plin**: doar între două plinuri știi că
 * rezervorul a pornit și s-a oprit în același punct, deci că litrii puși sunt
 * exact litrii arși. Alimentările parțiale dintre ele nu se aruncă — se adună
 * la intervalul din care fac parte.
 *
 * Nimic nu se salvează. Corectezi kilometrajul unei alimentări de acum o lună
 * și tot lanțul se reface singur; scris în bază, ar fi rămas cu cifra veche.
 */

const LITRES_PER_GALLON = 4.54609
const KM_TO_MILE = 0.621371

export interface FuelInterval {
  /** Alimentarea care închide intervalul — plinul al doilea. */
  id: string
  date: string
  fromOdometer: number
  toOdometer: number
  km: number
  litres: number
  cost: number
  costPerKm: number
  litresPer100Km: number
  /** Mile pe galon britanic, cum se citește în UK. */
  mpg: number
}

/** Alimentările unei mașini, cum le-ai scris. */
export const fuelOf = (data: OsData, vehicle?: string): Fuel[] =>
  Object.values(data.fuel ?? {})
    .filter(item => !vehicle || item.vehicle === vehicle)
    .sort((a, b) => b.date.localeCompare(a.date) || num(b.odometer) - num(a.odometer))

/**
 * Cele care pot intra în lanț: alea cu kilometraj.
 *
 * Fără kilometraj, o alimentare nu se poate așeza între altele — n-ai unde
 * s-o pui pe drum. Lăsată în lanț, s-ar duce la început, iar litrii ei ar
 * ajunge într-un interval la care n-au participat. Rămâne în listă și în
 * cheltuieli; doar din socoteala consumului iese.
 */
const chainable = (data: OsData, vehicle?: string): Fuel[] =>
  Object.values(data.fuel ?? {})
    .filter(item => (!vehicle || item.vehicle === vehicle) && num(item.odometer) > 0)
    .sort((a, b) => num(a.odometer) - num(b.odometer) || a.date.localeCompare(b.date))

/** Intervalele închise, cel mai nou ultimul. */
export function intervalsOf(data: OsData, vehicle?: string): FuelInterval[] {
  const out: FuelInterval[] = []
  let lastFull: number | null = null
  let litres = 0
  let cost = 0

  for (const item of chainable(data, vehicle)) {
    const odometer = num(item.odometer)
    if (item.full && odometer > 0) {
      if (lastFull !== null) {
        const km = odometer - lastFull
        const totalLitres = litres + num(item.litres)
        const totalCost = cost + num(item.cost)
        if (km > 0 && totalLitres > 0) {
          const miles = km * KM_TO_MILE
          const gallons = totalLitres / LITRES_PER_GALLON
          out.push({
            id: item.id, date: item.date,
            fromOdometer: lastFull, toOdometer: odometer, km,
            litres: totalLitres, cost: totalCost,
            costPerKm: totalCost > 0 ? totalCost / km : 0,
            litresPer100Km: (totalLitres / km) * 100,
            mpg: gallons > 0 ? miles / gallons : 0,
          })
        }
      }
      lastFull = odometer
      litres = 0
      cost = 0
    } else {
      litres += num(item.litres)
      cost += num(item.cost)
    }
  }
  return out
}

export interface FuelRate {
  costPerKm: number
  /** De unde vine cifra, în cuvinte, ca să poți verifica. */
  source: string
  known: boolean
}

/**
 * Costul pe kilometru al unei mașini, din ultimul interval închis.
 *
 * Când nu există niciunul, se spune limpede — nu se cade pe tăcute pe o
 * valoare scrisă de mână. O cifră greșită în care ai încredere e mai rea
 * decât una lipsă.
 */
export function fuelRate(data: OsData, vehicle?: string): FuelRate {
  const intervals = intervalsOf(data, vehicle)
  const last = intervals[intervals.length - 1]
  if (!last || last.costPerKm <= 0) {
    return { costPerKm: 0, source: 'Nu ai încă două plinuri pe mașina asta.', known: false }
  }
  return {
    costPerKm: last.costPerKm,
    source: `Plin la plin: ${Math.round(last.fromOdometer)}–${Math.round(last.toOdometer)} km, ` +
      `${last.litres.toFixed(1)} l, ${last.cost.toFixed(2)}`,
    known: true,
  }
}

/** Prețul pe litru al unei alimentări, cât să se vadă în listă. */
export const pricePerLitre = (item: Fuel): number =>
  num(item.litres) > 0 ? num(item.cost) / num(item.litres) : 0
