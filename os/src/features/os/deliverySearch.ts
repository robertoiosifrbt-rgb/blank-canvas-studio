import { carCostsOf } from './carCosts'
import { daysOf, vehicleName } from './delivery'
import { fuelOf } from './fuelChain'
import type { CarExpense, Fuel, OsData, Workday } from './types'

/**
 * Căutarea prin livrări.
 *
 * Turele se adună repede. Când vrei să știi cât te-a costat cauciucul ăla sau
 * ce-ai făcut în ziua în care ai alimentat de 80, nu poți derula un an. Cauți
 * după cuvinte, iar cuvintele sunt cele pe care le-ai scris tu: data, mașina,
 * felul cheltuielii, notele.
 *
 * Se cere fiecare cuvânt, nu oricare. „septembrie corsa" înseamnă turele din
 * septembrie făcute cu Corsa, nu tot ce are ori una, ori alta — altfel
 * căutarea ar da mai mult cu cât scrii mai mult.
 */

const words = (query: string): string[] =>
  query.toLowerCase().split(/\s+/).filter(Boolean)

/** Adevărat dacă fiecare cuvânt căutat apare undeva în bucățile date. */
export function matches(query: string, parts: Array<string | number | undefined>): boolean {
  const asked = words(query)
  if (!asked.length) return true
  const text = parts.filter(p => p !== undefined && p !== '').join(' ').toLowerCase()
  return asked.every(word => text.includes(word))
}

export const searchDays = (data: OsData, mod: string, query: string): Workday[] =>
  daysOf(data, mod).filter(day => matches(query, [
    day.date, day.notes, day.from, day.to,
    vehicleName(data, day.vehicle),
    day.archived ? 'istoric' : '',
    day.done ? 'închisă' : 'neterminată',
  ]))

export const searchFuel = (data: OsData, query: string, vehicle?: string): Fuel[] =>
  fuelOf(data, vehicle).filter(item => matches(query, [
    item.date, item.notes, item.litres, item.cost,
    vehicleName(data, item.vehicle),
    item.full ? 'plin' : 'parțial',
  ]))

export const searchCarCosts = (data: OsData, mod: string, query: string): CarExpense[] =>
  carCostsOf(data, mod).filter(item => matches(query, [
    item.date, item.category, item.what, item.notes, item.amount,
    vehicleName(data, item.vehicle),
    item.from, item.to,
  ]))
