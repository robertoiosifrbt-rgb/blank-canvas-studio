// ⚠️ Verdictul de metodă de concediu e publicat de `payrollProfileEndpoints.ts` (felia 30):
// e același obiect, produs de aceeași politică de pe server. ⛔ A doua copie ar fi greșeala
// care a produs ACHU-741.
import type { HolidayMethodVerdict } from './payrollProfileEndpoints';

/**
 * ACHU-401, felia a noua — formele răspunsurilor de BOALĂ, citite din ruta care le produce.
 *
 * ⛔ **Fișier propriu, nu tipuri în `endpoints.ts`:** acela are 1422 de rânduri și nu are voie să
 * crească (`AGENT_RULES` §7). Același tipar ca `portalTypes.ts` (felia 7).
 *
 * 🔴 **Fiecare câmp de aici e citit din `backend/src/lib/sicknessOperations.ts` (`serialise`) și
 * din răspunsurile lui `routes/sickness.ts`** — nu ghicit din cum arată ecranul. Un tip inventat e
 * mai rău decât `any`: `any` măcar nu minte.
 *
 * ⚠️ Ce **nu** e tipat aici, deliberat: rezultatul de calcul al SSP-ului (`calculation`). Are formă
 * proprie, e produs de motorul de payroll, iar payroll-ul e oprit — un tip scris din afară s-ar
 * despărți tăcut de motor. Rămâne `unknown` acolo unde nu e citit, și `SspPreview` unde ecranul
 * chiar îl citește, cu doar câmpurile pe care le atinge.
 */

/** Un episod de boală, exact cum îl serializează serverul. */
export type SicknessAbsence = {
  id: string;
  reference: number;
  cleanerId: string;
  cleanerName: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  qualifyingWeekdays: number[];
  averageWeeklyEarningsPence: number | null;
  sspDaysPaid: number;
  sspTotalPence: number;
  sspTotal: number;
  waitingDaysServed: number;
  companySickPayPence: number | null;
  /** ⚠️ Distinge „nedecis" de „decis că nimic" — de aceea nu e derivat pe ecran. */
  companySickPayDecided: boolean;
  fitNotePath: string | null;
  fitNoteFrom: string | null;
  fitNoteTo: string | null;
  returnToWorkOn: string | null;
  returnToWorkBy: string | null;
  returnToWorkNote: string | null;
  returnToWorkOutstanding: boolean;
  notes: string | null;
};

export type SicknessTotals = {
  spells: number;
  open: number;
  sspDaysPaid: number;
  sspTotalPence: number;
  companySickPayPence: number;
  returnToWorkOutstanding: number;
};

/** Regulile publicate de server, ca un ecran să nu le rescrie. */
export type SicknessRules = {
  taxYear: string;
  weeklyRatePence: number;
  minSickDays: number;
  waitingDays: number;
  maxWeeks: number;
  linkingDays: number;
  earningsCapPercent: number;
  note: string;
  /** ⚠️ CINE a citit pagina gov.uk și CÂND — plus când a fost ea însăși publicată/actualizată. */
  verified: { on: string; by: string; pagePublished: string; pageUpdated: string };
};

export type SicknessListResponse = {
  period: { from: string | null; to: string | null };
  absences: SicknessAbsence[];
  totals: SicknessTotals;
  rules: SicknessRules;
  companySickPayNote: string;
  /**
   * ✅ Întrebări **închise**, păstrate anume: o întrebare rezolvată, citită ca deschisă, trimite
   * pe cineva s-o caute a doua oară. ⛔ Cheia e numele regulii; valoarea, verdictul cu sursa.
   */
  unverified?: { settled: Record<string, string> };
  /**
   * 🔴 Reguli pe care HMRC LE ARE și modulul NU le implementează — `SSP_NOT_MODELLED`.
   *
   * ⛔ Prima scriere a tipului a pus `string[]` și a picat: e un obiect pe **categorii**, iar
   * gruparea e chiar informația. ⚠️ `eligibility.esa85Days` e singura care poate mușca ACHU
   * (aplicația nu poate ști despre ESA), de aceea ecranul o arată **deasupra** totalurilor.
   */
  notModelled?: {
    transitional: Record<string, string>;
    eligibility: Record<string, string>;
    partDays: string;
  };
};

