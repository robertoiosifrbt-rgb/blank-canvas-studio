/**
 * ACHU-401, felia a douăzeci și șaptea — DOVEZILE DESPRE BANII UNUI OM: fluturașii
 * (ACHU-335), P60 și P45 (ACHU-350/354) și istoricul de plată (ACHU-351).
 *
 * ⛔ **Fișier propriu, reexportat** — `payrollEndpoints.ts` și `endpoints.ts` nu cresc.
 * Niciun apelant nu se schimbă. ⚠️ Felie STRUCTURALĂ pe payroll; se semnalează ca informare.
 *
 * 🔴 **Zona se scrie cap-coadă fiindcă nimic nu iese brut:** fluturașul e compus câmp cu
 * câmp în rută, istoricul trece prin `payrollReportPolicy`, iar P60/P45 vin din
 * `statutoryFormsPolicy` — trei module **pure**, cu forma deja publicată.
 *
 * ⛔ **NU se rescriu aici P60 și P45.** Formele lor există deja pe frontend, în
 * `statutoryFormPdf.ts` (`PdfP60Data`, `PdfP45Data`), verificate câmp cu câmp față de
 * `statutoryFormsPolicy.ts`. **A doua copie e chiar greșeala care a produs ACHU-741** — deci
 * tipurile de mai jos le **importă**, nu le repetă.
 *
 * ⚠️ **BANII SOSESC ÎN DOUĂ UNITĂȚI, iar granița e ruta, nu subiectul.** Fluturașul și
 * istoricul de plată sosesc în **LIRE** (ruta a împărțit deja la 100); P60 și P45 sosesc în
 * **PENNY**, fiindcă un document HMRC se tipărește din cifra exactă. ⛔ Aceeași sumă, două
 * scări, în răspunsuri vecine.
 */
import { apiGet } from './apiClient';
import type { PdfP60Data, PdfP45Data } from './statutoryFormPdf';

/* ─── Fluturașii curățătorului (ACHU-335) ──────────────────────────────────── */

/** Un rând de câștig suplimentar de pe fluturaș. ⚠️ Eticheta e SNAPSHOT, nu cea de azi. */
export type PayslipEarningLine = { label: string; amount: number; note: string | null };

/**
 * 🔴 Cerute pe pagină de **ERA 1996 s.8** — suma **ȘI scopul** fiecărei rețineri variabile.
 * ⛔ Un fluturaș din portal fără ele ar fi aceeași încălcare, într-al doilea loc.
 */
export type PayslipDeductionLine = {
  label: string; amount: number; authority: string; note: string | null;
};

/** Un fluturaș. 🔴 **Toate sumele sunt în LIRE** — ruta a împărțit deja la 100. */
export type Payslip = {
  id: string;
  runId: string;
  taxYear: string;
  frequency: string;
  periodNumber: number;
  payDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  version: number;
  runStatus: string;
  /**
   * ⚠️ Numele **AȘA CUM ERA** pe rulare, nu cel de azi. Cine și-a schimbat numele nu are voie
   * să găsească fluturașul de anul trecut reemis sub cel nou — fluturașul e evidența unei
   * plăți făcute.
   */
  nameSnapshot: string;
  /**
   * ACHU-382. ⚠️ Luat din fișa curățătorului, **NU** înghețat pe rând ca numele — și
   * diferența e deliberată: numărul se derivă dintr-un id care **nu se poate schimba**, deci
   * nu există o valoare mai veche pe care să o contrazică.
   */
  employeeNumber: string;
  taxCode: string;
  niCategory: string;
  gross: number;
  /** ⚠️ `null`, nu `0`, pentru rulări dinainte ca defalcarea să existe (ACHU-321). */
  basicPay: number | null;
  /**
   * ACHU-338 — soldul de concediu **la sfârșitul perioadei**, înghețat pe rând.
   * ⚠️ Va DIFERI de soldul de pe fila Pay, care e la zi — iar fluturașul tipărește data
   * tocmai ca cele două să se citească drept **două întrebări**, nu o contradicție.
   */
  holidayRemainingHours: number | null;
  incomeTax: number;
  nationalInsurance: number;
  pension: number;
  studentLoan: number;
  postgraduateLoan: number;
  netPay: number;
  grossToDate: number;
  taxToDate: number;
  hoursWorked: number | null;
  earnings: PayslipEarningLine[];
  postTaxDeductions: PayslipDeductionLine[];
};

