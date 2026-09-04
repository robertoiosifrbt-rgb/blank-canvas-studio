import { num } from './format'
import type { DeliveryRates, OsData, Vehicle, Workday } from './types'

/**
 * Socoteala unei ture de livrări.
 *
 * Formulele sunt cele din aplicația Delivery Hub, portate întocmai — nu
 * rescrise „mai bine". Cifrele astea decid ce trimiți la datorii; dacă ar
 * ieși altfel aici decât acolo, n-ai mai avea în ce să te încrezi.
 *
 * Nimic din ce iese de aici nu se salvează. O tură ține doar ce ai scris tu,
 * iar restul se calculează la fiecare privire — altfel, o cifră veche și una
 * nouă ar putea sta în același loc.
 */

export const DEFAULT_RATES: DeliveryRates = {
  taxPct: 0.2,
  niPct: 0.06,
  fuelPerKm: 0.12,
  vehPerKm: 0.05,
}

const KM_TO_MILE = 0.621371

const div = (a: number, b: number): number => (b === 0 ? 0 : a / b)

const minutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Orele lucrate, minus pauza. O tură care trece de miezul nopții e o tură. */
export function hoursOf(day: Workday): number {
  if (!day.from || !day.to) return 0
  const start = minutes(day.from)
  let end = minutes(day.to)
  if (end <= start) end += 1440
  return Math.max(0, (end - start) / 60 - num(day.breakMinutes) / 60)
}

/**
 * Procentele cu care se socotește ziua.
 *
 * O zi terminată își ține ale ei. Dacă îți schimbi cota de taxe azi, lunile
 * trecute rămân cum au fost — altfel istoricul s-ar rescrie singur de fiecare
 * dată când atingi o setare.
 */
export const ratesFor = (data: OsData, day: Workday): DeliveryRates =>
  day.rates ?? data.settings.delivery ?? DEFAULT_RATES

export interface DayTotals {
  hours: number
  totalKm: number
  businessKm: number
  businessMiles: number
  platform: number
  gross: number
  perHour: number
  perKm: number
  perMile: number
  fuel: number
  directCosts: number
  expenses: number
  totalExpenses: number
  profit: number
  netPerHour: number
  taxReserve: number
  niReserve: number
  vehicleReserve: number
  reserves: number
  /** Ce rămâne după rezerve. Ăsta e banul care poate merge la datorii. */
  available: number
  availablePerHour: number
  /** Cât ai trimis peste sau sub ce era disponibil. */
  debtDifference: number
}

export function totalsOf(data: OsData, day: Workday): DayTotals {
  const rates = ratesFor(data, day)
  const vehicle = day.vehicle ? data.vehicles[day.vehicle] : undefined
  /* Consumul mașinii bate media, când e știut: o dubă și o mașină mică nu
     costă la fel pe kilometru. */
  const fuelPerKm = vehicle?.fuelPerKm ?? rates.fuelPerKm

  const hours = hoursOf(day)
  const totalKm = Math.max(0, num(day.odoEnd) - num(day.odoStart))
  const businessKm = Math.max(0, totalKm - num(day.personalKm))
  const businessMiles = businessKm * KM_TO_MILE

  const platform = num(day.uber) + num(day.deliveroo) + num(day.justEat) + num(day.otherPlatform)
  const gross = platform + num(day.tips) + num(day.bonuses)

  const fuel = businessKm * fuelPerKm
  const directCosts = fuel + num(day.parking) + num(day.tolls) + num(day.otherCost)
  const totalExpenses = directCosts + num(day.expenses) + num(day.recurring)
  const profit = gross - totalExpenses

  /* Rezervele nu se pun din pierdere: la o zi în minus n-ai din ce. */
  const taxReserve = Math.max(0, profit * rates.taxPct)
  const niReserve = Math.max(0, profit * rates.niPct)
  const vehicleReserve = businessKm * rates.vehPerKm
  const reserves = taxReserve + niReserve + vehicleReserve
  const available = profit - reserves

  return {
    hours, totalKm, businessKm, businessMiles,
    platform, gross,
    perHour: div(gross, hours), perKm: div(gross, businessKm), perMile: div(gross, businessMiles),
    fuel, directCosts, expenses: num(day.expenses), totalExpenses,
    profit, netPerHour: div(profit, hours),
    taxReserve, niReserve, vehicleReserve, reserves,
    available, availablePerHour: div(available, hours),
    debtDifference: num(day.toDebt) - available,
  }
}

/** Zilele unui modul, cele mai noi întâi. */
export const daysOf = (data: OsData, mod: string): Workday[] =>
  Object.values(data.workdays).filter(day => day.mod === mod)
    .sort((a, b) => b.date.localeCompare(a.date))

export interface Summary extends Pick<DayTotals,
  'hours' | 'businessKm' | 'gross' | 'totalExpenses' | 'profit' | 'reserves' | 'available'> {
  days: number
  perHour: number
  toDebt: number
}

/** Totalurile pe mai multe zile. Doar cele terminate — restul sunt schițe. */
export function summarise(data: OsData, days: Workday[]): Summary {
  const done = days.filter(day => day.done)
  const start: Summary = {
    days: done.length, hours: 0, businessKm: 0, gross: 0, totalExpenses: 0,
    profit: 0, reserves: 0, available: 0, perHour: 0, toDebt: 0,
  }
  const sum = done.reduce((acc, day) => {
    const t = totalsOf(data, day)
    return {
      ...acc,
      hours: acc.hours + t.hours,
      businessKm: acc.businessKm + t.businessKm,
      gross: acc.gross + t.gross,
      totalExpenses: acc.totalExpenses + t.totalExpenses,
      profit: acc.profit + t.profit,
      reserves: acc.reserves + t.reserves,
      available: acc.available + t.available,
      toDebt: acc.toDebt + num(day.toDebt),
    }
  }, start)
  return { ...sum, perHour: div(sum.gross, sum.hours) }
}

export const vehicleName = (data: OsData, id?: string): string | undefined =>
  id ? (data.vehicles[id] as Vehicle | undefined)?.name : undefined
