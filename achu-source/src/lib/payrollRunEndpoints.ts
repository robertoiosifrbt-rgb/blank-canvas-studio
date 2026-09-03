/**
 * ACHU-401, felia a douăzeci și opta — RULAREA DE PAYROLL: ce a decis biroul să plătească
 * (ACHU-294), plus cele cinci butoane care o mișcă.
 *
 * ⛔ **Fișier propriu, reexportat** — niciun apelant nu se schimbă. ⚠️ Felie STRUCTURALĂ pe
 * ecrane de payroll; se semnalează ca informare. Payroll-ul rămâne oprit.
 *
 * 🔴 **Se scrie cap-coadă, deși fișierul de rută are 3254 de rânduri** — și asta a fost
 * presupunerea greșită care a ținut zona `any` trei felii. **Măsurat, nu presupus:** ruta are
 * `serialiseRun` și `serialiseLine`, două funcții care numesc câmp cu câmp ce pleacă, și
 * **zero** împrăștieri de rând Prisma. Mărimea unui fișier nu spune nimic despre forma
 * răspunsului lui.
 *
 * ⚠️ **BANII SOSESC DE DOUĂ ORI, în două unități, în ACELAȘI obiect.** Fiecare rând poartă
 * sumele în **lire** la nivelul de sus **și** în **penny** sub `pence`, deliberat: aritmetica
 * s-a făcut în penny, iar ecranul desenează lire fără să convertească. ⛔ `line.gross` și
 * `line.pence.gross` sunt același ban — nu se adună.
 */
import { apiGet, apiPost, apiDelete } from './apiClient';

/** ⚠️ De la server (`PAYROLL_RUN_STATUSES`), nu scrise în ecran. */
export type PayrollRunStatus = 'Draft' | 'Approved' | 'Locked';
export type PayrollFrequency = 'weekly' | 'fortnightly' | 'four-weekly' | 'monthly';

/** Un câștig suplimentar înghețat pe linie. ⚠️ `label` e SNAPSHOT, nu eticheta de azi. */
export type RunLineEarning = {
  id: string; type: string; label: string; amount: number; note: string | null;
};

/**
 * 🔴 **AUTORITATEA călătorește cu suma**, nu doar eticheta. *„50 £ cotizație"* pe un fluturaș
 * e jumătate din evidență — jumătatea despre care întreabă un tribunal e **ce a permis-o**, și
 * a fost înghețată atunci.
 */
export type RunLineDeduction = {
  id: string; type: string; label: string; amount: number; authority: string; note: string | null;
};

/** O linie așa cum o numește motorul de calcul (`PayrollLine`, pe server). */
export type PayrollEngineLine = { label: string; amountPence: number; note?: string };

/** Aceleași sume, în penny. Aritmetica s-a făcut aici. */
export type RunLinePence = {
  gross: number; taxablePay: number; niablePay: number; incomeTax: number;
  employeeNi: number; employeePension: number; studentLoan: number; postgraduateLoan: number;
  netPay: number; employerNi: number; employerPension: number; totalEmployerCost: number;
};

/** O linie de rulare — o persoană, o perioadă. `serialiseLine`, câmp cu câmp. */
export type PayrollRunLine = {
  id: string;
  cleanerId: string;
  /** ⚠️ Numele AȘA CUM ERA. O redenumire nu rescrie o plată deja făcută. */
  name: string;
  taxCode: string;
  niCategory: string;
  studentLoanPlan: string | null;
  /**
   * 🔴 **BOOLEAN — dacă persoana e pe un plan postuniversitar.** ⛔ Suma cu același nume e
   * `postgraduateLoan_`, **cu underscore**, mai jos. Numele s-au ciocnit și al doilea a primit
   * un underscore; un ecran care citește `postgraduateLoan` așteptând bani primește `true`.
   */
  postgraduateLoan: boolean;
  hoursWorked: number | null;
  /**
   * ACHU-321. ⚠️ `null` pentru rulări dinainte ca defalcarea să existe, iar `null` înseamnă
   * **„neconsemnat"**, NU zero. Un ecran arată atunci doar brutul, nu „salariu de bază: 0".
   */
  basicPay: number | null;
  /**
   * ACHU-338. ⚠️ `null` rămâne `null`: o rulare dinainte ca asta să se măsoare nu are voie să
   * tipărească un sold de **zero**, care e o cifră reală și îngrijorătoare.
   */
  holidayRemainingHours: number | null;
  earnings: RunLineEarning[];
  postTaxDeductions: RunLineDeduction[];
  /* ─ Aceleași sume în LIRE, pentru desenat ─ */
  gross: number;
  incomeTax: number;
  nationalInsurance: number;
  pension: number;
  studentLoan: number;
  /** 🔴 SUMA, în lire. Underscore-ul e singurul lucru care o desparte de booleanul de sus. */
  postgraduateLoan_: number;
  netPay: number;
  employerNi: number;
  employerPension: number;
  totalEmployerCost: number;
  grossToDate: number;
  taxToDate: number;
  warnings: string[];
  /**
   * Ce a scăzut din net și ce a costat pe angajator, **linie cu linie, în cuvintele
   * motorului** — `PayrollLine` din `payrollPolicy.ts`.
   *
   * ⚠️ Sosesc dintr-o coloană `String?` cu JSON înăuntru, parsată cu `[]` ca rezervă. Deci
   * lista poate fi **goală** pentru un rând vechi; ⛔ dar nu e opacă — forma e deja publicată
   * pe frontend, în `payslipPdf.ts`, iar dialogul rulării le trimite **direct** acolo.
   *
   * 📜 Prima versiune a tipului ăstuia le-a scris `unknown[]`, „ca să nu presupun". Era o
   * presupunere la fel de mare, în cealaltă direcție — și a picat la compilare exact pe
   * apelul care le pasează fluturașului. **Prudența nu e o măsurătoare.**
   */
  deductionLines: PayrollEngineLine[];
  employerLines: PayrollEngineLine[];
  pence: RunLinePence;
  /** ACHU-382. `null` când persoana nu mai are fișă — nu se inventează un număr. */
  employeeNumber: string | null;
};

