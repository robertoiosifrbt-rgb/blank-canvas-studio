import { iso, num, today, ym } from './format'
import type { Debt, DebtHolder, DebtPlan, DebtRef, Movement, OsData, PlanEvery } from './types'

/**
 * Ce se poate ști despre o datorie fără să întrebi pe nimeni.
 *
 * Plățile nu sunt ținute în datorie: sunt mișcări din Finanțe marcate cu ea.
 * Deci tot ce ține de bani se calculează din Finanțe, iar datoria rămâne ce
 * este — o poveste cu firme, referințe și termene.
 */

export const DIRECTIONS = [
  { value: 'owe', label: 'Datorez eu' },
  { value: 'owed', label: 'Mi se datorează' },
] as const

export const CATEGORIES = ['Card', 'Împrumut', 'Overdraft', 'Ipotecă', 'Utilități',
  'Council tax', 'HMRC', 'Catalog', 'Telefon', 'Altele']

export const STATUSES = ['Activă', 'Monitorizată', 'În dispută', 'Plan de plată',
  'Stinsă', 'Plătită', 'Închisă']

/* Ordinea contează: e drumul pe care merge o datorie, de la prima restanță la
   executare. Arătată așa, îți spune cât de aproape e de a deveni serioasă. */
export const STAGES = ['Niciunul', 'La zi', 'Notificare de default', 'În default',
  'Vândută', 'Scrisoare primită', 'Înainte de somație', 'Somație',
  'Acțiune în instanță', 'CCJ obținut', 'Plan de plată', 'Executare',
  'Ofertă de stingere', 'Stinsă', 'Plătită', 'Închisă', 'Contestată']

export const ROLES = ['Creditor inițial', 'Proprietar anterior', 'Proprietar curent',
  'Agenție de colectare', 'Avocat', 'Instanță', 'Executor', 'Altul']

export const ORG_KINDS = ['Bancă', 'Casă de economii', 'Emitent de card',
  'Recuperator', 'Cumpărător de datorii', 'Avocat', 'Instanță', 'Executor',
  'Utilități', 'Instituție de stat', 'Altele']

export const ACTION_KINDS = ['Telefon', 'Email', 'Scrisoare primită',
  'Scrisoare trimisă', 'Actualizare în portal', 'Plângere', 'Dispută',
  'Înțelegere de plată', 'Altele']

export const PLAN_KINDS = ['Standard', 'Redus', 'Temporar', 'Simbolic',
  'De stingere', 'Hotărât de instanță', 'Altul']

export const PLAN_STATUSES = ['Propus', 'Activ', 'Oprit', 'Terminat', 'Anulat', 'Eșuat', 'Înlocuit']

export const EVERY: Array<{ value: PlanEvery; label: string; days: number }> = [
  { value: 'week', label: 'săptămânal', days: 7 },
  { value: 'fortnight', label: 'la două săptămâni', days: 14 },
  { value: 'month', label: 'lunar', days: 30 },
  { value: 'quarter', label: 'trimestrial', days: 91 },
  { value: 'once', label: 'o singură dată', days: 0 },
]

export const everyLabel = (every: PlanEvery): string =>
  EVERY.find(e => e.value === every)?.label ?? String(every)

