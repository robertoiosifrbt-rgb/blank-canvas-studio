/**
 * ACHU-401, felia a treizeci și patra — **RAPOARTELE DE PAYROLL**: costul anului (ACHU-338/343),
 * absențele anului (ACHU-339/340) și programul de contribuții la pensie (ACHU-384/345).
 *
 * ⛔ **Fișier propriu, reexportat** — niciun apelant nu se schimbă. ⚠️ Felie STRUCTURALĂ;
 * payroll-ul rămâne oprit.
 *
 * 🔴 **Ce au în comun toate trei, și de ce tipurile o spun de fiecare dată: niciunul nu e un
 * document.** Raportul de cost exclude ciornele, programul de pensie **nu se trimite nicăieri**,
 * iar suma recuperabilă de la HMRC **nu e scăzută** din nimic — fiindcă cererea se face printr-un
 * EPS pe care aplicația nu-l trimite. ⚠️ De aceea fiecare `*Notice` de aici e **obligatoriu**, nu
 * opțional: sunt propozițiile care opresc citirea unei cifre drept altceva decât e.
 *
 * ⚠️ **BANII SOSESC ÎN LIRE**, deja împărțiți la 100 pe server (`p()`) — spre deosebire de o
 * rulare, care trimite și penny. ⛔ Excepția e programul de pensie, care e **numai în penny**:
 * e un fișier pentru un furnizor, iar acolo unitatea e cea pe care o cere el.
 */
import { apiGet } from './apiClient';
// ⚠️ `apiDownload` (GET) nu mai e folosit aici: ambele exporturi de payroll au trecut pe POST — ACHU-779.
import { apiDownloadPost } from './apiClient';

/* ─── Costul anului (ACHU-338) ─────────────────────────────────────────────── */

/**
 * Totalurile, în LIRE.
 *
 * 🔴 **Două lucruri pe care numele nu le spun singure.** `studentLoan` e **SUMA** celor două
 * împrumuturi (de studii și postuniversitar) — serverul le adună aici, deși le ține separate
 * peste tot altundeva. Iar `onTopOfWage` **nu vine din baza de date**: e diferența calculată pe
 * rută, ⛔ cifra pe care patronii o subestimează.
 */
export type PayrollReportTotals = {
  /** ⚠️ Oameni DISTINCȚI, nu rânduri. Zece plăți lunare pentru unul singur e **un** om. */
  people: number;
  payments: number;
  hours: number;
  gross: number;
  incomeTax: number;
  employeeNi: number;
  pension: number;
  /** ⛔ Cele două împrumuturi ADUNATE — pe rută, nu în bază. */
  studentLoan: number;
  netPay: number;
  employerNi: number;
  employerPension: number;
  totalEmployerCost: number;
  /** Cât costă omul **peste** salariul lui. */
  onTopOfWage: number;
};

/** O grupă (departament sau centru de cost), cu aceleași totaluri ca întregul. */
export type PayrollCostGroup = {
  label: string;
  /** `false` = grupa „nealocat" — oamenii fără etichetă, arătați, nu ascunși. */
  assigned: boolean;
  people: number;
  payments: number;
  totals: PayrollReportTotals;
  onTopOfWage: number;
  shareOfCostPercent: number;
  /**
   * ⚠️ Câți dintre ei au primit eticheta din fișa lor de **AZI**, nu de pe rândul de rulare.
   * ⛔ O reîncadrare de acum rescrie retroactiv gruparea unei plăți vechi — de aceea se numără.
   */
  attributedFromProfile: number;
};

/**
 * Aceeași factură salarială împărțită în două feluri — plus **dovada** că fiecare împărțire o
 * conține în întregime.
 *
 * 🔴 `accountsForEverything` e **afirmat, nu presupus**: o grupare care a pierdut rânduri
 * produce un tabel care arată corect și e mai mic cu exact cât a scăpat. Un ecran care primește
 * `false` aici trebuie s-o **spună**, nu să tipărească cifrele.
 */
export type PayrollCostSplit = {
  groups: PayrollCostGroup[];
  accountsForEverything: boolean;
  attributedFromProfile: number;
  notice: string;
};

/** O linie de jurnal contabil. ⛔ Nume de cont, **nu** coduri nominale — vezi `nominalCodesNotice`. */
export type PayrollJournalLine = {
  account: string;
  debit: number;
  credit: number;
  note: string;
};