/**
 * Previzualizarea, așa cum o compune `GET /sickness/preview`.
 *
 * ⚠️ Tipul ăsta era, până la felia 32, **doar ce citea ecranul** — cinci câmpuri. Restul erau
 * tăcute, iar fixtura le inventa (`waitingDates`, `cappedDates`, `pence`) fără ca nimic să
 * verifice. Acum e răspunsul întreg, citit din rută.
 */
export type SspPreview = {
  /** `true` = episodul e încă deschis, deci cifra e o estimare până azi. */
  provisional: boolean;
  /** Ultima zi luată în calcul: data de sfârșit, sau azi pentru un episod deschis. */
  effectiveEnd: string;
  preview: {
    eligibility: {
      sickCalendarDays: number;
      /** `true` de la a patra zi consecutivă încolo. */
      isPiw: boolean;
      linkedToPrevious: boolean;
      waitingDaysToServe: number;
      qualifyingDates: string[];
      /** ⚠️ Zilele de așteptare — **neplătite**. Numărul lor e `waitingDaysServed` pe episod. */
      waitingDates: string[];
      payableDates: string[];
      weeksUsed: number;
      /** ⛔ Zile refuzate fiindcă s-a atins plafonul de 28 de săptămâni. Raportate, nu ascunse. */
      cappedDates: string[];
      note: string;
    };
    weeklyRatePence: number;
    dailyRatePence: number;
    payableDays: number;
    totalPence: number;
    /** Zilele de așteptare, prețuite — ⛔ doar ca să se **vadă** cât costă regula. */
    withheldForWaitingPence: number;
    capApplied: boolean;
    taxYear: string;
    /** ⚠️ Practic niciodată gol. Ce nu are voie să fie prezentat drept lucru închis. */
    warnings: string[];
    note: string;
  };
  /** `pence` e `null` când nu există istoric de plată de mediat — atunci `note` spune de ce. */
  averageWeeklyEarnings: { pence: number | null; note: string };
  /** Episodul anterior care se **leagă** de ăsta (la 8 săptămâni sau mai puțin). */
  linkedTo: {
    startDate: string;
    /** Un episod încă deschis se leagă de la ultima zi cunoscută, care e azi. */
    endDate: string;
    payableDaysUsed: number;
    waitingDaysServed: number;
  } | null;
};

/**
 * Răspunsul comun al scrierilor. ⚠️ `auditWarning` există fiindcă o scriere reușită cu un jurnal
 * de audit picat **nu** e o eroare pentru om, dar nu se ascunde.
 */
export type SicknessMutation = {
  success: true;
  absence: SicknessAbsence;
  auditWarning?: string | null;
  /** Prezent doar unde ruta îl trimite; forma lui aparține motorului de payroll. */
  calculation?: unknown;
  /** `POST /:id/end` pe un episod deja încheiat răspunde așa, nu cu o eroare. */
  alreadyEnded?: boolean;
};

/**
 * ─── CONCEDIUL DE FAMILIE ───────────────────────────────────────────────────
 * Citit din `backend/src/routes/familyLeave.ts` (`serialise` + răspunsurile rutei).
 * ⚠️ Separat de boală fiindcă **așa e și în bază**: plata e 90% cu două rate, se măsoară în
 * săptămâni, și se recuperează de la HMRC — trei lucruri pe care boala nu le are.
 */
export type FamilyLeaveSpell = {
  id: string;
  reference: number;
  cleanerId: string;
  cleanerName: string | null;
  type: string;
  label: string;
  startDate: string;
  endDate: string | null;
  status: string;
  weeksClaimed: number;
  weeksPaid: number;
  higherRateWeeks: number;
  standardRateWeeks: number;
  averageWeeklyEarningsPence: number | null;
  totalPence: number;
  total: number;
  recoveryPercent: number | null;
  recoveryPence: number | null;
  /** ⚠️ Recuperarea poate fi MAI MARE decât s-a plătit — nu e o eroare de calcul. */
  recoveryExceedsCost: boolean;
  companyTopUpPence: number | null;
  companyTopUpDecided: boolean;
  unpaidType: boolean;
  notes: string | null;
};

