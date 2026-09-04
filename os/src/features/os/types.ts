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

/**
 * Organizațiile cu care ai de-a face pe o datorie: banca, recuperatorul,
 * avocatul, instanța, executorul. Stau separat de datorii pentru că aceeași
 * firmă apare pe mai multe, iar numărul ei de telefon se schimbă o dată, nu
 * de zece ori.
 */
export interface Org {
  id: string
  name: string
  /** Ce fel de firmă e: bancă, recuperator, avocat, instanță, executor. */
  kind?: string
  phone?: string
  email?: string
  web?: string
  address?: string
  notes?: string
  createdAt?: string
}

/**
 * Cine ține datoria, în ce rol și din ce dată.
 *
 * Datoriile se vând. Fără istoricul ăsta, peste un an nu mai știi cine ți-a
 * scris prima oară, cine a cumpărat-o și cui îi datorezi acum — iar fiecare
 * dintre ei ți-a dat altă referință.
 */
export interface DebtHolder {
  id: string
  org: string
  /** Creditor inițial, proprietar anterior, proprietar curent, colectare, avocat, instanță, executor. */
  role: string
  from?: string
  to?: string
  /** Referința pe care ți-o dă firma asta. Fiecare are alta. */
  ref?: string
  notes?: string
}

/**
 * Un număr de referință. O scrisoare poate purta mai multe deodată — numărul
 * de client, numărul de cont, numărul de dosar — și fiecare firmă îl cere pe
 * al ei. `label` spune care e care, altfel rămâi cu trei numere și niciun
 * indiciu pe care să-l citești la telefon.
 */
export interface DebtRef {
  id: string
  value: string
  label?: string
  /** Firma care ți l-a dat, dacă se știe. */
  org?: string
}

export type PlanEvery = 'week' | 'fortnight' | 'month' | 'quarter' | 'once'

/** Înțelegerea de plată: cât, cât de des, de când, și dacă mai ține. */
export interface DebtPlan {
  id: string
  /** Standard, redus, temporar, simbolic, de stingere, hotărât de instanță. */
  kind?: string
  amount: number
  every: PlanEvery
  /** Următoarea scadență. De aici pleacă și intrarea din calendar. */
  next?: string
  from?: string
  to?: string
  status: string
  notes?: string
}

/**
 * Fiecare telefon, scrisoare, email. Cu ce a ieșit din el și când e
 * follow-up-ul.
 *
 * Ăsta e ce te apără când firma spune altceva peste șase luni: ai data, ora
 * și ce s-a stabilit.
 */
export interface DebtAction {
  id: string
  date: string
  /** Telefon, email, scrisoare primită, scrisoare trimisă, plângere, dispută. */
  kind: string
  summary: string
  outcome?: string
  followUp?: string
  org?: string
}

/**
 * O datorie, în ambele sensuri: ce datorezi tu și ce ți se datorează.
 *
 * Plățile nu stau aici. O plată e o mișcare în Finanțe, marcată cu datoria —
 * o singură înregistrare, citită din două locuri, ca să nu existe două
 * adevăruri despre aceiași bani.
 */
export interface Debt {
  id: string
  mod: string
  name: string
  /** `owe` — datorezi tu. `owed` — ți se datorează. */
  direction: 'owe' | 'owed'
  /** Card, împrumut, overdraft, ipotecă, utilități, council tax, HMRC, catalog, telefon. */
  category?: string
  /** Soldul de la care pleci. Plățile îl scad. */
  total: number
  status: string
  /** Stadiul legal: de la notificare de default la CCJ sau executare. */
  stage?: string
  since?: string
  defaulted?: string
  due?: string
  holders?: DebtHolder[]
  /** Toate referințele datoriei, nu doar cea a firmei curente. */
  refs?: DebtRef[]
  plans?: DebtPlan[]
  actions?: DebtAction[]
  /** Scrisorile scanate. Stau la datoria lor, nu în Documente. */
  files?: DocFile[]
  notes?: string
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
  /** Datoria pe care o plătește, dacă e o plată. Legătura într-un singur sens:
      banii sunt scriși o dată, aici, iar datoria se uită la ei. */
  debt?: string
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
  /** Cu câte zile înainte și la ce oră sună notificările. */
  alerts?: { lead: number; hour: number }
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
  orgs: Record<string, Org>
  docs: Record<string, Doc>
  finance: FinanceByMonth
  settings: OsSettings
}

export const emptyOsData = (): OsData => ({
  modules: {}, goals: {}, tasks: {}, habits: {},
  notes: {}, debts: {}, orgs: {}, docs: {}, finance: {},
  settings: { currency: '£' },
})
