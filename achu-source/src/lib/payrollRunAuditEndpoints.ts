/**
 * ACHU-401, felia a douăzeci și noua — CELE TREI PRIVIRI PESTE O RULARE, toate `GET` și toate
 * rămân `GET`: ce ar conține un FPS (ACHU-316), dacă NI-ul perioadei mai e corect (ACHU-371),
 * și ce plătea perioada înainte de corecție (ACHU-372).
 *
 * ⛔ **Fișier propriu, reexportat** — niciun apelant nu se schimbă. ⚠️ Felie STRUCTURALĂ;
 * payroll-ul rămâne oprit.
 *
 * 🔴 **CE AU ÎN COMUN CELE TREI, și de ce contează pentru tipuri: niciuna nu are un
 * corespondent care SCRIE.** Nu există un buton „trimite FPS-ul", nu există „aplică corecția
 * de NI", nu există „restaurează versiunea". Fiecare rută spune asta într-o propoziție pe care
 * ecranul o randează verbatim — ⛔ iar propoziția e parte din răspuns, nu decor: un ecran plin
 * de câmpuri FPS corecte e exact ce cineva ar confunda cu o declarație depusă.
 *
 * 🔴 **Toți banii de aici sunt în PENNY.** Spre deosebire de rulare, care trimite și lire —
 * astea trei sunt comparații și asamblări, iar rotunjirea la lire ar face două cifre egale
 * care nu sunt.
 */
import { apiGet } from './apiClient';

/* ─── Ce AR conține un FPS (ACHU-316) ──────────────────────────────────────── */

/** Banda de ore cerută de HMRC. Nu orele — banda. */
export type FpsHoursBand = 'A' | 'B' | 'C' | 'D' | 'E';

/** Un lucru care trebuie lămurit înainte ca asta să poată fi depusă vreodată. */
export type FpsBlocker = {
  /** Citibil de mașină, ca un ecran să poată grupa fără să analizeze propoziții. */
  field: string;
  /** Despre cine e — sau `null` când e despre angajator. */
  cleanerId: string | null;
  /** Ce lipsește și de ce îi trebuie lui HMRC. Scris pentru cineva care nu e funcționar de payroll. */
  message: string;
};

export type FpsEmployeePence = {
  taxablePay: number; niablePay: number; incomeTax: number;
  employeeNi: number; employerNi: number; employeePension: number;
  studentLoan: number; postgraduateLoan: number; netPay: number;
  grossToDate: number; taxToDate: number;
};

export type FpsEmployee = {
  cleanerId: string;
  name: string;
  /** 🔴 Cele patru de mai jos sunt chiar golurile pe care asamblarea le scoate la iveală. */
  niNumber: string | null;
  dateOfBirth: string | null;
  address: string | null;
  payrollId: string;
  starterDate: string | null;
  leaverDate: string | null;
  taxCode: string;
  niCategory: string;
  hoursBand: FpsHoursBand;
  studentLoanPlan: string | null;
  /** ⚠️ Aici e **boolean** — spre deosebire de linia rulării, unde suma poartă un underscore. */
  postgraduateLoan: boolean;
  pence: FpsEmployeePence;
};

export type FpsAssembly = {
  kind: 'FPS';
  /**
   * ⚠️ **Cele două referințe NU sunt interschimbabile**, deși seamănă destul cât să fie
   * confundate: `payeReference` (`123/AB456`) identifică schema PAYE, `accountsOfficeReference`
   * (`123PA00012345`) e pentru plăți. ⛔ O depunere sub cea greșită nu e o depunere.
   */
  employer: {
    payeReference: string | null;
    accountsOfficeReference: string | null;
    /** Numele de pe schema PAYE, care nu trebuie să fie numele comercial. */
    employerName: string | null;
  };
  taxYear: string;
  /** Perioada HMRC pentru DATA PLĂȚII — săptămâni la plată săptămânală, luni la cea lunară. */
  taxWeek: number | null;
  taxMonth: number | null;
  payDate: string;
  employees: FpsEmployee[];
  totals: {
    taxablePayPence: number; incomeTaxPence: number;
    employeeNiPence: number; employerNiPence: number;
    studentLoanPence: number; postgraduateLoanPence: number;
  };
  /** ⛔ Numite **pe persoană**, nu aruncate în tăcere. Ăsta e rostul asamblării. */
  blocking: FpsBlocker[];
  /** ⚠️ `true` doar când `blocking` e gol. **Nu** spune că are voie să fie trimis. */
  complete: boolean;
};

export type PayrollRunRtiResponse = {
  fps: FpsAssembly;
  /**
   * 🔴 `allowed` e **întotdeauna `false`** azi, și nu e un `boolean` din care se derivă un
   * buton: e o propoziție. Prima depunere face ACHU un declarant activ, cu termene statutare
   * la fiecare plată — ⛔ decizia owner-ului, nu un comutator în cod.
   */
  submission: { allowed: false; reason: string };
  /** Se randează verbatim: *ce s-ar trimite*, nu *ce s-a trimis*. */
  notice: string;
};