export type FamilyLeaveListResponse = {
  period: { from: string | null; to: string | null };
  spells: FamilyLeaveSpell[];
  totals: {
    spells: number;
    planned: number;
    active: number;
    weeksPaid: number;
    totalPence: number;
    recoveryPence: number;
    companyTopUpPence: number;
  };
  /**
   * Regulile publicate de server — un ecran nu le rescrie.
   *
   * ⚠️ ACHU-401 (felia 18) — era `Record<string, unknown>`, iar ecranul citea prin el patru
   * câmpuri: `note`, `higherRateTypes`, `unpaidTypes`, `higherRateWeeks`. Numite acum, fiindcă
   * două dintre ele decid **ce scrie pe ecran despre bani**: care tipuri au primele săptămâni la
   * 90% FĂRĂ plafon, și care nu au plată statutară deloc.
   */
  rules: {
    standardWeeklyCapPence: number;
    earningsPercent: number;
    higherRateWeeks: number;
    /** Tipurile ale căror prime săptămâni sunt 90% fără plafon. */
    higherRateTypes: string[];
    /** ⛔ Drept la TIMP, nu la bani — și nici nu se poate recupera nimic de la HMRC. */
    unpaidTypes: string[];
    paidWeeks: Record<string, number>;
    labels: Record<string, string>;
    lowerEarningsLimitWeeklyPence: number;
    recovery: { smallEmployerPercent: number; largeEmployerPercent: number; thresholdPence: number };
    /** ⚠️ Nu un boolean: CINE a citit pagina gov.uk, CÂND, și când a fost ea însăși actualizată. */
    verified: { on: string; by: string; pagePublished: string; pageUpdated: string };
    note: string;
  };
  /**
   * 🔴 Ce NU e verificat, spus de server. Ecranul îl afișează ca atare — o cifră neverificată
   * care arată ca una verificată e mai rea decât una lipsă.
   */
  unverified?: Record<string, { what: string; whyItMatters: string; howToSettle: string }>;
  recoveryNote: string;
  /**
   * ⚠️ Ce plătește firma peste minimul legal e o DECIZIE, nu un calcul. Gol = „nu s-a decis";
   * zero = „s-a decis că nimic". Cele două nu sunt același lucru.
   */
  companyTopUpNote: string;
};

/**
 * O grupă de săptămâni la ACEEAȘI rată. ⚠️ O previzualizare are **una sau două**: primele șase
 * săptămâni de maternitate/adopție sunt 90% din câștig **fără plafon**, restul sunt plafonate.
 *
 * 🔴 `capped` nu e decor: e diferența dintre *„194,32 £, fiindcă plafonul e sub 90% din câștig"*
 * și *„194,32 £, fiindcă chiar atât face 90%"* — aceeași cifră, două motive, iar omul care
 * întreabă „de ce atât?" are nevoie de al doilea, nu de primul.
 */
export type FamilyPayWeekBreakdown = {
  weeks: number;
  weeklyRatePence: number;
  totalPence: number;
  capped: boolean;
  /** Propoziția serverului pentru grupa asta. Se randează verbatim. */
  label: string;
};

/**
 * Previzualizarea, așa cum o compune `GET /family-leave/preview`.
 *
 * ⛔ Ruta **aruncă** pe ramura de eroare (`if ('error' in priced.result) throw`), deci ce ajunge
 * la ecran e întotdeauna calculul reușit — de aceea aici nu există niciun câmp de eroare.
 * ⚠️ Prima scriere a acestui tip a pus `breakdown` ca `Record<string, unknown>[]` „ca să nu
 * presupună"; ecranul citea deja `b.label`, `b.weeklyRatePence` și `b.totalPence`, iar
 * compilatorul a spus-o. **Prudența nu e o măsurătoare.**
 */
export type FamilyLeavePreview = {
  preview: {
    type: string;
    label: string;
    weeksClaimed: number;
    /** Săptămânile prețuite, după maximul legal. */
    weeksPaid: number;
    /** ⛔ Refuzate fiindcă trec de maxim. Raportate, niciodată ascunse. */
    weeksBeyondMaximum: number;
    averageWeeklyEarningsPence: number;
    /** Întâi săptămânile cu rată mare, apoi cele standard. Gol pentru un tip neplătit. */
    breakdown: FamilyPayWeekBreakdown[];
    totalPence: number;
    /** Ce dă HMRC înapoi, și la ce procent. `null` = nu se recuperează nimic. */
    recovery: { percent: number; amountPence: number; smallEmployer: boolean; note: string } | null;
    /** `true` când tipul ăsta de concediu nu are plată legală deloc. */
    unpaidType: boolean;
    warnings: string[];
    note: string;
  };
  /** ⚠️ Mereu prezent. `note` spune de ce câștigul mediu e cel care e — sau de ce lipsește. */
  earnings: { pence: number; note: string };
};

