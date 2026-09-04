import { emptyOsData, type OsData } from './types'
import type {
  CarExpense, Contribution, Debt, DebtAction, DebtHolder, DebtPlan, DebtRef, Doc, DocFile,
  Fuel, Goal, Habit, Movement, Note, Org, OsModule, OsSettings, Reading, Task, Vehicle,
  Workday, WorkPeriod,
} from './types'

/**
 * Traducerea dintre cum gândește aplicația și cum stă în bază.
 *
 * Aplicația lucrează cu un singur obiect în memorie — asta o ține simplă și
 * rapidă. Baza ține rânduri, ca să poată scrie o tură fără să rescrie anul.
 * Aici, și numai aici, se trece dintr-una într-alta.
 *
 * Nu vorbește cu rețeaua. De aia se poate verifica întreagă, fără server: o
 * traducere dus-întors trebuie să dea exact ce a intrat, altfel fiecare
 * salvare ar crede că s-a schimbat tot și ar rescrie tot.
 */

export type Row = Record<string, unknown>
/** Tabel → id → rând. */
export type Rows = Record<string, Record<string, Row>>

/**
 * Ordinea e a legăturilor: părintele înaintea copilului.
 *
 * Se scrie în ordinea asta și se șterge invers. O plată nu poate intra înainte
 * de datoria ei, și o datorie nu poate pleca înaintea plăților ei.
 */
export const TABLES = [
  'settings', 'modules', 'goals', 'goal_contributions', 'goal_readings',
  'tasks', 'habits', 'habit_ticks', 'notes', 'orgs',
  'debts', 'debt_holders', 'debt_refs', 'debt_plans', 'debt_actions', 'debt_files',
  'movements', 'docs', 'doc_files',
  'vehicles', 'workdays', 'work_periods', 'fuel', 'car_costs',
] as const

export type Table = typeof TABLES[number]

/** Rândul setărilor e unul singur; îi trebuie totuși un nume ca să fie găsit. */
export const SETTINGS_ID = 'me'

const n = <T>(value: T | undefined): T | null => (value === undefined ? null : value)

/** Ce vine din bază e `null`; ce lipsește în aplicație e `undefined`. */
const opt = <T>(value: unknown): T | undefined =>
  value === null || value === undefined ? undefined : (value as T)

const numOpt = (value: unknown): number | undefined =>
  value === null || value === undefined ? undefined : Number(value)

const flag = (value: unknown): true | undefined => (value === true ? true : undefined)

const empty = (): Rows => Object.fromEntries(TABLES.map(table => [table, {}])) as Rows

/* ---------------------------------------------------------------- dus ---- */

