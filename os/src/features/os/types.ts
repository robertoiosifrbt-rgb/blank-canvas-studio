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
  /**
   * De unde vin citirile, când nu le scrii de mână: `gym:waistCm` înseamnă
   * talia din măsurătorile aplicației de sală. Lipsește la obiectivele care
   * se măsoară manual.
   */
  source?: string
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

/** Un fișier atașat unui document: cât să-l poți arăta și regăsi. */
export interface DocFile {
  id: string
  name: string
  type: string
  size: number
}

/**
 * O hârtie primită: o scrisoare, o factură, o decizie.
 *
 * Ține ce ai nevoie ca s-o poți lăsa din mână — cine a trimis-o, când, ce
 * referință are, ce trebuie făcut și până când — plus unde stă originalul.
 * Termenul intră în calendar, ca orice altceva cu o dată.
 */
export interface Doc {
  id: string
  mod: string
  title: string
  /** Cine a trimis-o: DWP, HMRC, banca. */
  from?: string
  /** Data de pe hârtie, nu ziua în care ai introdus-o. */
  date?: string
  /** Referința lor — cu ea te caută când suni. */
  ref?: string
  amount?: number
  /** Ce ai de făcut până când. Ăsta ajunge în calendar. */
  due?: string
  note?: string
  /** Datoria pe care o privește, dacă e cazul. */
  debt?: string
  /**
   * Scanurile atașate. Lista stă aici, deci se sincronizează cu restul
   * datelor; conținutul stă în Storage, unde încape.
   */
  files?: DocFile[]
  done?: boolean
  createdAt?: string
}

export interface OsData {
  modules: Record<string, OsModule>
  goals: Record<string, Goal>
  tasks: Record<string, Task>
  habits: Record<string, Habit>
  notes: Record<string, Note>
  debts: Record<string, Debt>
  docs: Record<string, Doc>
  finance: FinanceByMonth
  settings: OsSettings
}

export const emptyOsData = (): OsData => ({
  modules: {}, goals: {}, tasks: {}, habits: {},
  notes: {}, debts: {}, docs: {}, finance: {},
  settings: { currency: '£' },
})