/** Toate mișcările din Finanțe marcate cu datoria asta, cronologic. */
export function paymentsFor(data: OsData, debtId: string): Movement[] {
  return Object.values(data.finance)
    .flatMap(month => month.items)
    .filter(item => item.debt === debtId)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export const paidOn = (data: OsData, debtId: string): number =>
  paymentsFor(data, debtId).reduce((sum, item) => sum + num(item.amount), 0)

export const remaining = (data: OsData, debt: Debt): number =>
  Math.max(0, num(debt.total) - paidOn(data, debt.id))

export const progress = (data: OsData, debt: Debt): number =>
  num(debt.total) > 0 ? Math.min(100, (paidOn(data, debt.id) / num(debt.total)) * 100) : 0

/** Cine o ține acum: rolul curent, adică cel fără dată de sfârșit. */
export function currentHolder(debt: Debt): DebtHolder | undefined {
  const holders = debt.holders ?? []
  return holders.find(h => !h.to && h.role === 'Proprietar curent')
    ?? holders.find(h => !h.to)
    ?? holders[holders.length - 1]
}

/**
 * Referința cu care te caută firma care o ține acum.
 *
 * Întâi cea trecută pe firmă, apoi una din lista datoriei dată de aceeași
 * firmă, apoi prima din listă. O datorie poate avea mai multe numere, dar la
 * telefon îți trebuie unul, și anume al lor.
 */
export function currentRef(debt: Debt): string | undefined {
  const holder = currentHolder(debt)
  if (holder?.ref) return holder.ref
  const refs = debt.refs ?? []
  return refs.find(ref => ref.org && ref.org === holder?.org)?.value ?? refs[0]?.value
}

/** Toate referințele, cu eticheta lor, pentru afișare. */
export const allRefs = (debt: Debt): DebtRef[] => [
  ...(debt.refs ?? []),
  ...(debt.holders ?? [])
    .filter(h => h.ref && !(debt.refs ?? []).some(r => r.value === h.ref))
    .map(h => ({ id: `h:${h.id}`, value: h.ref as string, label: h.role, org: h.org })),
]

export const activePlan = (debt: Debt): DebtPlan | undefined =>
  (debt.plans ?? []).find(plan => plan.status === 'Activ')

/**
 * Următoarea scadență a unui plan activ. Dacă data trecută a rămas în urmă, o
 * mutăm înainte cu pasul planului până ajunge în viitor: un plan lunar nu are
 * nevoie să fie atins manual în fiecare lună ca să știe când e următoarea.
 */
export function nextDue(plan: DebtPlan, from = new Date()): string | undefined {
  if (!plan.next) return undefined
  const step = EVERY.find(e => e.value === plan.every)?.days ?? 0
  const date = new Date(`${plan.next}T12:00:00`)
  if (Number.isNaN(date.getTime())) return undefined
  if (step === 0) return plan.next
  const guard = 400
  for (let i = 0; date.getTime() < from.getTime() - 86_400_000 && i < guard; i += 1) {
    date.setDate(date.getDate() + step)
  }
  return iso(date)
}

/** Închisă în vreun fel: plătită, stinsă, închisă. Nu mai e de plată. */
export const isSettled = (debt: Debt): boolean =>
  ['Plătită', 'Stinsă', 'Închisă'].includes(debt.status)

/**
 * Următoarea zi în care ai ceva de făcut pe datoria asta.
 *
 * Poate veni din planul activ sau din termenul scris pe datorie. Se ia cea
 * mai apropiată: aia e ziua care contează, indiferent de unde vine.
 */
export function nextDate(debt: Debt, from = new Date()): string | undefined {
  const plan = activePlan(debt)
  const dates = [plan ? nextDue(plan, from) : undefined, debt.due].filter(Boolean) as string[]
  return dates.sort()[0]
}

/**
 * Situația, pe tot ce ai.
 *
 * Ce datorezi și ce ți se datorează stau despărțite — adunate, ar da o cifră
 * care nu înseamnă nimic. Restanțele se numără separat de ce vine, pentru că
 * numai una din ele te costă acum.
 */
export interface DebtSummary {
  /** Cât mai ai de plătit, pe datoriile neînchise. */
  owe: number
  oweCount: number
  /** Cât ți se mai datorează ție. */
  owed: number
  owedCount: number
  /** Cât ai plătit la datorii luna asta, din Finanțe. */
  paidMonth: number
  /** Cât ai încasat luna asta din ce ți se datorează. */
  gotMonth: number
  /** Datorii cu termenul trecut. */
  overdue: number
  /** Datorii cu termenul în următoarele două săptămâni. */
  soon: number
  /** Cea mai apropiată zi cu ceva de făcut. */
  next?: string
}

const DAY = 86_400_000

export function summariseDebts(data: OsData, list: Debt[], from = today()): DebtSummary {
  const open = list.filter(debt => !isSettled(debt))
  const mine = open.filter(debt => debt.direction !== 'owed')
  const theirs = open.filter(debt => debt.direction === 'owed')
  const horizon = iso(new Date(new Date(`${from}T12:00:00`).getTime() + 14 * DAY))

  const month = data.finance[ym(from)]?.items ?? []
  const ids = new Set(list.map(debt => debt.id))
  const moved = month.filter(item => item.debt && ids.has(item.debt))

  const dates = open.map(debt => nextDate(debt, new Date(`${from}T12:00:00`))).filter(Boolean) as string[]

  return {
    owe: mine.reduce((sum, debt) => sum + remaining(data, debt), 0),
    oweCount: mine.length,
    owed: theirs.reduce((sum, debt) => sum + remaining(data, debt), 0),
    owedCount: theirs.length,
    paidMonth: moved.filter(item => item.type === 'out').reduce((sum, item) => sum + num(item.amount), 0),
    gotMonth: moved.filter(item => item.type === 'in').reduce((sum, item) => sum + num(item.amount), 0),
    overdue: dates.filter(date => date < from).length,
    soon: dates.filter(date => date >= from && date <= horizon).length,
    next: dates.sort()[0],
  }
}

/** Zilele de follow-up rămase din jurnal, fără cele trecute. */
export const openFollowUps = (debt: Debt, from: string): Array<{ date: string; about: string }> =>
  (debt.actions ?? [])
    .filter(action => action.followUp && action.followUp >= from)
    .map(action => ({ date: action.followUp as string, about: action.summary }))