export function toRows(data: OsData): Rows {
  const rows = empty()
  const put = (table: Table, id: string, row: Row): void => { rows[table][id] = { id, ...row } }

  const s = data.settings
  put('settings', SETTINGS_ID, {
    currency: s.currency,
    seeded: s.seeded === true,
    alert_lead: n(s.alerts?.lead),
    alert_hour: n(s.alerts?.hour),
    delivery_tax_pct: n(s.delivery?.taxPct),
    delivery_ni_pct: n(s.delivery?.niPct),
    delivery_fuel_per_km: n(s.delivery?.fuelPerKm),
    delivery_veh_per_km: n(s.delivery?.vehPerKm),
  })

  for (const m of Object.values(data.modules)) {
    put('modules', m.id, { name: m.name, kind: m.kind, parent: n(m.parent), created_at: n(m.createdAt) })
  }

  for (const goal of Object.values(data.goals)) {
    put('goals', goal.id, {
      name: goal.name, kind: goal.kind, target: n(goal.target), unit: n(goal.unit),
      start_value: n(goal.start), source: n(goal.source), due: n(goal.due),
      is_main: goal.main === true, habits: n(goal.habits), created_at: n(goal.createdAt),
    })
    for (const c of goal.contrib ?? []) {
      put('goal_contributions', c.id, { goal_id: goal.id, date: c.date, amount: c.amount, note: n(c.note) })
    }
    for (const r of goal.reads ?? []) {
      put('goal_readings', r.id, { goal_id: goal.id, date: r.date, value: r.value, note: n(r.note) })
    }
  }

  for (const t of Object.values(data.tasks)) {
    put('tasks', t.id, {
      mod: t.mod, title: t.title, due: n(t.due), proj: n(t.proj),
      done: t.done === true, created_at: n(t.createdAt),
    })
  }

  for (const h of Object.values(data.habits)) {
    put('habits', h.id, { mod: h.mod, name: h.name, created_at: n(h.createdAt) })
    for (const [date, value] of Object.entries(h.log ?? {})) {
      put('habit_ticks', `${h.id}:${date}`, { habit_id: h.id, date, value })
    }
  }

  for (const note of Object.values(data.notes)) {
    put('notes', note.id, {
      mod: note.mod, title: n(note.title), body: n(note.body),
      created_at: n(note.createdAt), updated_at: n(note.updatedAt),
    })
  }

  for (const org of Object.values(data.orgs)) {
    put('orgs', org.id, {
      name: org.name, kind: n(org.kind), phone: n(org.phone), email: n(org.email),
      web: n(org.web), address: n(org.address), notes: n(org.notes), created_at: n(org.createdAt),
    })
  }

  for (const debt of Object.values(data.debts)) {
    put('debts', debt.id, {
      mod: debt.mod, name: debt.name, direction: debt.direction, category: n(debt.category),
      total: debt.total, status: debt.status, stage: n(debt.stage), since: n(debt.since),
      defaulted: n(debt.defaulted), due: n(debt.due), notes: n(debt.notes),
      created_at: n(debt.createdAt),
    })
    for (const h of debt.holders ?? []) {
      put('debt_holders', h.id, {
        debt_id: debt.id, org_id: h.org, role: h.role, from_date: n(h.from),
        to_date: n(h.to), ref: n(h.ref), notes: n(h.notes),
      })
    }
    for (const r of debt.refs ?? []) {
      put('debt_refs', r.id, { debt_id: debt.id, value: r.value, label: n(r.label), org_id: n(r.org) })
    }
    for (const p of debt.plans ?? []) {
      put('debt_plans', p.id, {
        debt_id: debt.id, kind: n(p.kind), amount: p.amount, every: p.every,
        next_due: n(p.next), from_date: n(p.from), to_date: n(p.to),
        status: p.status, notes: n(p.notes),
      })
    }
    for (const a of debt.actions ?? []) {
      put('debt_actions', a.id, {
        debt_id: debt.id, date: a.date, kind: a.kind, summary: a.summary,
        outcome: n(a.outcome), follow_up: n(a.followUp), org_id: n(a.org),
      })
    }
    for (const f of debt.files ?? []) {
      put('debt_files', f.id, { debt_id: debt.id, name: f.name, type: f.type, size: f.size })
    }
  }

  for (const month of Object.values(data.finance)) {
    for (const item of month.items) {
      put('movements', item.id, {
        date: item.date, kind: item.type, amount: item.amount,
        cat: n(item.cat), note: n(item.note), debt_id: n(item.debt),
      })
    }
  }

  for (const doc of Object.values(data.docs)) {
    put('docs', doc.id, {
      mod: doc.mod, title: doc.title, sender: n(doc.from), date: n(doc.date), ref: n(doc.ref),
      amount: n(doc.amount), due: n(doc.due), note: n(doc.note), debt_id: n(doc.debt),
      done: doc.done === true, created_at: n(doc.createdAt),
    })
    for (const f of doc.files ?? []) {
      put('doc_files', f.id, { doc_id: doc.id, name: f.name, type: f.type, size: f.size })
    }
  }

  for (const v of Object.values(data.vehicles)) {
    put('vehicles', v.id, {
      name: v.name, plate: n(v.plate), fuel_per_km: n(v.fuelPerKm),
      notes: n(v.notes), created_at: n(v.createdAt),
    })
  }

  for (const day of Object.values(data.workdays)) {
    put('workdays', day.id, {
      mod: day.mod, date: day.date, from_time: n(day.from), to_time: n(day.to),
      break_minutes: n(day.breakMinutes), vehicle_id: n(day.vehicle),
      odo_start: n(day.odoStart), odo_end: n(day.odoEnd), personal_km: n(day.personalKm),
      uber: n(day.uber), deliveroo: n(day.deliveroo), just_eat: n(day.justEat),
      other_platform: n(day.otherPlatform), tips: n(day.tips), bonuses: n(day.bonuses),
      parking: n(day.parking), tolls: n(day.tolls), other_cost: n(day.otherCost),
      expenses: n(day.expenses), recurring: n(day.recurring),
      to_debt: n(day.toDebt), debt_id: n(day.debt), notes: n(day.notes),
      done: day.done === true, archived: day.archived === true,
      rate_tax_pct: n(day.rates?.taxPct), rate_ni_pct: n(day.rates?.niPct),
      rate_fuel_per_km: n(day.rates?.fuelPerKm), rate_veh_per_km: n(day.rates?.vehPerKm),
      created_at: n(day.createdAt),
    })
    for (const p of day.periods ?? []) {
      put('work_periods', p.id, {
        workday_id: day.id, from_time: p.from, to_time: p.to, break_minutes: n(p.breakMinutes),
      })
    }
  }

  for (const f of Object.values(data.fuel)) {
    put('fuel', f.id, {
      mod: f.mod, date: f.date, vehicle_id: n(f.vehicle), odometer: n(f.odometer),
      litres: n(f.litres), cost: n(f.cost), is_full: f.full === true,
      notes: n(f.notes), created_at: n(f.createdAt),
    })
  }

  for (const c of Object.values(data.carCosts)) {
    put('car_costs', c.id, {
      mod: c.mod, date: c.date, vehicle_id: n(c.vehicle), category: n(c.category),
      what: n(c.what), amount: c.amount, business_pct: n(c.businessPct),
      from_date: n(c.from), to_date: n(c.to), notes: n(c.notes), created_at: n(c.createdAt),
    })
  }

  return rows
}