export function getPayrollRunRti(id: string) {
  return apiGet<PayrollRunRtiResponse>(`/payroll-runs/${id}/rti`);
}

/* ─── Mai e corect NI-ul perioadei? (ACHU-371) ─────────────────────────────── */

export type NiFigures = { employeePence: number; employerPence: number };

export type NiDirection = 'unchanged' | 'under-deducted' | 'over-deducted' | 'mixed';

export type NiDifference = {
  /** Pozitiv = s-a luat **prea puțin** de la angajat, deci se mai datorează. */
  employeeDeltaPence: number;
  employerDeltaPence: number;
  direction: NiDirection;
  /**
   * 🔴 Ținut **separat** de întrebarea recuperării, fiindcă datoria firmei către HMRC **nu**
   * depinde de dacă își recuperează vreodată partea angajatului. ⛔ Un singur număr pentru
   * amândouă e felul în care o lipsă nerecuperabilă dintr-un salariu încetează tăcut să mai
   * fie plătită și către HMRC.
   */
  owedToHmrcPence: number;
};

export type NiEmployeeRecovery =
  | 'nothing-to-recover'
  | 'allowed-within-this-tax-year'
  | 'not-recoverable-through-payroll'
  | 'refund-owed-to-employee';

export type NiRecoveryRoute = {
  /** Ce datorează ACHU lui HMRC (pozitiv) sau i se datorează. **Necondiționat.** */
  hmrcPence: number;
  employeeRecovery: NiEmployeeRecovery;
  /** Cât se poate adăuga cel mult pe o singură plată, când recuperarea e permisă. */
  maxPerPaymentPence: number | null;
  /** Câte plăți ar trebui la plafonul ăla. `null` = „nu prin payroll, oricâte ar fi". */
  paymentsNeeded: number | null;
  /** Ce să i se spună biroului, **în ordine**. Cel puțin o propoziție, mereu. */
  sentences: string[];
  /** ⛔ Obligații pe care aplicația **nu** le poate stinge — ca să nu treacă drept făcute. */
  obligations: string[];
};

/** Ce e adevărat despre orice persoană din panou, reverificată sau nu. */
type NiPersonBase = {
  cleanerId: string;
  name: string;
  /** Litera FOLOSITĂ atunci, înghețată pe linie. */
  categoryAtTheTime: string;
  /** Litera de pe fișa lui AZI. `null` când fișa nu mai există. */
  categoryNow: string | null;
  niablePayPence: number;
  paid: NiFigures;
};

/**
 * 🔴 **UNIUNE pe `rechecked`**, nu câmpuri opționale: unii oameni **nu se pot** reverifica —
 * un director (NI-ul lui se corectează singur în cursul anului) sau o categorie pe care
 * motorul nu o mai susține. ⛔ Un ecran care citește `difference` fără să verifice întâi ar
 * afișa o diferență de zero acolo unde adevărul e *„nu s-a putut compara"*.
 */
export type NiNotRecheckedPerson = NiPersonBase & {
  rechecked: false;
  reason: 'director' | 'category-unsupported';
  sentence: string;
};

export type NiRecheckedPerson = NiPersonBase & {
  rechecked: true;
  correct: NiFigures;
  difference: NiDifference;
  /** ⚠️ Litera s-a schimbat de atunci — și asta **nu** e o coincidență, e cineva care a corectat fișa. */
  categoryChanged: boolean;
  route: NiRecoveryRoute;
};

export type NiCorrectionPerson = NiNotRecheckedPerson | NiRecheckedPerson;

/**
 * ⛔ **Predicatele de îngustare stau în ECRAN, nu aici** — deși ar părea că le e locul lângă
 * tipuri. `AGENT_RULES` §10: un mock **parțial** al lui `@/lib/endpoints` nu lasă o funcție
 * lipsă „nemockată", o face `undefined`, care aruncă în randare și duce tot arborele cu ea.
 * ⚠️ Un tip se șterge la compilare și nu poate fi mockuit greșit; o **funcție** exportată de
 * aici obligă fiecare fișier de test care mockuiește catalogul să știe de ea. Măsurat, nu
 * presupus: opt teste au picut exact așa.
 */

/** Ce se poate face cu o diferență depinde de **cât de angajată** e rularea. */
export type NiCorrectionStance = 'no-commitment-yet' | 'agreed-not-paid' | 'paid';

export type PayrollRunNiCorrectionResponse = {
  taxYear: string;
  /** ⚠️ Ce e permis prin payroll se schimbă la 5 aprilie. */
  withinSameTaxYear: boolean;
  stance: NiCorrectionStance;
  stanceSentence: string;
  people: NiCorrectionPerson[];
  changedCount: number;
  totalOwedToHmrcPence: number;
  /**
   * ⚠️ **Amândouă propozițiile vin la fiecare răspuns**, inclusiv cel în care nu diferă nimic.
   * *„NI nu e impozit"* e chiar neînțelegerea care aduce pe cineva în panoul ăsta, iar
   * *„nimic nu s-a schimbat"* e propoziția pe care un ecran plin de cifre e cel mai probabil
   * să fie citit drept contrariul ei.
   */
  notice: string;
  niIsNotTax: string;
};

