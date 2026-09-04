import { MONTHS, iso, money, num, today } from './format'
import type { Goal, OsData } from './types'

/**
 * Două feluri de obiectiv, măsurate diferit:
 * `sum`    — se adună contribuții spre o țintă. Ritmul vine din Finanțe.
 * `metric` — o măsurătoare se mută de la un punct de plecare spre o țintă.
 *            Ritmul vine din propriile citiri.
 */

export const goalsAll = (data: OsData): Goal[] => Object.values(data.goals)
export const hasTarget = (g: Goal): boolean => g.target !== undefined && g.target !== null
export const isMetric = (g: Goal): boolean => g.kind === 'metric'

export const reads = (g: Goal) =>
  [...(g.reads ?? [])].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

export function current(g: Goal): number {
  if (!isMetric(g)) return (g.contrib ?? []).reduce((sum, c) => sum + num(c.amount), 0)
  const list = reads(g)
  return list.length ? num(list[list.length - 1].value) : num(g.start)
}

export function percent(g: Goal): number {
  if (!hasTarget(g)) return 0
  const target = num(g.target)
  if (!isMetric(g)) return target ? Math.max(0, Math.min(100, (current(g) / target) * 100)) : 0
  const start = num(g.start)
  if (target === start) return current(g) === target ? 100 : 0
  return Math.max(0, Math.min(100, ((current(g) - start) / (target - start)) * 100))
}

export function formatValue(g: Goal, value: number, currency: string): string {
  if (!isMetric(g)) return money(value, currency)
  const shown = (Math.round(value * 10) / 10).toLocaleString('ro-RO')
  const unit = g.unit ?? ''
  return unit ? `${shown}${unit === '%' ? '' : ' '}${unit}` : shown
}

/** Ancorele apar pe fiecare ecran. Fără niciuna, cel mai mare obiectiv ține locul. */
export function anchors(data: OsData): Goal[] {
  const all = goalsAll(data)
  const pinned = all.filter(g => g.main)
  if (pinned.length) return pinned.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
  return all.length ? [[...all].sort((a, b) => num(b.target) - num(a.target))[0]] : []
}

const monthItems = (data: OsData, key: string) => data.finance[key]?.items ?? []

export function monthTotals(data: OsData, key: string): { inc: number; out: number; bal: number } {
  let inc = 0, out = 0
  for (const item of monthItems(data, key)) {
    if (item.type === 'in') inc += num(item.amount)
    else out += num(item.amount)
  }
  return { inc, out, bal: inc - out }
}

/** Ritmul banilor: media ultimelor 3 luni cu mișcări. */
export function moneyRate(data: OsData): number | null {
  const keys: string[] = []
  for (let i = 2; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    keys.push(iso(d).slice(0, 7))
  }
  const withData = keys.filter(k => monthItems(data, k).length)
  if (!withData.length) return null
  return withData.reduce((sum, k) => sum + monthTotals(data, k).bal, 0) / withData.length
}

/** Ritmul unei măsurători: din prima și ultima citire. */
export function metricRate(g: Goal): number | null {
  const list = reads(g)
  if (list.length < 2) return null
  const first = list[0], last = list[list.length - 1]
  const months =
    (new Date(`${last.date}T12:00:00`).getTime() - new Date(`${first.date}T12:00:00`).getTime()) /
    (864e5 * 30.44)
  if (months < 0.2) return null
  return (num(last.value) - num(first.value)) / months
}

export const monthsTo = (due: string): number => {
  const now = new Date(), target = new Date(`${due}T12:00:00`)
  return (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth()) + (target.getDate() - now.getDate()) / 30
}

export function whenAt(months: number): string {
  const d = new Date()
  d.setDate(d.getDate() + Math.round(months * 30.44))
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** Consecvența obiceiurilor legate de obiectiv, pe 30 de zile. */
export function consistency(data: OsData, g: Goal): number | null {
  const ids = (g.habits ?? []).filter(id => data.habits[id])
  if (!ids.length) return null
  const days: string[] = []
  for (let i = 0; i < 30; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(iso(d))
  }
  let hit = 0
  for (const id of ids) {
    const log = data.habits[id].log ?? {}
    for (const day of days) if (log[day]) hit++
  }
  return (hit / (ids.length * 30)) * 100
}

export interface Status { cls: 'good' | 'warn' | 'bad'; text: string }

export function status(data: OsData, g: Goal, isAnchor: boolean): Status | null {
  if (!hasTarget(g)) return { cls: 'warn', text: 'de completat' }
  if (percent(g) >= 100) return { cls: 'good', text: 'atins' }
  const remaining = num(g.target) - current(g)
  if (!isMetric(g)) {
    const rate = isAnchor ? moneyRate(data) : null
    if (!g.due || rate === null) return null
    const months = monthsTo(g.due)
    if (months <= 0) return { cls: 'bad', text: 'termen depășit' }
    return rate >= remaining / months ? { cls: 'good', text: 'în grafic' } : { cls: 'warn', text: 'sub ritm' }
  }
  const rate = metricRate(g)
  if (rate === null) return null
  if (Math.sign(rate) !== Math.sign(remaining)) return { cls: 'bad', text: 'în direcția greșită' }
  if (!g.due) return { cls: 'good', text: 'se mișcă' }
  const months = monthsTo(g.due)
  if (months <= 0) return { cls: 'bad', text: 'termen depășit' }
  return Math.abs(rate) >= Math.abs(remaining) / months
    ? { cls: 'good', text: 'în grafic' } : { cls: 'warn', text: 'sub ritm' }
}

export interface Fact { key: string; value: string }

export function facts(data: OsData, g: Goal, isAnchor: boolean, currency: string): Fact[] {
  if (!hasTarget(g)) return []
  const out: Fact[] = []
  const cur = current(g), target = num(g.target)
  if (!isMetric(g)) {
    const remaining = Math.max(0, target - cur)
    out.push({ key: 'Rămas', value: money(remaining, currency) })
    if (g.due && remaining > 0) {
      const months = monthsTo(g.due)
      out.push({ key: 'Necesar pe lună', value: months > 0 ? money(remaining / months, currency) : 'termen depășit' })
    }
    const rate = isAnchor ? moneyRate(data) : null
    if (remaining > 0 && rate !== null) {
      out.push({ key: 'Ritmul tău', value: `${money(rate, currency)}/lună` })
      if (rate > 0) out.push({ key: 'Ajungi în', value: whenAt(remaining / rate) })
    }
  } else {
    const remaining = target - cur
    out.push({ key: 'Rămas', value: Math.abs(remaining) < 0.05 ? 'atins' : formatValue(g, Math.abs(remaining), currency) })
    const rate = metricRate(g)
    if (rate !== null && Math.abs(rate) > 0.01) {
      out.push({ key: 'Ritm', value: `${rate > 0 ? '+' : '−'}${formatValue(g, Math.abs(rate), currency)}/lună` })
      if (Math.abs(remaining) >= 0.05 && Math.sign(rate) === Math.sign(remaining))
        out.push({ key: 'Ajungi în', value: whenAt(remaining / rate) })
    }
  }
  const cons = consistency(data, g)
  if (cons !== null) out.push({ key: 'Consecvență 30z', value: `${cons.toFixed(0)}%` })
  return out
}

export const todayIso = today