/* -------------------------------------------------------------- întors ---- */

const list = (rows: Rows, table: Table): Row[] => Object.values(rows[table] ?? {})

export function fromRows(rows: Rows): OsData {
  const data = emptyOsData()

  const s = rows.settings?.[SETTINGS_ID]
  if (s) {
    const settings: OsSettings = { currency: (s.currency as string) ?? '£' }
    if (s.seeded === true) settings.seeded = true
    if (s.alert_lead !== null && s.alert_lead !== undefined) {
      settings.alerts = { lead: Number(s.alert_lead), hour: Number(s.alert_hour ?? 0) }
    }
    if (s.delivery_tax_pct !== null && s.delivery_tax_pct !== undefined) {
      settings.delivery = {
        taxPct: Number(s.delivery_tax_pct), niPct: Number(s.delivery_ni_pct ?? 0),
        fuelPerKm: Number(s.delivery_fuel_per_km ?? 0), vehPerKm: Number(s.delivery_veh_per_km ?? 0),
      }
    }
    data.settings = settings
  }

  for (const row of list(rows, 'modules')) {
    const m: OsModule = {
      id: row.id as string, name: row.name as string, kind: row.kind as string,
    }
    const parent = opt<string>(row.parent); if (parent !== undefined) m.parent = parent
    const at = opt<string>(row.created_at); if (at !== undefined) m.createdAt = at
    data.modules[m.id] = m
  }

  for (const row of list(rows, 'goals')) {
    const goal: Goal = {
      id: row.id as string, name: row.name as string, kind: row.kind as Goal['kind'],
    }
    goal.target = numOpt(row.target)
    goal.unit = opt<string>(row.unit)
    goal.start = numOpt(row.start_value)
    goal.source = opt<string>(row.source)
    goal.due = opt<string>(row.due)
    goal.main = flag(row.is_main)
    goal.habits = opt<string[]>(row.habits)
    goal.createdAt = opt<string>(row.created_at)
    data.goals[goal.id] = prune(goal) as Goal
  }

  for (const row of list(rows, 'goal_contributions')) {
    const goal = data.goals[row.goal_id as string]
    if (!goal) continue
    const c: Contribution = {
      id: row.id as string, date: row.date as string, amount: Number(row.amount),
    }
    const note = opt<string>(row.note); if (note !== undefined) c.note = note
    ;(goal.contrib ??= []).push(c)
  }

  for (const row of list(rows, 'goal_readings')) {
    const goal = data.goals[row.goal_id as string]
    if (!goal) continue
    const r: Reading = {
      id: row.id as string, date: row.date as string, value: Number(row.value),
    }
    const note = opt<string>(row.note); if (note !== undefined) r.note = note
    ;(goal.reads ??= []).push(r)
  }

  for (const row of list(rows, 'tasks')) {
    const t: Task = {
      id: row.id as string, mod: row.mod as string, title: row.title as string,
      done: row.done === true,
    }
    t.due = opt<string>(row.due)
    t.proj = opt<string>(row.proj)
    t.createdAt = opt<string>(row.created_at)
    data.tasks[t.id] = prune(t) as Task
  }

  for (const row of list(rows, 'habits')) {
    const h: Habit = { id: row.id as string, mod: row.mod as string, name: row.name as string, log: {} }
    h.createdAt = opt<string>(row.created_at)
    data.habits[h.id] = prune(h) as Habit
  }

  for (const row of list(rows, 'habit_ticks')) {
    const habit = data.habits[row.habit_id as string]
    if (habit) habit.log[row.date as string] = Number(row.value)
  }

  for (const row of list(rows, 'notes')) {
    const note: Note = { id: row.id as string, mod: row.mod as string }
    note.title = opt<string>(row.title)
    note.body = opt<string>(row.body)
    note.createdAt = opt<string>(row.created_at)
    note.updatedAt = opt<string>(row.updated_at)
    data.notes[note.id] = prune(note) as Note
  }

  for (const row of list(rows, 'orgs')) {
    const org: Org = { id: row.id as string, name: row.name as string }
    org.kind = opt<string>(row.kind)
    org.phone = opt<string>(row.phone)
    org.email = opt<string>(row.email)
    org.web = opt<string>(row.web)
    org.address = opt<string>(row.address)
    org.notes = opt<string>(row.notes)
    org.createdAt = opt<string>(row.created_at)
    data.orgs[org.id] = prune(org) as Org
  }

  for (const row of list(rows, 'debts')) {
    const debt: Debt = {
      id: row.id as string, mod: row.mod as string, name: row.name as string,
      direction: row.direction as Debt['direction'], total: Number(row.total),
      status: row.status as string,
    }
    debt.category = opt<string>(row.category)
    debt.stage = opt<string>(row.stage)
    debt.since = opt<string>(row.since)
    debt.defaulted = opt<string>(row.defaulted)
    debt.due = opt<string>(row.due)
    debt.notes = opt<string>(row.notes)
    debt.createdAt = opt<string>(row.created_at)
    data.debts[debt.id] = prune(debt) as Debt
  }

  for (const row of list(rows, 'debt_holders')) {
    const debt = data.debts[row.debt_id as string]
    if (!debt) continue
    const h: DebtHolder = {
      id: row.id as string, org: (row.org_id as string) ?? '', role: row.role as string,
    }
    h.from = opt<string>(row.from_date)
    h.to = opt<string>(row.to_date)
    h.ref = opt<string>(row.ref)
    h.notes = opt<string>(row.notes)
    ;(debt.holders ??= []).push(prune(h) as DebtHolder)
  }

  for (const row of list(rows, 'debt_refs')) {
    const debt = data.debts[row.debt_id as string]
    if (!debt) continue
    const r: DebtRef = { id: row.id as string, value: row.value as string }
    r.label = opt<string>(row.label)
    r.org = opt<string>(row.org_id)
    ;(debt.refs ??= []).push(prune(r) as DebtRef)
  }

  for (const row of list(rows, 'debt_plans')) {
    const debt = data.debts[row.debt_id as string]
    if (!debt) continue
    const p: DebtPlan = {
      id: row.id as string, amount: Number(row.amount), every: row.every as DebtPlan['every'],
      status: row.status as string,
    }
    p.kind = opt<string>(row.kind)
    p.next = opt<string>(row.next_due)
    p.from = opt<string>(row.from_date)
    p.to = opt<string>(row.to_date)
    p.notes = opt<string>(row.notes)
    ;(debt.plans ??= []).push(prune(p) as DebtPlan)
  }

  for (const row of list(rows, 'debt_actions')) {
    const debt = data.debts[row.debt_id as string]
    if (!debt) continue
    const a: DebtAction = {
      id: row.id as string, date: row.date as string, kind: row.kind as string,
      summary: row.summary as string,
    }
    a.outcome = opt<string>(row.outcome)
    a.followUp = opt<string>(row.follow_up)
    a.org = opt<string>(row.org_id)
    ;(debt.actions ??= []).push(prune(a) as DebtAction)
  }

  for (const row of list(rows, 'debt_files')) {
    const debt = data.debts[row.debt_id as string]
    if (!debt) continue
    ;(debt.files ??= []).push(fileOf(row))
  }

  for (const row of list(rows, 'movements')) {
    const item: Movement = {
      id: row.id as string, date: row.date as string, type: row.kind as Movement['type'],
      amount: Number(row.amount),
    }
    item.cat = opt<string>(row.cat)
    item.note = opt<string>(row.note)
    item.debt = opt<string>(row.debt_id)
    const month = item.date.slice(0, 7)
    data.finance[month] ??= { items: [] }
    data.finance[month].items.push(prune(item) as Movement)
  }

  for (const row of list(rows, 'docs')) {
    const doc: Doc = {
      id: row.id as string, mod: row.mod as string, title: row.title as string,
    }
    doc.from = opt<string>(row.sender)
    doc.date = opt<string>(row.date)
    doc.ref = opt<string>(row.ref)
    doc.amount = numOpt(row.amount)
    doc.due = opt<string>(row.due)
    doc.note = opt<string>(row.note)
    doc.debt = opt<string>(row.debt_id)
    doc.done = row.done === true
    doc.createdAt = opt<string>(row.created_at)
    data.docs[doc.id] = prune(doc) as Doc
  }

  for (const row of list(rows, 'doc_files')) {
    const doc = data.docs[row.doc_id as string]
    if (doc) (doc.files ??= []).push(fileOf(row))
  }

  for (const row of list(rows, 'vehicles')) {
    const v: Vehicle = { id: row.id as string, name: row.name as string }
    v.plate = opt<string>(row.plate)
    v.fuelPerKm = numOpt(row.fuel_per_km)
    v.notes = opt<string>(row.notes)
    v.createdAt = opt<string>(row.created_at)
    data.vehicles[v.id] = prune(v) as Vehicle
  }

  for (const row of list(rows, 'workdays')) {
    const day: Workday = { id: row.id as string, mod: row.mod as string, date: row.date as string }
    day.from = opt<string>(row.from_time)
    day.to = opt<string>(row.to_time)
    day.breakMinutes = numOpt(row.break_minutes)
    day.vehicle = opt<string>(row.vehicle_id)
    day.odoStart = numOpt(row.odo_start)
    day.odoEnd = numOpt(row.odo_end)
    day.personalKm = numOpt(row.personal_km)
    day.uber = numOpt(row.uber)
    day.deliveroo = numOpt(row.deliveroo)
    day.justEat = numOpt(row.just_eat)
    day.otherPlatform = numOpt(row.other_platform)
    day.tips = numOpt(row.tips)
    day.bonuses = numOpt(row.bonuses)
    day.parking = numOpt(row.parking)
    day.tolls = numOpt(row.tolls)
    day.otherCost = numOpt(row.other_cost)
    day.expenses = numOpt(row.expenses)
    day.recurring = numOpt(row.recurring)
    day.toDebt = numOpt(row.to_debt)
    day.debt = opt<string>(row.debt_id)
    day.notes = opt<string>(row.notes)
    day.done = row.done === true ? true : false
    day.archived = flag(row.archived)
    if (row.rate_tax_pct !== null && row.rate_tax_pct !== undefined) {
      day.rates = {
        taxPct: Number(row.rate_tax_pct), niPct: Number(row.rate_ni_pct ?? 0),
        fuelPerKm: Number(row.rate_fuel_per_km ?? 0), vehPerKm: Number(row.rate_veh_per_km ?? 0),
      }
    }
    day.createdAt = opt<string>(row.created_at)
    data.workdays[day.id] = prune(day) as Workday
  }

  for (const row of list(rows, 'work_periods')) {
    const day = data.workdays[row.workday_id as string]
    if (!day) continue
    const p: WorkPeriod = {
      id: row.id as string, from: row.from_time as string, to: row.to_time as string,
    }
    p.breakMinutes = numOpt(row.break_minutes)
    ;(day.periods ??= []).push(prune(p) as WorkPeriod)
  }

  for (const row of list(rows, 'fuel')) {
    const f: Fuel = { id: row.id as string, mod: row.mod as string, date: row.date as string }
    f.vehicle = opt<string>(row.vehicle_id)
    f.odometer = numOpt(row.odometer)
    f.litres = numOpt(row.litres)
    f.cost = numOpt(row.cost)
    f.full = flag(row.is_full)
    f.notes = opt<string>(row.notes)
    f.createdAt = opt<string>(row.created_at)
    data.fuel[f.id] = prune(f) as Fuel
  }

  for (const row of list(rows, 'car_costs')) {
    const c: CarExpense = {
      id: row.id as string, mod: row.mod as string, date: row.date as string,
      amount: Number(row.amount),
    }
    c.vehicle = opt<string>(row.vehicle_id)
    c.category = opt<string>(row.category)
    c.what = opt<string>(row.what)
    c.businessPct = numOpt(row.business_pct)
    c.from = opt<string>(row.from_date)
    c.to = opt<string>(row.to_date)
    c.notes = opt<string>(row.notes)
    c.createdAt = opt<string>(row.created_at)
    data.carCosts[c.id] = prune(c) as CarExpense
  }

  sortNested(data)
  return data
}

