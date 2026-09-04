import { iso, num, today } from './format'
import { activePlan, currentHolder, everyLabel, nextDue, remaining } from './debts'
import { totalsOf } from './delivery'
import { gymMeasurements, gymSessions } from './gymBridge'
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

export type DayKind = 'task' | 'debt' | 'money' | 'habit' | 'goal' | 'gym' | 'doc' | 'work'
export type DayClass = 'acc' | 'good' | 'bad' | 'warn' | 'ochre'

export interface DayItem {
  kind: DayKind
  cls: DayClass
  title: string
  sub: string
  amount?: number
  inflow?: boolean
  /**
   * Ce-ți trebuie ca să acționezi, fără să pleci din calendar: numărul de
   * telefon, referința, la ce datorie e. O intrare care spune „de sunat" și
   * atât te trimite să cauți prin module exact când n-ai timp.
   */
  lines?: string[]
  /** Modulul de deschis dacă vrei mai mult decât atât. */
  goto?: string
}

/**
 * Straturile calendarului, ca într-un calendar obișnuit: le bifezi pe cele
 * pe care vrei să le vezi. Ordinea e cea în care apar butoanele.
 */
export const LAYERS: Array<{ kind: DayKind; name: string }> = [
  { kind: 'task', name: 'Task-uri' },
  { kind: 'debt', name: 'Datorii' },
  { kind: 'doc', name: 'Documente' },
  { kind: 'money', name: 'Bani' },
  { kind: 'goal', name: 'Obiective' },
  { kind: 'habit', name: 'Obiceiuri' },
  { kind: 'work', name: 'Livrări' },
  { kind: 'gym', name: 'Sală' },
]

export const keepLayers = (items: DayItem[], hidden: readonly DayKind[]): DayItem[] =>
  hidden.length === 0 ? items : items.filter(item => !hidden.includes(item.kind))

export function dayItems(data: OsData, date: string): DayItem[] {
  const out: DayItem[] = []

  for (const t of Object.values(data.tasks))
    if (t.due === date)
      out.push({ kind: 'task', cls: t.done ? 'good' : 'acc', title: t.title, sub: t.done ? 'bifat' : (t.proj ?? 'task') })

  /* Datoriile aduc trei feluri de zile, toate din ce e scris deja: scadența
     planului de plată, termenul datoriei, și follow-up-urile din jurnal. */
  for (const debt of Object.values(data.debts)) {
    const left = remaining(data, debt)
    const holder = currentHolder(debt)
    const org = holder ? data.orgs?.[holder.org] : undefined
    const about = [
      org?.name,
      org?.phone,
      holder?.ref ? `ref. ${holder.ref}` : '',
      debt.stage && debt.stage !== 'Niciunul' ? debt.stage : '',
    ].filter(Boolean) as string[]

    const plan = activePlan(debt)
    if (plan && nextDue(plan, new Date(`${date}T12:00:00`)) === date && left > 0) {
      out.push({
        kind: 'debt', cls: 'warn', title: debt.name,
        sub: `rată ${everyLabel(plan.every)}`, amount: num(plan.amount),
        lines: [...about, `rămas ${left.toFixed(2)}`], goto: debt.mod,
      })
    }

    if (debt.due === date && left > 0) {
      out.push({
        kind: 'debt', cls: 'warn', title: debt.name, sub: 'termen', amount: left,
        lines: about, goto: debt.mod,
      })
    }

    for (const action of debt.actions ?? []) {
      if (action.followUp !== date) continue
      out.push({
        kind: 'debt', cls: 'acc', title: debt.name, sub: 'de reluat',
        lines: [action.summary, ...about], goto: debt.mod,
      })
    }
  }

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

  /* Termenul unei hârtii, nu data ei: ce e de făcut are un loc în calendar,
     ziua în care a fost tipărită scrisoarea nu. */
  for (const d of Object.values(data.docs ?? {}))
    if (d.due === date)
      out.push({
        kind: 'doc', cls: d.done ? 'good' : 'warn',
        title: d.title, sub: d.done ? 'rezolvat' : (d.from ?? 'document'),
        amount: d.amount, goto: d.mod,
        lines: [d.ref ? `ref. ${d.ref}` : '', d.note ?? ''].filter(Boolean) as string[],
      })

  /* Tura de livrări: ce a rămas din ea, nu ce a intrat. Brutul e cifra care
     înșală, iar în calendar ai loc pentru una singură. */
  for (const day of Object.values(data.workdays ?? {})) {
    if (day.date !== date) continue
    const t = totalsOf(data, day)
    out.push({
      kind: 'work', cls: day.done ? 'good' : 'acc',
      title: 'Tură livrări', sub: day.done ? `${t.hours.toFixed(1)} h · ${Math.round(t.businessKm)} km` : 'neterminată',
      amount: t.available, inflow: true, goto: day.mod,
      lines: [`brut ${t.gross.toFixed(2)}`, `cheltuieli ${t.totalExpenses.toFixed(2)}`,
        `rezerve ${t.reserves.toFixed(2)}`],
    })
  }

  for (const s of gymSessions())
    if (s.date === date) out.push({ kind: 'gym', cls: 'acc', title: s.name, sub: 'antrenament' })

  for (const m of gymMeasurements())
    if (m.date === date) {
      const parts = [
        m.weightKg !== undefined ? `${m.weightKg} kg` : '',
        m.bodyFatPercent !== undefined ? `${m.bodyFatPercent}%` : '',
      ].filter(Boolean)
      out.push({ kind: 'gym', cls: 'ochre', title: 'Măsurătoare', sub: parts.join(' · ') || 'corp' })
    }

  return out
}

/**
 * Punctele de sub numărul zilei — cel mult patru feluri.
 *
 * Țin cont de straturile ascunse: altfel ziua ar avea puncte, ai deschide-o,
 * și n-ai găsi nimic înăuntru.
 */
export function dayDots(data: OsData, date: string, hidden: readonly DayKind[] = []): DayClass[] {
  const seen: DayClass[] = []
  for (const item of keepLayers(dayItems(data, date), hidden))
    if (!seen.includes(item.cls)) seen.push(item.cls)
  return seen.slice(0, 4)
}

export const isToday = (date: string): boolean => date === today()