export type PayrollReportResponse = {
  taxYear: string;
  totals: PayrollReportTotals;
  periods: Array<{ periodNumber: number; payDate: string; totals: PayrollReportTotals }>;
  people: Array<{
    cleanerId: string; name: string; periods: number;
    totals: PayrollReportTotals; onTopOfWage: number;
  }>;
  departments: PayrollCostSplit;
  costCentres: PayrollCostSplit;
  /**
   * ⚠️ Spus o dată, pe server: **nicio etichetă nu schimbă vreo cifră de plată** — nici impozit,
   * nici NI, nici salariu minim, nici pensie. Cine vede un cost împărțit pe departamente se va
   * întreba pe bună dreptate dacă mutarea cuiva îi schimbă plata. Nu i-o schimbă.
   */
  groupingNotice: string;
  journal: PayrollJournalLine[];
  /** ⛔ **Dovedit, nu presupus** — un jurnal dezechilibrat se importă curat și e greșit. */
  journalBalanced: boolean;
  /** Numit, nu ascuns: un raport care omite tăcut ciornele arată ca un an întreg. */
  excludedDraftRuns: number;
  notice: string | null;
  /**
   * ⛔ Codurile nominale lipsesc **deliberat**: sunt planul de conturi al firmei, iar inventarea
   * lor produce un export care se importă curat **în conturile greșite** — mai rău decât unul
   * care nu se importă deloc.
   */
  nominalCodesNotice: string;
};

export function getPayrollReport(taxYear: string) {
  return apiGet<PayrollReportResponse>('/payroll-runs/reports/summary', { taxYear });
}

/* ─── Absențele anului (ACHU-339/340) ──────────────────────────────────────── */

export type HolidayReportPerson = {
  cleanerId: string;
  name: string;
  active: boolean;
  carriedInHours: number;
  accruedHours: number;
  takenHours: number;
  bookedHours: number;
  requestedHours: number;
  unpaidHours: number;
  remainingHours: number;
  /**
   * ⛔ `null`, **niciodată `0`**, când omul n-are tarif orar. Zero ar afirma că soldul lui nu
   * valorează nimic; `null` spune că nimeni n-a consemnat un tarif.
   */
  valueIfPaidOut: number | null;
};

export type SicknessReportPerson = {
  cleanerId: string;
  name: string;
  spells: number;
  openSpells: number;
  /** ⚠️ Doar episoadele ÎNCHEIATE — unul deschis n-are lungime până nu se termină. */
  daysAbsentEnded: number;
  sspDaysPaid: number;
  ssp: number;
  companySickPay: number;
  /** Câte episoade așteaptă o **decizie** de plată suplimentară. ⛔ Altceva decât „zero". */
  companySickPayUndecided: number;
  crossesYearEnd: number;
};

export type FamilyLeaveReportPerson = {
  cleanerId: string;
  name: string;
  /**
   * ⛔ **NUMELE tipurilor de concediu, nu câte sunt.** Prima scriere a tipului ăstuia a pus
   * `number`, fiindcă stă lângă `spells`/`plannedSpells`/`activeSpells`, care chiar sunt
   * numărători. ⚠️ A picat la compilare pe cardul care le desenează — care le știa deja
   * `string[]`, în copia lui locală. **Vecinătatea nu e o măsurătoare.**
   */
  types: string[];
  spells: number;
  plannedSpells: number;
  activeSpells: number;
  /** ⚠️ În SĂPTĂMÂNI — unitatea legii și a motorului. Zilele ar inventa precizie. */
  weeksClaimed: number;
  weeksPaid: number;
  statutory: number;
  companyTopUp: number;
  companyTopUpUndecided: number;
  /** Legal plus suplimentul firmei. ⛔ Recuperarea **NU** e scăzută — vezi `recoveryNotice`. */
  paidOut: number;
  reclaimable: number;
  /** Episoade fără cifră de recuperare, deci `reclaimable` e mai **mic** decât realitatea. */
  recoveryUnknown: number;
  crossesYearEnd: number;
};

export type AbsenceReportResponse = {
  taxYear: string;
  /** ⚠️ Anul de CONCEDIU, care nu e anul fiscal — începe când a decis owner-ul. */
  leaveYear: { label: string; from: string; to: string };
  /** La ce dată s-a luat împărțirea concediului. */
  asAt: string;
  holiday: {
    people: HolidayReportPerson[];
    totals: {
      people: number; carriedInHours: number; accruedHours: number; takenHours: number;
      bookedHours: number; requestedHours: number; unpaidHours: number; remainingHours: number;
      remainingValue: number;
      /** ⛔ Datoria de mai sus e mai mică cu atâția oameni. O cifră care omite tăcut pe cineva e cea pe care se face un buget. */
      peopleWithoutRate: number;
      peopleOverTaken: number;
    };
    valueNotice: string;
    leaveYearNotice: string;
    /** `null` când nu lipsește niciun tarif — ⛔ nu un text gol de randat. */
    rateNotice: string | null;
    overTakenNotice: string | null;
  };
  sickness: {
    people: SicknessReportPerson[];
    totals: {
      people: number; spells: number; openSpells: number; daysAbsentEnded: number;
      sspDaysPaid: number; ssp: number; companySickPay: number;
      companySickPayUndecided: number; crossesYearEnd: number;
    };
    moneyNotice: string;
    yearNotice: string;
    openNotice: string | null;
  };
  family: {
    people: FamilyLeaveReportPerson[];
    totals: {
      people: number; types: string[]; spells: number; plannedSpells: number; activeSpells: number;
      weeksClaimed: number; weeksPaid: number; statutory: number; companyTopUp: number;
      companyTopUpUndecided: number; paidOut: number; reclaimable: number;
      recoveryUnknown: number; crossesYearEnd: number;
    };
    /**
     * 🔴 **Singura cifră de pe tot raportul care putea induce în eroare despre bani.** Nu există
     * nicăieri un „cost net", deliberat: cei 109% se cer printr-un EPS pe care aplicația **nu-l
     * trimite**, iar scăderea lui ar afirma că jumătatea grea a treburilor e făcută.
     */
    recoveryNotice: string;
    plannedNotice: string;
    yearNotice: string;
    recoveryUnknownNotice: string | null;
  };
};