export function getPayrollRunNiCorrection(id: string) {
  return apiGet<PayrollRunNiCorrectionResponse>(`/payroll-runs/${id}/ni-correction`);
}

/* ─── Ce plătea perioada înainte de corecție (ACHU-372) ────────────────────── */

/** Cifrele unei persoane într-o versiune. Toate în PENNY. */
export type VersionFigures = {
  cleanerId: string;
  name: string;
  taxCode: string;
  niCategory: string;
  hoursWorked: number | null;
  grossPence: number;
  incomeTaxPence: number;
  employeeNiPence: number;
  employerNiPence: number;
  employeePensionPence: number;
  employerPensionPence: number;
  studentLoanPence: number;
  postgraduateLoanPence: number;
  netPayPence: number;
  grossToDatePence: number;
  taxToDatePence: number;
};

/**
 * ⚠️ **`removed` e cel mai important, și de-aia nu e un boolean.** Cineva care a fost PLĂTIT
 * și nu mai e pe rulare a scos bani reali din firmă, fără nimic în evidența curentă care să-i
 * justifice. ⛔ O comparație care ar parcurge doar liniile de azi nu l-ar pomeni deloc — exact
 * felul în care banii devin invizibili.
 */
export type PersonPresence = 'unchanged' | 'changed' | 'added' | 'removed';

/** O coloană de bani care s-a mișcat, în penny întregi. */
export type FigureChange = {
  /** Cuvintele pentru om — „Net pay", „Employee NI". Compuse pe server. */
  label: string;
  beforePence: number;
  afterPence: number;
  /** `after − before`. Negativ = rularea de azi spune MAI PUȚIN decât versiunea. */
  deltaPence: number;
};

export type VersionPerson = {
  cleanerId: string;
  name: string;
  presence: PersonPresence;
  /** `null` când `presence` e `added` — nu exista în versiune. */
  before: VersionFigures | null;
  /** `null` când `presence` e `removed` — nu e pe rulare acum. */
  after: VersionFigures | null;
  /** Gol dacă `presence` nu e `changed`. */
  changes: FigureChange[];
  /** Pus când codul fiscal diferă — el explică majoritatea diferențelor de impozit. */
  taxCodeChange: { before: string; after: string } | null;
  niCategoryChange: { before: string; after: string } | null;
  /**
   * 🔴 Pus **doar** pentru cineva care e în versiune și nu e pe rulare. E singurul rezultat
   * care nu se poate citi dintr-un tabel de cifre — fiindcă omul lipsește chiar din lista
   * care se citește.
   */
  removedSentence: string | null;
};

export type VersionTotals = {
  peopleBefore: number;
  peopleAfter: number;
  netPayBeforePence: number;
  netPayAfterPence: number;
  netPayDeltaPence: number;
  /** Netul celor scoși de pe rulare. ⚠️ Separat: o cifră **schimbată** și una **dispărută** cer acțiuni diferite. */
  removedNetPayPence: number;
  changedPeople: number;
  addedPeople: number;
  removedPeople: number;
};

export type PayrollRunVersion = {
  version: number;
  statusWhenSuperseded: string;
  /**
   * 🔴 **Decis de server din starea de ATUNCI**, nu de ecran. Răspunsul nu spune niciodată
   * „plătit" despre o versiune doar aprobată: `Approved` înseamnă *„agreat, verifică banca"*,
   * iar `Locked` afirmă o plată.
   */
  wasPaid: boolean;
  stanceSentence: string;
  approvedBy: string | null;
  approvedAt: string | null;
  lockedBy: string | null;
  lockedAt: string | null;
  supersededBy: string | null;
  supersededAt: string;
  reason: string | null;
  totals: VersionTotals;
  /** ⚠️ TOȚI, inclusiv cei neschimbați. Panoul filtrează pentru afișare; evidența nu. */
  people: VersionPerson[];
  /** Propoziția serverului când versiunea nu diferă de rularea de azi. `null` când diferă. */
  nothingDiffers: string | null;
};

export type PayrollRunVersionsResponse = {
  runId: string;
  currentVersion: number;
  /** ⛔ Nu schimbă nimic — spus verbatim, fiindcă panoul arată ca un buton de restaurare. */
  notice: string;
  /**
   * 🔴 Versiuni pentru care **nu există** instantaneu: o rulare redeschisă înainte ca felia
   * asta să existe are un număr de versiune peste 1 și nicio fotografie a lui. ⚠️ Spus, fiindcă
   * *„fără istoric"* și *„neconsemnat"* sunt răspunsuri diferite, și doar unul e liniștitor.
   */
  unrecordedVersions: number[];
  /** ⚠️ Gol pentru o rulare pe care nimeni n-a redeschis-o — cazul **normal**, nu o lipsă. */
  versions: PayrollRunVersion[];
};

export function getPayrollRunVersions(id: string) {
  return apiGet<PayrollRunVersionsResponse>(`/payroll-runs/${id}/versions`);
}

