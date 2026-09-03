/**
 * Datele Roberto OS. Un singur obiect, salvat sub o cheie proprie, ca să nu
 * atingă cheile aplicației de sală care stau alături în același browser.
 */

export type GoalKind = 'sum' | 'metric'

export interface Contribution {
  id: string
  date: string
  amount: number
  note?: string
}

export interface Reading {
  id: string
  date: string
  value: number
  note?: string
}

export interface Goal {
  id: string
  name: string
  kind: GoalKind
  /** Ținta. Lipsește cât timp obiectivul e doar schițat. */
  target?: number
  /** Doar la măsurători: unitatea și valoarea de plecare. */
  unit?: string
  start?: number
  due?: string
  /** Ancoră: apare pe fiecare ecran. Pot fi mai multe. */
  main?: boolean
  /** Obiceiurile care alimentează obiectivul, pentru consecvență. */
  habits?: string[]
  contrib?: Contribution[]
  reads?: Reading[]
  createdAt?: string
}

export interface Task {
  id: string
  mod: string
  title: string
  due?: string
  proj?: string
  done: boolean
  createdAt?: string
}

export interface Habit {
  id: string
  mod: string
  name: string
  /** Zilele bifate, ca `{ '2026-09-03': 1 }`. Stau aici, nu ca fișe separate. */
  log: Record<string, number>
  createdAt?: string
}

export interface Debt {
  id: string
  name: string
  total: number
  due?: string
  payments?: Contribution[]
  createdAt?: string
}

export interface Note {
  id: string
  mod: string
  title?: string
  body?: string
  createdAt?: string
  updatedAt?: string
}

export type MoneyKind = 'in' | 'out'

export interface Movement {
  id: string
  date: string
  type: MoneyKind
  amount: number
  cat?: string
  note?: string
}

/** Finanțele stau grupate pe luni — o fișă pe lună, oricâte mișcări. */
export type FinanceByMonth = Record<string, { items: Movement[] }>

export interface OsModule {
  id: string
  name: string
  kind: string
  /** Modulele se pot cuibări pe oricâte niveluri. */
  parent?: string
  createdAt?: string
}

export interface OsSettings {
  currency: string
  seeded?: boolean
}

export interface OsData {
  modules: Record<string, OsModule>
  goals: Record<string, Goal>
  tasks: Record<string, Task>
  habits: Record<string, Habit>
  notes: Record<string, Note>
  debts: Record<string, Debt>
  finance: FinanceByMonth
  settings: OsSettings
}

export const emptyOsData = (): OsData => ({
  modules: {}, goals: {}, tasks: {}, habits: {},
  notes: {}, debts: {}, finance: {},
  settings: { currency: '£' },
})