/** O rulare, fără linii. `serialiseRun`. */
export type PayrollRun = {
  id: string;
  /** Numărul citit de om, nu `id`-ul. */
  reference: number;
  taxYear: string;
  frequency: string;
  periodNumber: number;
  payDate: string;
  periodStart: string;
  periodEnd: string;
  /**
   * ACHU-315 — dacă perioada asta **este** săptămâna de lucru luni–duminică plătită vinerea
   * următoare. ⚠️ Recitit din DATELE stocate, nu dintr-un indicator pe rând: datele sunt
   * faptul, iar o coloană s-ar învechi față de ele după o recalculare.
   */
  followsPayCalendar: boolean;
  status: string;
  /** ⚠️ Crește la fiecare recalculare. ACHU-383 — se trimite la toate cele cinci acțiuni. */
  version: number;
  approvedBy: string | null;
  approvedAt: string | null;
  lockedBy: string | null;
  lockedAt: string | null;
  reopenedBy: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
};

/** Ce se angajează biroul, într-o singură cifră de fiecare. Toate în LIRE. */
export type PayrollRunTotals = {
  people: number;
  gross: number;
  incomeTax: number;
  employeeNi: number;
  netPay: number;
  employerNi: number;
  /** 🔴 Ce **pleacă din firmă**, nu ce ajunge în conturi. Cifra pe care owner-ii o subestimează. */
  totalEmployerCost: number;
};

/** Calendarul de plată al ACHU (ACHU-315), ca dialogul să OFERE vinerea, nu s-o tastezi. */
export type PayCalendar = {
  frequency: string;
  workWeek: string;
  payDay: string;
  /** Zilele dintre închiderea săptămânii și data plății. ⚠️ Nu sunt joc — sunt fereastra de aprobare. */
  lagDays: number;
  suggested: {
    payDate: string; workWeekStart: string; workWeekEnd: string; taxWeek: number; taxYear: string;
  };
  describe: string;
  why: string;
};

export type PayrollRunsResponse = {
  runs: Array<PayrollRun & { totals: PayrollRunTotals }>;
  statuses: readonly PayrollRunStatus[];
  frequencies: string[];
  payCalendar: PayCalendar;
  /** ⛔ ETAPA 1 — se randează verbatim. Nimic nu pleacă spre HMRC, și ecranul trebuie s-o spună. */
  stageNotice: string;
};

export function getPayrollRuns() {
  return apiGet<PayrollRunsResponse>('/payroll-runs');
}

export function createPayrollRun(data: {
  frequency: PayrollFrequency;
  /** ⚠️ Ziua în care banii ajung la oameni. **De aici** se aleg anul fiscal și perioada. */
  payDate: string;
  /**
   * ⛔ Suprascriere, rar folosită: în mod normal perioada se deduce din data plății, fiindcă un
   * număr tastat de mână e la o apăsare distanță de a plăti martie în mai, și nimic din aval
   * n-ar observa.
   */
  periodNumber?: number;
  notes?: string | null;
}) {
  return apiPost<PayrollRunMutation & {
    totals: PayrollRunTotals;
    lines: PayrollRunLine[];
    exceptions: PayrollRunException[];
    skipped: PayrollRunSkipped[];
    /**
     * ⚠️ Spune ce calendar a urmat rularea. Fără el, una săptămânală creată **miercuri** arată
     * identic cu una creată **vineri** — aceeași formă, aceleași totaluri — deși acoperă trei
     * zile de muncă diferite.
     */
    calendarNotice: string;
    followsPayCalendar: boolean;
  }>('/payroll-runs', data);
}

/**
 * 🔴 Cine a fost SĂRIT, și de ce. ⛔ **Numit, niciodată aruncat în tăcere** — un om lipsă
 * dintr-o rulare e un om **neplătit**, iar tăcerea aici arată exact ca „nu are ore".
 */
export type PayrollRunSkipped = { name: string; reason: string };

