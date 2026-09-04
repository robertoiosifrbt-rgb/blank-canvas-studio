import { num } from './format'
import type { CarExpense, OsData } from './types'

/**
 * Cheltuielile cu mașina, și cum cad ele pe zile.
 *
 * Două feluri, deosebite prin faptul că au sau nu o perioadă acoperită:
 *
 * - **Directe** — o reparație, un set de cauciucuri. Cad în ziua lor.
 * - **Întinse** — asigurarea pe un an, taxa de drum pe șase luni. Costul se
 *   împarte la zilele acoperite, iar fiecare zi ia partea ei, lucrată sau nu.
 *   Altfel, ziua în care ai plătit asigurarea ar arăta ca o zi catastrofală,
 *   iar celelalte 364 ca zile mai bune decât sunt.
 */

/** Partea de business dintr-o cheltuială. Lipsă înseamnă toată. */
export const businessPart = (item: CarExpense): number =>
  num(item.amount) * (item.businessPct ?? 1)

const days = (from: string, to: string): number => {
  const start = Date.parse(`${from}T00:00:00`)
  const end = Date.parse(`${to}T00:00:00`)
  if (Number.isNaN(start) || Number.isNaN(end)) return 1
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1)
}

/** Cheltuielile care acoperă o perioadă. */
export const spreadOnes = (items: CarExpense[]): CarExpense[] =>
  items.filter(item => item.from && item.to)

/** Cât din cheltuielile întinse cade pe o zi anume. */
export function dailyShare(items: CarExpense[], date: string): number {
  let total = 0
  for (const item of spreadOnes(items)) {
    if (date < (item.from as string) || date > (item.to as string)) continue
    total += businessPart(item) / days(item.from as string, item.to as string)
  }
  return total
}

export const carCostsOf = (data: OsData, mod: string): CarExpense[] =>
  Object.values(data.carCosts ?? {}).filter(item => item.mod === mod)
    .sort((a, b) => b.date.localeCompare(a.date))

/** Cheltuielile directe dintr-o zi: cele fără perioadă, căzute în ziua lor. */
export const directOn = (items: CarExpense[], date: string): CarExpense[] =>
  items.filter(item => !item.from && !item.to && item.date === date)