export type FamilyLeaveMutation = {
  success: true;
  spell: FamilyLeaveSpell;
  auditWarning?: string | null;
  calculation?: unknown;
  earnings?: unknown;
  alreadyEnded?: boolean;
};

/**
 * ─── CONCEDIUL DE ODIHNĂ ────────────────────────────────────────────────────
 * Citit din `backend/src/routes/leave.ts`.
 *
 * ⚠️ **Doar rândul și scrierile sunt tipate strict.** Restul răspunsului de listă (dreptul,
 * reportarea, ritmul, avertismentele) e produs de motorul de concedii și își schimbă forma odată cu
 * el — un tip scris din afară s-ar despărți tăcut de sursă. Rămâne `unknown`, adică „nu afirm ce e",
 * ceea ce e mai cinstit decât `any`, care înseamnă „orice, verifică-l nimeni".
 */
export type LeaveRequest = {
  id: string;
  reference: number;
  cleanerId: string;
  cleanerName: string | null;
  kind: string;
  startDate: string;
  endDate: string;
  minutes: number;
  hours: number;
  status: string;
  requestedBy: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  notes: string | null;
};

/* ─── Anul de concediu (ACHU-290/291) ────────────────────────────────────────
 *
 * 🔴 ACHU-401, felia 32 — jumătățile de mai jos erau `unknown` și `Record<string, unknown>`,
 * cu un comentariu care spunea doar *„ce licențiază cuvântul «entitlement» pe ecran"*.
 * ⛔ Adevărat, și exact motivul pentru care trebuiau scrise: sunt cifrele de **concediu**,
 * adică bani, iar ecranul le citea fără ca nimic să afirme ce sunt.
 *
 * ⚠️ **Toate perechile sunt același timp în două unități** — `...Minutes` e cifra stocată,
 * `...Hours` e aceeași, rotunjită la două zecimale pentru afișare. ⛔ Nu se adună între ele.
 */

/** Un an de concediu. ⚠️ Începe pe **6 aprilie** — decizia owner-ului, 31/07/2026. */
export type LeaveYear = {
  from: string;
  to: string;
  /** Anul calendaristic în care ÎNCEPE — un id stabil pentru un selector. */
  startYear: number;
  /** „6 April 2026 – 5 April 2027". Compusă de server. */
  label: string;
};

/** 5,6 săptămâni dintr-o săptămână contractată stabilă, când e consemnată una. */
export type FixedWeekEntitlement = {
  contractedHoursPerWeek: number;
  weeks: number;
  annualMinutes: number;
  annualHours: number;
};

export type LeaveEntitlementView = {
  /** `null` când fereastra e una **personalizată**, nu un an de concediu întreg. */
  leaveYear: LeaveYear | null;
  /** Ce metodă statutară reprezintă acumularea de pe ecran. */
  method: 'accrual-12.07' | 'accrual-12.07-but-contract-is-settled';
  /** ACHU-366 — verdictul e decis de tipul de CONTRACT, nu dedus din orele consemnate. */
  holidayMethod: HolidayMethodVerdict | null;
  accruedMinutes: number;
  accruedHours: number;
  fixedWeek: FixedWeekEntitlement | null;
  /**
   * ⛔ Cifra fixă **pro-ratată la azi**. Doar pentru comparație — **niciodată** o sumă de
   * plată. Numele o spune, fiindcă un total pe un ecran de concediu arată ca ceva de plătit.
   */
  fixedExpectedByNowMinutes: number | null;
  fixedExpectedByNowHours: number | null;
  /** Pozitiv când acumularea e **sub** ce ar fi dat o săptămână stabilă până acum. */
  shortfallMinutes: number | null;
  shortfallHours: number | null;
  /** `true` = anul s-a încheiat, deci acumularea e finală, nu în creștere. */
  yearComplete: boolean;
  note: string;
};

/**
 * ACHU-291 — **totul se reportează, nimic nu expiră** (owner, 31/07/2026).
 * ⚠️ `appliedToNextYear` e `true` LITERAL: nu există variantă în care nu s-ar aplica.
 */
