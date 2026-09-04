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
  /** Contul prin care au trecut: banca sau cash-ul. Lipsă la cele vechi. */
  account?: string
  /**
   * Platforma de pe care au venit, la banii scoși de pe Uber sau Deliveroo.
   *
   * Cu ea știe platforma cât i-a mai rămas: mișcarea e scrisă o dată, în
   * Finanțe, iar soldul platformei se uită la ea.
   */
  from?: string
  /**
   * Cât a plecat de pe platformă, când nu e același lucru cu ce a intrat în
   * bancă. La scoaterea pe loc pleacă tot, dar ajunge mai puțin cu comisionul.
   */
  gross?: number
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

/** O mașină folosită la livrări. Consumul stă aici: mașinile beau diferit. */
export interface Vehicle {
  id: string
  name: string
  plate?: string
  /** Costul cu combustibilul, pe kilometru. */
  fuelPerKm?: number
  notes?: string
  createdAt?: string
}

/**
 * O alimentare.
 *
 * Doar ce citești de pe bon și de pe bord. Consumul, prețul pe litru și
 * costul pe kilometru nu se scriu: ies din lanțul de alimentări, la fiecare
 * privire. Scrise, s-ar învechi în tăcere de fiecare dată când corectezi o
 * cifră mai veche.
 */
export interface Fuel {
  id: string
  mod: string
  date: string
  vehicle?: string
  /** Kilometrajul de pe bord, la pompă. Fără el, alimentarea nu spune nimic. */
  odometer?: number
  litres?: number
  cost?: number
  /**
   * Plin, sau parțial.
   *
   * Consumul se poate socoti numai între două plinuri: doar atunci știi că
   * rezervorul a pornit și s-a terminat în același punct. Alimentările
   * parțiale dintre ele se adună la interval.
   */
  full?: boolean
  notes?: string
  createdAt?: string
}

/**
 * O cheltuială cu mașina: reparație, asigurare, ITP, cauciucuri, spălare.
 *
 * `businessPct` spune cât din ea e de business. O asigurare pe o mașină
 * folosită și personal nu e cheltuială de business în întregime, iar
 * trecută integral ți-ar strica socoteala pe care o arăți la taxe.
 *
 * O cheltuială care acoperă o perioadă — asigurarea pe un an — nu cade toată
 * pe ziua în care ai plătit-o. Se împarte pe zilele pe care le acoperă, iar
 * fiecare tură ia partea zilei ei.
 */
export interface CarExpense {
  id: string
  mod: string
  date: string
  vehicle?: string
  /** Reparație, asigurare, ITP, cauciucuri, service, spălare, altele. */
  category?: string
  what?: string
  amount: number
  /** Cât la sută e de business, ca fracție. Lipsă înseamnă tot. */
  businessPct?: number
  /** Prima și ultima zi acoperită, la cheltuielile care se întind. */
  from?: string
  to?: string
  notes?: string
  createdAt?: string
}

/**
 * O bucată din tură: de când până când, minus pauza.
 *
 * Ziua de livrări rar e dintr-o bucată. Ieși la prânz, te oprești, ieși iar
 * seara. Dacă ai scrie 11:00–22:00, orele ar ieși cu patru mai multe decât
 * ai stat pe drum, iar câștigul pe oră — singura cifră după care știi dacă
 * merită tura — ar ieși mai mic decât e.
 */
export interface WorkPeriod {
  id: string
  from: string
  to: string
  breakMinutes?: number
}


/**
 * Când pleacă banii de pe o platformă către bancă.
 *
 * Uber, Deliveroo și Just Eat plătesc singure, o dată pe săptămână, la o zi
 * și o oră știute. Până atunci banii sunt câștigați, dar nu-i ai — iar dacă
 * i-ai socoti ca și cum i-ai avea, ai cheltui bani care încă n-au venit.
 */
export interface PayoutRule {
  /** Ziua în care plătesc: 0 duminică, 1 luni … 6 sâmbătă. */
  day: number
  /** Ora, ca `13:00`. */
  at: string
}

/**
 * Un cont: o platformă de livrări, un cont bancar, sau banii din buzunar.
 *
 * Platformele țin banii câștigați până în ziua de plată. Banca și cash-ul țin
 * bani adevărați, deci mișcările lor sunt în Finanțe. Soldul nu se salvează
 * nicăieri: se socotește din ce s-a scris, ca să nu existe două adevăruri.
 */