export type MyPayslipsResponse = {
  /**
   * ⛔ **Exact cele trei câmpuri pe care le tipărește fluturașul, și nimic mai mult.** Rândul
   * de setări ține și codul de TVA și termenele de plată; un portal care ar întoarce rândul
   * întreg ar trimite unui curățător detaliile comerciale ale firmei fiindcă era comod.
   */
  employer: { name: string | null; address: string | null; companyRegNumber: string | null };
  /** ⚠️ Doar rulări `Approved` sau `Locked`, cel mult 60. O ciornă nu e o plată. */
  payslips: Payslip[];
};

export function getMyPayslips() {
  return apiGet<MyPayslipsResponse>('/me/payslips');
}

/* ─── P60 și P45 (ACHU-350, ACHU-354) ──────────────────────────────────────── */

/** Ce lipsește ca documentul să poată fi emis. ⚠️ Numit pe câmp, nu o propoziție liberă. */
export type StatutoryFormBlocker = { field: string; why: string };

/**
 * 📜 **ACHU-755, REZOLVAT** — aliasul ăsta a existat o zi, fiindcă serverul trimitea
 * `part1NotSent` iar `PdfP45Data` nu-l cunoștea: generatorul de PDF avea propria formulare a
 * aceleiași avertizări. ⛔ Cele două ajungeau la **aceeași persoană** — portalul o arăta pe a
 * serverului, PDF-ul o tipărea pe a lui. Acum e o singură propoziție, iar câmpul stă pe
 * `PdfP45Data`. Aliasul rămâne ca **sinonim**, ca importurile existente să nu se atingă.
 */
export type P45WithNotice = PdfP45Data;

/**
 * ⚠️ **Cifrele se întorc și când e blocat, deliberat:** un birou care umblă după un număr de
 * NI lipsă tot are nevoie să vadă că totalul de plată arată bine. ⛔ Ce nu trebuie să se
 * întâmple niciodată e producerea unui DOCUMENT — asta o oprește `canIssue`.
 */
export type P60Response = {
  kind: 'P60';
  canIssue: boolean;
  blockers: StatutoryFormBlocker[];
  p60: PdfP60Data;
};

export type P45Response = {
  kind: 'P45';
  canIssue: boolean;
  blockers: StatutoryFormBlocker[];
  /** ⚠️ `null` când nu există dată de plecare — nu un document cu un gol acolo unde ea trebuie. */
  p45: P45WithNotice | null;
};

export function getP60(params: { cleanerId: string; taxYear: string }) {
  return apiGet<P60Response>('/payroll-runs/forms/p60', params);
}

export function getP45(params: { cleanerId: string }) {
  return apiGet<P45Response>('/payroll-runs/forms/p45', params);
}

/* ─── Aceleași documente, în mâna ANGAJATULUI (ACHU-354) ────────────────────
 *
 * 🔴 **Blocajele biroului NU se arată aici, și asta e proiectarea.** Un curățător căruia i se
 * arată *„lipsește referința PAYE a angajatorului"* primește administrația neterminată a
 * angajatorului ca și cum ar fi problema lui, iar reacția cea mai probabilă e să creadă că
 * fișa LUI e stricată. Deci portalul întoarce **o propoziție** și un indicator spre birou.
 *
 * ⛔ **Nu se întoarce niciodată ceva parțial.** Când `canIssue` e fals, în răspuns **nu
 * există** document — nu unul cu goluri. Un P60 e ceea ce din care cineva completează o
 * declarație fiscală: o formă care arată emisibilă și căreia îi lipsește o cifră e mai rea
 * decât nicio formă, fiindcă va fi folosită.
 */
export type MyP60 = {
  taxYear: string;
  canIssue: boolean;
  p60: PdfP60Data | null;
  notice: string | null;
};

export type MyP45 = {
  canIssue: boolean;
  p45: PdfP45Data | null;
  notice: string | null;
  /** 🔴 Spus și angajatului, nu doar biroului: Partea 1 merge la HMRC, iar ACHU nu trimite încă. */
  part1Notice: string;
};