export type LeaveCarryOverView = {
  leaveYear: LeaveYear;
  yearComplete: boolean;
  untakenMinutes: number;
  untakenHours: number;
  appliedToNextYear: true;
  note: string;
};

/**
 * Ce a venit din anii dinainte și e **deja înăuntrul** soldului.
 *
 * 🔴 **Cu semn, deliberat.** Negativ când cineva a luat concediu **înainte** să-l câștige —
 * ca orele alea să rămână numărate o dată, nu să fie date din nou în anul nou. ⛔ Nu se
 * „taie" nimic: orele fuseseră deja luate.
 */
export type LeaveCarriedIn = {
  minutes: number;
  hours: number;
  fromApprovedHoursBefore: number;
  takenBefore: number;
  /**
   * ⚠️ Nu o propoziție — **regula însăși**, publicată de server (`CARRY_OVER_POLICY`), cu
   * vorbele owner-ului lângă ea. ⛔ Prima scriere a tipului a pus `policy: string` și a picat:
   * dacă mâine apare un plafon sau o expirare, ecranul trebuie să vadă `expires`, nu un text.
   */
  policy: { carriesEverything: boolean; expires: boolean; ownerWords: string };
  note: string;
  /** ⚠️ Ce NU poate ști aplicația: pontajele încep în iulie 2026. */
  limitNote: string;
};

/** Regula 2 a owner-ului: concediul ar trebui luat în cursul anului. Asta o urmărește. */
export type LeaveTakingPace = {
  usedShare: number;
  unbookedMinutes: number;
  unbookedHours: number;
  status: 'on-track' | 'behind' | 'nothing-accrued' | 'year-over';
  note: string;
};

export type LeaveBalance = {
  /** 12,07% din orele APROBATE lucrate în fereastră. */
  accruedMinutes: number;
  carriedInMinutes: number;
  carriedInHours: number;
  /** ⚠️ Doar concediu APROBAT. Cerut și Refuzat sunt excluse. */
  takenMinutes: number;
  /** Aprobat dar neînceput — deja cheltuit, și ușor de uitat. */
  bookedMinutes: number;
  requestedMinutes: number;
  unpaidMinutes: number;
  remainingMinutes: number;
  accruedHours: number;
  takenHours: number;
  bookedHours: number;
  requestedHours: number;
  unpaidHours: number;
  remainingHours: number;
};

export type LeaveListResponse = {
  cleaner: { id: string; name: string; active: boolean };
  period: { from: string; to: string };
  requests: LeaveRequest[];
  /**
   * 🔴 Ce licențiază cuvântul „entitlement" pe ecran — vezi ACHU-290. `isLeaveYear` e fals
   * pentru o fereastră personalizată, iar atunci cuvântul **nu** se folosește.
   */
  leaveYear: {
    current: LeaveYear;
    /** Ultimii câțiva ani, pentru selector. */
    recent: LeaveYear[];
    isLeaveYear: boolean;
    startsOn: string;
    /** ⚠️ Spune că 6 aprilie e o **alegere**, nu ceva derivat din anul fiscal. */
    decidedNote: string;
  };
  entitlement: LeaveEntitlementView;
  /** `null` când fereastra nu e un an de concediu întreg. */
  carryOver: LeaveCarryOverView | null;
  carriedIn: LeaveCarriedIn;
  takingPace: LeaveTakingPace | null;
  statutory: { weeks: number; note: string };
  balance: LeaveBalance;
  accrual: { percent: number; fromApprovedHours: number; note: string };
  /**
   * 🔴 Cât VALOREAZĂ orele rămase — `null` când omul n-are tarif orar.
   *
   * ⛔ Nu e un extra decorativ: concediul neluat e o datorie a firmei, nu o economie, iar din
   * „14h rămase" nimeni nu citește asta. ⚠️ `null` și zero nu sunt același lucru — de aceea
   * există `rateNote`, care spune **de ce** lipsește cifra și unde se adaugă tariful.
   */
  value: { hourlyRate: number; remaining: number; note: string } | null;
  rateNote: string;
  kinds: string[];
  statuses: string[];
  /** ⚠️ Spune ce **este** soldul și, mai important, ce **NU** este. */
  caveat: string;
};

export type LeaveMutation = {
  success: true;
  request: LeaveRequest;
  auditWarning?: string | null;
  /** Aprobarea unei cereri deja aprobate răspunde așa, nu cu o eroare. */
  alreadyApproved?: boolean;
};

