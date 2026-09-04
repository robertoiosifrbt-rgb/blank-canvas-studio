import { iso, num } from './format'
import type { Debt, DebtHolder, DebtPlan, Movement, OsData, PlanEvery } from './types'

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

/** Referința cu care te caută firma care o ține acum. */
export const currentRef = (debt: Debt): string | undefined => currentHolder(debt)?.ref

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

/** Zilele de follow-up rămase din jurnal, fără cele trecute. */
export const openFollowUps = (debt: Debt, from: string): Array<{ date: string; about: string }> =>
  (debt.actions ?? [])
    .filter(action => action.followUp && action.followUp >= from)
    .map(action => ({ date: action.followUp as string, about: action.summary }))