export interface Account {
  id: string
  name: string
  /** `platform` — Uber, Deliveroo. `bank` — Monzo. `cash` — buzunarul. */
  kind: 'platform' | 'bank' | 'cash'
  /** Doar la platforme: cât costă scoaterea banilor pe loc. */
  cashOutFee?: number
  /** Doar la platforme: când plătesc singure. Lipsă înseamnă că nu plătesc. */
  payout?: PayoutRule
  /** Doar la platforme: contul bancar în care intră banii. */
  payTo?: string
  notes?: string
  createdAt?: string
}

/**
 * O tură de livrări.
 *
 * Ce scrii tu stă aici; cifrele care ies din ele nu se salvează, se calculează
 * la fiecare privire. Singura excepție sunt procentele: ziua le păstrează pe
 * cele de atunci, ca o schimbare de azi să nu rescrie luna trecută.
 */
export interface Workday {
  id: string
  mod: string
  date: string
  /** Primul interval al turei: ora de plecare. */
  from?: string
  /** Ora la care s-a închis primul interval. */
  to?: string
  breakMinutes?: number
  /** Celelalte ieșiri din aceeași zi. Orele lor se adună la ale primului. */
  periods?: WorkPeriod[]
  vehicle?: string
  odoStart?: number
  odoEnd?: number
  personalKm?: number
  /**
   * Cât a câștigat fiecare platformă, pe id de cont.
   *
   * Turele scrise înainte de conturi n-au harta asta; pentru ele se citesc
   * câmpurile de mai jos. Așa istoricul rămâne întreg fără să fie rescris.
   */
  earnings?: Record<string, number>
  /** @deprecated Ținut pentru turele scrise înainte de conturi. */
  uber?: number
  /** @deprecated */
  deliveroo?: number
  /** @deprecated */
  justEat?: number
  /** @deprecated */
  otherPlatform?: number
  tips?: number
  bonuses?: number
  parking?: number
  tolls?: number
  otherCost?: number
  /** Cheltuieli ale zilei, în afara celor de mai sus. */
  expenses?: number
  /** Partea din cheltuielile lunare care cade pe ziua asta. */
  recurring?: number
  /** Cât ai trimis efectiv către datorii din ziua asta. */
  toDebt?: number
  /** Datoria către care s-a dus, dacă a fost una anume. */
  debt?: string
  notes?: string
  /** `false` cât timp o completezi. Zilele neterminate nu intră în totaluri. */
  done?: boolean
  /**
   * Intrare veche, adusă din istoric.
   *
   * Se socotește ca oricare alta — ore, kilometri, cât a rămas — dar nu scrie
   * nimic în Finanțe. Banii aceia au fost câștigați și cheltuiți demult;
   * trecuți acum prin registru, ți-ar umfla soldul de azi cu o sumă care nu
   * există.
   */
  archived?: boolean
  /** Procentele cu care a fost calculată, înghețate la terminare. */
  rates?: DeliveryRates
  createdAt?: string
}

/** Procentele și costurile pe kilometru, cu care se calculează o zi. */
export interface DeliveryRates {
  /** Cât pui deoparte pentru taxe, ca fracție: 0.2 înseamnă 20%. */
  taxPct: number
  niPct: number
  fuelPerKm: number
  /** Cât pui deoparte pentru mașină, pe kilometru. */
  vehPerKm: number
}

export interface OsSettings {
  currency: string
  seeded?: boolean
  /** Cu câte zile înainte și la ce oră sună notificările. */
  alerts?: { lead: number; hour: number }
  /** Procentele folosite la livrări, cele curente. */
  delivery?: DeliveryRates
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
  vehicles: Record<string, Vehicle>
  accounts: Record<string, Account>
  workdays: Record<string, Workday>
  fuel: Record<string, Fuel>
  carCosts: Record<string, CarExpense>
  docs: Record<string, Doc>
  finance: FinanceByMonth
  settings: OsSettings
}

export const emptyOsData = (): OsData => ({
  modules: {}, goals: {}, tasks: {}, habits: {},
  notes: {}, debts: {}, orgs: {}, vehicles: {}, accounts: {}, workdays: {}, fuel: {},
  carCosts: {}, docs: {}, finance: {},
  settings: { currency: '£' },
})
