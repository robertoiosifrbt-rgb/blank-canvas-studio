import { num } from './format'
import { carCostsOf, dailyShare, directOn, businessPart } from './carCosts'
import { fuelRate } from './fuelChain'
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

/** Un interval, minus pauza. Unul care trece de miezul nopții e tot unul. */
export function spanHours(from?: string, to?: string, breakMinutes?: number): number {
  if (!from || !to) return 0
  const start = minutes(from)
  let end = minutes(to)
  if (end <= start) end += 1440
  return Math.max(0, (end - start) / 60 - num(breakMinutes) / 60)
}

/**
 * Orele lucrate: primul interval plus celelalte ieșiri ale zilei.
 *
 * Se adună numai timpul stat pe drum. Pauza dintre prânz și seară nu e oră
 * lucrată, așa că nu intră; dacă ar intra, câștigul pe oră ar ieși mai mic
 * decât e și ai crede că tura n-a meritat.
 */
export function hoursOf(day: Workday): number {
  return (day.periods ?? []).reduce(
    (sum, p) => sum + spanHours(p.from, p.to, p.breakMinutes),
    spanHours(day.from, day.to, day.breakMinutes),
  )
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
  /** Cheltuieli ale zilei, plus cele directe cu mașina din ziua aia. */
  expenses: number
  /** Partea din cheltuielile întinse care cade pe ziua asta. */
  recurring: number
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
  /** De unde a venit costul cu combustibilul, ca să se vadă pe ce te bazezi. */
  fuelSource: string
}

export function totalsOf(data: OsData, day: Workday): DayTotals {
  const rates = ratesFor(data, day)
  const vehicle = day.vehicle ? data.vehicles[day.vehicle] : undefined
  /*
   * Costul cu combustibilul, în ordinea în care merită crezut: mai întâi ce
   * arată alimentările tale plin la plin, apoi ce ai scris pe mașină, apoi
   * media din setări. Sursa merge mai departe cu rezultatul — o cifră în care
   * te încrezi fără să știi de unde vine e mai rea decât una lipsă.
   */
  const measured = day.vehicle ? fuelRate(data, day.vehicle) : { costPerKm: 0, source: '', known: false }
  const fuelPerKm = measured.known ? measured.costPerKm : vehicle?.fuelPerKm ?? rates.fuelPerKm
  const fuelSource = measured.known ? measured.source
    : vehicle?.fuelPerKm !== undefined ? `Scris pe ${vehicle.name}`
      : 'Media din setări'

  const hours = hoursOf(day)
  const totalKm = Math.max(0, num(day.odoEnd) - num(day.odoStart))
  const businessKm = Math.max(0, totalKm - num(day.personalKm))
  const businessMiles = businessKm * KM_TO_MILE

  const platform = num(day.uber) + num(day.deliveroo) + num(day.justEat) + num(day.otherPlatform)
  const gross = platform + num(day.tips) + num(day.bonuses)

  /*
   * Cheltuielile cu mașina intră singure în ziua lor: cele directe în ziua în
   * care au fost, cele întinse cu partea zilei. Scrise de mână pe tură, ar fi
   * trebuit ținute minte și împărțite tot de tine — și n-ar fi fost.
   */
  const carCosts = carCostsOf(data, day.mod)
  const carDirect = directOn(carCosts, day.date).reduce((sum, item) => sum + businessPart(item), 0)
  const spread = dailyShare(carCosts, day.date)

  const fuel = businessKm * fuelPerKm
  const directCosts = fuel + num(day.parking) + num(day.tolls) + num(day.otherCost)
  const expenses = num(day.expenses) + carDirect
  const recurring = num(day.recurring) + spread
  const totalExpenses = directCosts + expenses + recurring
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
    fuel, directCosts, expenses, recurring, totalExpenses,
    profit, netPerHour: div(profit, hours),
    taxReserve, niReserve, vehicleReserve, reserves,
    available, availablePerHour: div(available, hours),
    debtDifference: num(day.toDebt) - available,
    fuelSource,
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