export type MyStatutoryFormsResponse = {
  /** Anii fiscali în care persoana chiar are plăți angajate. ⚠️ Doar `Approved`/`Locked`. */
  p60s: MyP60[];
  /**
   * ⚠️ `null` pentru cine **nu** a plecat — nu un document gol. Un angajat curent nu are P45
   * și nu trebuie să vadă o formă care îi spune că a plecat.
   */
  p45: MyP45 | null;
  /**
   * ⚠️ Spus și când totul e emisibil, fiindcă **lipsa** unui P45 e cazul normal, iar un spațiu
   * gol invită întrebarea. `null` când chiar există un P45.
   */
  p45Explanation: string | null;
  /** Prezent doar pe calea „nu ești încă pe payroll" — atunci listele sunt goale. */
  notice?: string;
};

export function getMyForms() {
  return apiGet<MyStatutoryFormsResponse>('/me/forms');
}

/* ─── Istoricul de plată al unei persoane (ACHU-351) ────────────────────────── */

/**
 * Totaluri, **în LIRE** — ruta trece fiecare câmp prin `poundsTotals`.
 *
 * ⚠️ **Nu e `PayrollTotals` de pe server cu alte nume.** `poundsTotals` face trei lucruri pe
 * drum, și toate trei se pierd dacă tipul e scris din memorie: redenumește
 * `employeePensionPence` în `pension`, **ADUNĂ** cele două împrumuturi de studii într-un
 * singur `studentLoan`, și **adaugă** `onTopOfWage`, care nu există pe server.
 * ⛔ Verificat în `payrollReports.ts`, nu presupus — prima versiune a tipului ăstuia le-a
 * greșit pe toate trei.
 */
export type PayHistoryTotals = {
  people: number;
  payments: number;
  hours: number;
  gross: number;
  incomeTax: number;
  employeeNi: number;
  pension: number;
  /** 🔴 Împrumutul de studii **ȘI** cel postuniversitar, adunate. Nu se pot despărți de aici. */
  studentLoan: number;
  netPay: number;
  employerNi: number;
  employerPension: number;
  totalEmployerCost: number;
  /** Cât costă persoana **peste** salariul brut — compus de rută, nu o coloană. */
  onTopOfWage: number;
};

/** O plată din istoric. ⚠️ Cifrele sunt cele STOCATE atunci, nu recalculate azi. */
export type PayHistoryPayment = {
  runId: string;
  lineId: string;
  payDate: string;
  periodNumber: number;
  frequency: string;
  runStatus: string;
  /** ⚠️ Numele AȘA CUM ERA. O redenumire nu are voie să rescrie o plată deja făcută. */
  nameSnapshot: string;
  taxCodeSnapshot: string;
  gross: number;
  netPay: number;
  incomeTax: number;
  employeeNi: number;
  hoursWorked: number | null;
};

export type PayHistoryResponse = {
  person: { cleanerId: string; name: string; active: boolean };
  /** Grupat pe an fiscal, cel mai recent primul — unitatea în care gândesc și biroul, și contabilul. */
  years: Array<{ taxYear: string; totals: PayHistoryTotals; payments: PayHistoryPayment[] }>;
  /** Peste toți anii, ca *„cât i-a plătit ACHU vreodată"* să aibă un singur răspuns. */
  allTime: PayHistoryTotals;
  /**
   * ⚠️ Numai rulări ANGAJATE, iar câte au fost lăsate afară se **numără**. Un istoric care ar
   * include tăcut ciorne ar arăta o plată neagreată și care încă se poate schimba; unul care
   * le-ar scăpa în tăcere ar face un birou să se întrebe unde a dispărut o rulare.
   */
  draftsExcluded: number;
  notice: string | null;
  /**
   * ⛔ Spus pe răspuns ca niciun ecran să nu prezinte asta drept un document. E o listă de
   * plăți; fluturașul e documentul, și se retipărește din rulare.
   */
  notAPayslip: string;
};

export function getPayHistory(params: { cleanerId: string }) {
  return apiGet<PayHistoryResponse>('/payroll-runs/reports/history', params);
}

