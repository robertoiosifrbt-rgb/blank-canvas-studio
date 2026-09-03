import { iso, num, today } from './format'
import { remainingDebt } from './goals'
import type { OsData } from './types'

/** Calendarul nu ține date proprii. Le citește pe ale celorlalte module. */

export interface DayCell { date: string; day: number; inMonth: boolean }

/** Zilele lunii, luni prima, în casete de câte șapte. */
export function monthGrid(key: string): DayCell[] {
  const first = new Date(`${key}-01T12:00:00`)
  const shift = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(1 - shift)
  const out: DayCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const date = iso(d)
    out.push({ date, day: d.getDate(), inMonth: date.slice(0, 7) === key })
    if (i >= 34 && date.slice(0, 7) !== key) break
  }
  return out
}

export type DayKind = 'task' | 'debt' | 'money' | 'habit' | 'goal'
export type DayClass = 'acc' | 'good' | 'bad' | 'warn' | 'ochre'

export interface DayItem {
  kind: DayKind
  cls: DayClass
  title: string
  sub: string
  amount?: number
  inflow?: boolean
}

export function dayItems(data: OsData, date: string): DayItem[] {
  const out: DayItem[] = []

  for (const t of Object.values(data.tasks))
    if (t.due === date)
      out.push({ kind: 'task', cls: t.done ? 'good' : 'acc', title: t.title, sub: t.done ? 'bifat' : (t.proj ?? 'task') })

  for (const d of Object.values(data.debts))
    if (d.due === date && remainingDebt(d) > 0)
      out.push({ kind: 'debt', cls: 'warn', title: d.name, sub: 'scadență', amount: remainingDebt(d) })

  for (const m of data.finance[date.slice(0, 7)]?.items ?? [])
    if (m.date === date)
      out.push({
        kind: 'money', cls: m.type === 'in' ? 'good' : 'bad',
        title: m.note || (m.type === 'in' ? 'Venit' : 'Cheltuială'),
        sub: m.cat ?? 'Altele', amount: num(m.amount), inflow: m.type === 'in',
      })

  for (const h of Object.values(data.habits))
    if (h.log?.[date]) out.push({ kind: 'habit', cls: 'good', title: h.name, sub: 'bifat' })

  for (const g of Object.values(data.goals)) {
    if (g.due === date) out.push({ kind: 'goal', cls: 'ochre', title: g.name, sub: 'termen' })
    for (const c of g.contrib ?? [])
      if (c.date === date)
        out.push({ kind: 'goal', cls: 'ochre', title: g.name, sub: c.note || 'contribuție', amount: num(c.amount) })
    for (const r of g.reads ?? [])
      if (r.date === date) out.push({ kind: 'goal', cls: 'ochre', title: g.name, sub: 'măsurătoare' })
  }

  return out
}

/** Punctele de sub numărul zilei — cel mult patru feluri. */
export function dayDots(data: OsData, date: string): DayClass[] {
  const seen: DayClass[] = []
  for (const item of dayItems(data, date))
    if (!seen.includes(item.cls)) seen.push(item.cls)
  return seen.slice(0, 4)
}

export const isToday = (date: string): boolean => date === today()
