/**
 * ACHU-401, felia a treizeci și una — SIMULATORUL (ACHU-259) și tabelul de rate pe care îl
 * folosește (ACHU-243/244/245).
 *
 * ⛔ **Fișier propriu, reexportat** — niciun apelant nu se schimbă. ⚠️ Felie STRUCTURALĂ;
 * payroll-ul rămâne oprit.
 *
 * 🔴 **Aici e cel mai important loc din aplicație unde un tip trebuie să spună CE NU E.**
 * Simulatorul calculează corect și nu produce nimic: nici document cu valoare legală, nici
 * ceva trimis la HMRC. ⛔ Un ecran plin de cifre exacte e chiar lucrul pe care cineva îl
 * confundă cu un fluturaș — de aceea `isSimulation` e tipizat `true` **literal**, iar cele
 * două propoziții ale serverului sunt câmpuri **obligatorii**, nu opționale.
 *
 * ⚠️ **BANII SOSESC DE DOUĂ ORI: în lire sus, în penny sub `pence`** — aceeași convenție ca la
 * o rulare, și din același motiv: aritmetica s-a făcut în penny, iar cine verifică o cifră
 * poate s-o vadă neconvertită.
 */
import { apiGet, apiPost } from './apiClient';

/** O linie așa cum o numește motorul, plus cele două forme pe care le desenează ecranul. */
export type SimulatorLine = {
  label: string;
  amountPence: number;
  note?: string;
  /** Aceeași sumă în lire. */
  amount: number;
  /** Aceeași sumă, deja formatată de server — ⛔ ca ecranul să nu inventeze a doua formatare. */
  formatted: string;
};

export type SimulateResponse = {
  /**
   * 🔴 **`true` LITERAL, nu `boolean`.** Nu există cale prin cod care să-l facă `false`, și
   * tipul o spune ca să nu apară vreodată un `if` care presupune că ar putea exista.
   */
  isSimulation: true;
  /** Propoziția de pe fiecare fluturaș simulat. Se randează verbatim. */
  simulationNotice: string;
  taxYear: string;
  /** ⚠️ `true` doar când un OM a verificat ratele anului față de gov.uk. */
  ratesVerified: boolean;
  /** ⛔ Nu erori — lucruri la care biroul trebuie să se uite. Niciodată înghițite în tăcere. */
  warnings: string[];
  /** Toate în LIRE. */
  employee: {
    gross: number; taxablePay: number; niablePay: number; incomeTax: number;
    nationalInsurance: number; pension: number; studentLoan: number;
    postgraduateLoan: number; netPay: number;
  };
  employer: {
    nationalInsurance: number; pension: number; totalCost: number;
    /** Cât costă omul **peste** salariul lui. Cifra pe care patronii o subestimează. */
    onTopOfWage: number;
  };
  /** Cumulat de la începutul anului fiscal, incluzând perioada asta. */
  toDate: { gross: number; tax: number };
  /** `null` când nu s-au dat ore — ⛔ nu `0`, care ar afirma că nu s-a acumulat concediu. */
  holidayAccruedHours: number | null;
  deductionLines: SimulatorLine[];
  employerLines: SimulatorLine[];
  /** Aceleași sume în penny. ⛔ `pence.gross` și `employee.gross` sunt același ban. */
  pence: {
    gross: number; incomeTax: number; employeeNi: number; employeePension: number;
    studentLoan: number; postgraduateLoan: number; netPay: number;
    employerNi: number; employerPension: number; totalEmployerCost: number;
  };
};

/**
 * ⚠️ Semnătura de INTRARE e cea scrisă la ACHU-259 și **păstrată verbatim** — era deja
 * îngustă. Felia asta a schimbat doar RĂSPUNSUL, care era `any`.
 */
export function simulatePayroll(params: {
  /** În LIRE, cum s-a tastat. Convertit în penny înainte de orice aritmetică. */
  gross: number;
  frequency: 'weekly' | 'fortnightly' | 'four-weekly' | 'monthly';
  periodNumber: number;
  taxCode: string;
  niCategory: string;
  payDate: string;
  grossToDate?: number;
  taxToDate?: number;
  pension?: {
    employeePercent: number; employerPercent: number;
    basis: 'net-pay-arrangement' | 'relief-at-source'; onQualifyingEarningsOnly: boolean;
  };
  hoursWorked?: number;
  minimumWageBand?: 'age21Plus' | 'age18to20' | 'under18' | 'apprentice';
  /**
   * ⚠️ Se **omite cu totul** pentru cine nu are împrumut. `plan: null` cu
   * `postgraduate: true` e o combinație **reală**: un împrumut postuniversitar se rambursează
   * peste un plan, și uneori fără niciunul.
   */
  studentLoan?: { plan: 'plan1' | 'plan2' | 'plan4' | 'plan5' | null; postgraduate: boolean };
}) {
  return apiPost<SimulateResponse>('/payroll/simulate', params);
}

/* ─── Tabelul de rate ──────────────────────────────────────────────────────── */