const fileOf = (row: Row): DocFile => ({
  id: row.id as string, name: row.name as string,
  type: (row.type as string) ?? '', size: Number(row.size ?? 0),
})

/** Scoate cheile rămase goale, ca obiectul să arate ca cel scris de aplicație. */
function prune<T extends object>(value: T): T {
  for (const key of Object.keys(value)) {
    if ((value as Record<string, unknown>)[key] === undefined) {
      delete (value as Record<string, unknown>)[key]
    }
  }
  return value
}

/**
 * Rândurile vin în orice ordine. Listele din interior se așază după id, ca
 * două citiri ale acelorași date să dea același obiect.
 */
function sortNested(data: OsData): void {
  const byId = (a: { id: string }, b: { id: string }): number => a.id.localeCompare(b.id)
  for (const goal of Object.values(data.goals)) {
    goal.contrib?.sort(byId); goal.reads?.sort(byId)
  }
  for (const debt of Object.values(data.debts)) {
    debt.holders?.sort(byId); debt.refs?.sort(byId)
    debt.plans?.sort(byId); debt.actions?.sort(byId); debt.files?.sort(byId)
  }
  for (const doc of Object.values(data.docs)) doc.files?.sort(byId)
  for (const day of Object.values(data.workdays)) day.periods?.sort(byId)
  for (const month of Object.values(data.finance)) month.items.sort(byId)
}

/* --------------------------------------------------------------- diferența - */

export interface Change {
  table: Table
  /** Rândurile de scris, în ordinea părinte-înainte-de-copil. */
  upserts: Row[]
  /** Id-urile de șters. Ștergerile merg în ordine inversă. */
  deletes: string[]
}

const same = (a: Row, b: Row): boolean => JSON.stringify(a) === JSON.stringify(b)

/**
 * Ce s-a schimbat între două stări.
 *
 * Asta e tot rostul mutării: modifici o tură, pleacă o tură. Ce n-a fost
 * atins nu se rescrie, oricât de mult ar fi.
 */
export function changesBetween(before: Rows, after: Rows): Change[] {
  return TABLES.map(table => {
    const old = before[table] ?? {}
    const next = after[table] ?? {}
    return {
      table,
      upserts: Object.entries(next)
        .filter(([id, row]) => !old[id] || !same(old[id], row))
        .map(([, row]) => row),
      deletes: Object.keys(old).filter(id => !(id in next)),
    }
  }).filter(change => change.upserts.length > 0 || change.deletes.length > 0)
}

export const isEmpty = (rows: Rows): boolean =>
  TABLES.every(table => Object.keys(rows[table] ?? {}).length === 0)