/** Ce e neobișnuit la rularea asta — `runExceptions`, pe server. */
export type PayrollRunException = {
  severity: 'error' | 'warning';
  /** Absent când excepția e despre rulare, nu despre o persoană. */
  cleanerName?: string;
  message: string;
};

/**
 * ACHU-387 — cine a construit rularea, și dacă aprobarea de acum ar fi o **auto-aprobare**.
 *
 * 🔴 Întors pe vederea de DETALIU, nu doar de la butonul de aprobare, și ăsta e chiar rostul:
 * un avertisment care sosește odată cu confirmarea unei decizii deja luate **nu e un control**.
 */
export type PayrollRunApproval = {
  /**
   * 🔴 O **LISTĂ**, nu un om — o rulare poate fi construită de mai mulți, iar auto-aprobarea
   * se pune dacă aprobatorul e **oricare** dintre ei. ⚠️ `[]` când nu s-a consemnat nimic
   * despre cine a construit-o, iar atunci `warning` e `null`: ⛔ tăcerea nu e o dezvinovățire,
   * e o lipsă de date, și nu se afișează ca „a construit-o altcineva".
   */
  builtBy: string[];
  selfApproval: boolean;
  warning: string | null;
  /** ⚠️ Spune că moliciunea e deliberată, ca nimeni să n-o întărească într-un blocaj din reflex. */
  notice: string | null;
};

/**
 * Ce va face și ce **nu** va face fiecare buton — decis de politică, nu de ecran.
 *
 * ⚠️ ACHU-383 — versiunea merge la **toate cinci**, nu doar la `delete`. Trimisă doar unde
 * contează azi ar însemna că următoarea acțiune care are nevoie de istoric primește tăcut o
 * rulare fără el, iar eșecul ăla arată ca un buton rămas activ, nu ca o eroare vizibilă.
 */
export type PayrollRunActions = {
  recalculate: boolean; approve: boolean; lock: boolean; reopen: boolean; delete: boolean;
};

export type PayrollRunDetail = {
  run: PayrollRun;
  /** ⚠️ `null` când nu așteaptă nimic — un avertisment gol e unul care se ignoră. */
  pendingBankDetailWarning: string | null;
  employer: { name: string | null; address: string | null; companyRegNumber: string | null };
  /** Doar NUMELE. Motivul se re-derivă recalculând, care e chiar reparația. */
  missing: string[];
  totals: PayrollRunTotals;
  lines: PayrollRunLine[];
  exceptions: PayrollRunException[];
  approval: PayrollRunApproval;
  can: PayrollRunActions;
};

export function getPayrollRun(id: string) {
  return apiGet<PayrollRunDetail>(`/payroll-runs/${id}`);
}

/* ─── Cele cinci butoane ─────────────────────────────────────────────────── */

/** Ce au în comun toate cinci. ⚠️ `auditWarning` lipsește când auditul a reușit. */
export type PayrollRunMutation = { success: true; run: PayrollRun; auditWarning?: string };

/**
 * ⚠️ **`skipped`, nu `missing`** — și cele două nu sunt același lucru. Pe detaliu, `missing` e
 * lista celor **fără linie**; aici `skipped` e lista celor săriți **de recalcularea asta**,
 * cu motivul ei. ⛔ Verificat în rută: prima versiune a tipului ăstuia a scris `missing` și
 * `exceptions` din reflex, iar ruta nu trimite niciunul.
 */
export function recalculatePayrollRun(id: string) {
  return apiPost<PayrollRunMutation & {
    totals: PayrollRunTotals; lines: PayrollRunLine[]; skipped: PayrollRunSkipped[];
  }>(`/payroll-runs/${id}/recalculate`, {});
}

/**
 * 🔴 `approval` se întoarce **și de aici**, nu doar de pe detaliu — ca un client care a sărit
 * vederea de detaliu să afle totuși că tocmai și-a aprobat singur rularea.
 *
 * ⚠️ **`warnings`, nu `exceptions`**: același conținut (`RunException[]`), alt nume decât pe
 * detaliu. Scris aici ca următorul să nu-l „uniformizeze" și să spargă ecranul.
 */
export function approvePayrollRun(id: string) {
  return apiPost<PayrollRunMutation & {
    totals: PayrollRunTotals; warnings: PayrollRunException[]; approval: PayrollRunApproval;
  }>(`/payroll-runs/${id}/approve`, {});
}

export function lockPayrollRun(id: string) {
  return apiPost<PayrollRunMutation>(`/payroll-runs/${id}/lock`, {});
}

/** ⚠️ Motivul e obligatoriu — serverul refuză orice sub 5 caractere. */
export function reopenPayrollRun(id: string, reason: string) {
  return apiPost<PayrollRunMutation>(`/payroll-runs/${id}/reopen`, { reason });
}

/** ⛔ Refuzată pe o rulare reînchisă (ACHU-383) — istoricul ei nu se poate șterge. */
export function deletePayrollRun(id: string) {
  return apiDelete<{ success: true; auditWarning?: string }>(`/payroll-runs/${id}`);
}