/**
 * 🔴 **Cele două praguri pe perioadă NU au aceleași perioade**, și tipul o spune fiindcă
 * altfel nimic n-o face.
 *
 * ⚠️ NI-ul e publicat de HMRC **săptămânal și lunar**; pensia e publicată de The Pensions
 * Regulator pe **patru** perioade. ⛔ Verificat în rută, nu presupus: prima versiune a scris
 * o singură formă pentru amândouă și a picat la compilare pe fixtura de pensie.
 */
export type NiPerPeriodPounds = { weekly: number; monthly: number };

export type PensionPerPeriodPounds = {
  weekly: number; fortnightly: number; fourWeekly: number; monthly: number;
};

export type IncomeTaxBand = {
  label: string;
  from: number;
  /** `null` = banda nu are capăt de sus. */
  to: number | null;
  ratePercent: number;
};

export type PayrollTaxYearRates = {
  taxYear: string;
  startsOn: string;
  endsOn: string;
  /** `true` când cineva a verificat anul întreg față de gov.uk — derivat pe rută din câmpul de mai jos. */
  verified: boolean;
  /**
   * 🔴 **CINE a citit ratele de pe gov.uk, și CÂND** — nu o dată, nu un boolean.
   *
   * ⛔ Prima versiune a tipului ăstuia l-a scris `string | null` și a picat la compilare pe
   * ecran, care citește `.by` și `.on`. ⚠️ Un nume contează: fișierul de rate a fost **greșit
   * de două ori** cu cifre perfect plauzibile (12,41 £ în loc de 12,21 £), iar întrebarea
   * utilă atunci nu e „s-a verificat?", ci **pe cine întrebi**.
   */
  verifiedAgainstHmrc: { on: string; by: string } | null;
  /**
   * ⚠️ **Confirmare PARȚIALĂ, care e starea realistă:** cineva a verificat o parte din tabel
   * și restul nu. ⛔ Ținută separat, fiindcă *„aproape verificat"* nu are voie să se citească
   * drept *„verificat"* — iar `outstanding` e chiar lista pe care o ia următorul.
   */
  partiallyVerified: {
    on: string;
    by: string;
    /** Citite de pe pagina gov.uk însăși. Cea mai tare dovadă de aici. */
    confirmed: string[];
    /**
     * ⚠️ Luate din ceva care **citează** gov.uk, nu de pe pagină — rezumatul generat de un
     * motor de căutare, de pildă. Dovadă genuin mai slabă: un rezumat poate transpune o cifră
     * exact la fel de ușor.
     */
    confirmedFromSecondarySource?: string[];
    outstanding: string[];
  } | null;
  /** ⛔ Lucruri pe care HMRC nu le publică, deci verificarea completă nu le poate acoperi. */
  unverifiedFields: string[];
  employmentAllowance: number;
  personalAllowance: number;
  niPrimaryThreshold: number;
  niSecondaryThreshold: number;
  niUpperEarningsLimit: number;
  niEmployeeMainRatePercent: number;
  niEmployerRatePercent: number;
  /**
   * 🔴 ACHU-243 — prezent **doar** pentru un an al cărui tabel pe perioadă a fost citit.
   * ⛔ Fără el, ecranul ar continua să pretindă o cifră **împărțită** pentru un an în care
   * motorul nu mai împarte. `null` = arată-i omului „anual ÷ 12, aproximativ".
   */
  niThresholdsPerPeriod: {
    primary: NiPerPeriodPounds; secondary: NiPerPeriodPounds; upperEarningsLimit: NiPerPeriodPounds;
  } | null;
  incomeTaxBands: IncomeTaxBand[];
  pensionQualifyingLower: number;
  pensionQualifyingUpper: number;
  /**
   * ⛔ **Cine a citit cifrele de la The Pensions Regulator, și când** — un obiect, nu un
   * boolean. Ținut separat de `verifiedAgainstHmrc` **deliberat**: sunt doi reglementatori
   * diferiți, pe site-uri diferite, iar un an poate avea unul confirmat și celălalt nu. 🔴 Un
   * singur indicator ar lăsa o verificare pe gov.uk să garanteze tăcut niște cifre de pensie
   * la care nu s-a uitat nimeni.
   */
  pensionFiguresVerified: { on: string; by: string } | null;
  pensionThresholdsPerPeriod: {
    lower: PensionPerPeriodPounds; upper: PensionPerPeriodPounds; autoEnrolTrigger: PensionPerPeriodPounds;
  } | null;
  /** Cheia e banda de vârstă; valoarea, în LIRE pe oră. */
  minimumWagePerHour: Record<string, number>;
};

export type PayrollRatesResponse = {
  taxYears: PayrollTaxYearRates[];
  niCategories: Array<{ letter: string; description: string }>;
  frequencies: string[];
  /**
   * 🔴 ACHU-245 — ce nu face **SIMULATORUL**, nu ce nu face aplicația.
   *
   * ⚠️ Distincția a fost un defect: boala, concediul de familie și NI-ul de director **se
   * calculează** într-o rulare reală, iar *„not calculated at all"* era **fals**, pe un ecran
   * de bani. Se randează verbatim tocmai ca să nu fie rescris înapoi.
   */
  notModelled: string[];
  /** Spusă o dată aici, ca fiecare ecran să arate aceeași propoziție. */
  stageNotice: string;
};

export function getPayrollRates() {
  return apiGet<PayrollRatesResponse>('/payroll/rates');
}