export function getAbsenceReport(taxYear: string) {
  return apiGet<AbsenceReportResponse>('/payroll-runs/reports/absence', { taxYear });
}

/**
 * Descarcă CSV-ul cu antetul de autentificare, păstrând numele ales de server.
 *
 * 🔴 **`POST`, nu `GET` — ACHU-779 (24/08/2026).** Fișierele sunt oameni și salarii, jurnalul
 * contabil, concediile și zilele de boală; iar un cont „doar citire" poate face **orice GET** al
 * Adminului (`middleware/authorise.ts`). ⚠️ **Metoda e poarta**, ca la exportul creanțelor și cel de
 * vizite. ⛔ Nu s-a schimbat nimic despre CE conține fișierul.
 */
export function downloadPayrollExport(
  taxYear: string,
  kind: 'people' | 'journal' | 'holiday' | 'sickness' | 'family' | 'departments' | 'cost-centres',
) {
  return apiDownloadPost(`/payroll-runs/reports/export?${new URLSearchParams({ taxYear, kind }).toString()}`, {}, `ACHU-payroll-${kind}.csv`);
}

/* ─── Programul de contribuții la pensie (ACHU-384/345) ────────────────────── */

/**
 * O linie de program — un om, o perioadă.
 *
 * ⛔ **Numai în PENNY**, singura formă de aici: e un fișier pe care îl citește un furnizor de
 * pensii, iar unitatea e cea pe care o cere el.
 */
export type PensionScheduleRow = {
  cleanerId: string;
  name: string;
  taxYear: string;
  frequency: string;
  periodNumber: number;
  /** Ziua în care banii au ajuns la oameni — după ea datează furnizorul contribuția. */
  payDate: string;
  /**
   * 🔴 **`number`, nu `number | null`, și asta se poate DOVEDI, nu presupune.** Pe linia stocată
   * câmpul chiar e nullable — `null` = rularea e dinainte de ACHU-384 și baza n-a fost consemnată
   * (⛔ **nu** zero: zero e o bază reală, a cuiva sub pragul de jos). Dar `buildSchedule` mută
   * fiecare astfel de linie în `excluded` **înainte** să compună un rând, deci un rând de aici
   * are întotdeauna o bază.
   *
   * ⚠️ Contează pentru ecran: cardul îl împarte la 100, iar `null / 100` e **`0`** în JavaScript
   * — adică ar tipări „0,00 £" acolo unde adevărul e *„nu știm"*. Garanția e ce împiedică asta.
   */
  pensionableEarningsPence: number;
  employeePensionPence: number;
  employerPensionPence: number;
  employeePercent: number | null;
  employerPercent: number | null;
  /** Angajat + angajator — chiar suma pe care furnizorul o ia prin debit direct. */
  totalPence: number;
};

/**
 * ⚠️ Un om e **EXCLUS cu un motiv**, nu arătat cu o bază goală. Motivul călătorește cu numele
 * fiindcă *„de ce lipsește Maria?"* e singura întrebare care urmează, iar un program se verifică
 * împotriva unei încasări bancare.
 */
export type PensionScheduleExclusion = {
  cleanerId: string;
  name: string;
  taxYear: string;
  periodNumber: number;
  reason: string;
};

export type PensionScheduleResponse = {
  taxYear: string;
  rows: PensionScheduleRow[];
  excluded: PensionScheduleExclusion[];
  totals: {
    /** Oameni DISTINCȚI, nu rânduri. */
    people: number;
    employeePence: number;
    employerPence: number;
    totalPence: number;
    pensionableEarningsPence: number;
  };
  /** ⛔ Spus cu voce tare, fiindcă un fișier de contribuții **arată** exact ca o depunere. */
  notice: string;
  /** ACHU-345 — ACHU n-are furnizor de pensii, deci n-are unde trimite. Forma e oricum bună. */
  providerNotice: string;
  /** ⚠️ Întors **și când e zero**: *„câte perioade au fost lăsate afară"* nu e un detaliu de cerut. */
  draftRunsExcluded: number;
};

export function getPensionSchedule(taxYear: string) {
  return apiGet<PensionScheduleResponse>('/payroll-runs/pension-schedule/summary', { taxYear });
}

export function downloadPensionSchedule(taxYear: string) {
  // 🔴 ACHU-779, al doilea loc: POST, ca cel de mai sus. Fișierul poartă nume de oameni și contribuții.
  return apiDownloadPost(`/payroll-runs/pension-schedule/export?${new URLSearchParams({ taxYear }).toString()}`, {},
    `ACHU-pension-contributions-${taxYear.replace('/', '-')}.csv`);
}

