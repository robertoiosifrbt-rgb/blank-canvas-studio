/**
 * ACHU-401, felia a douăzeci și patra — CELE CINCI COZI care adaugă sau scad bani pe
 * următoarea rulare de payroll: sporurile, reținerile, kilometrajul, cheltuielile și
 * sumele care se repetă.
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `payrollEndpoints.ts`** — acela are 390 de
 * rânduri și formele de mai jos l-ar duce peste plafonul de 500 (`AGENT_RULES` §7).
 * Reexportat de acolo, deci **niciun apelant nu se schimbă** — aceeași alegere ca la
 * `billingEndpoints.ts` (felia 20).
 *
 * ⚠️ **Felie STRUCTURALĂ pe ecrane de payroll**, nu construcție de funcționalitate —
 * payroll-ul rămâne oprit (Archana, 04/08/2026). Se semnalează ca informare.
 *
 * 🔴 **De ce cozile astea se scriu cap-coadă, deși catalogul rămâne `any` pe restul
 * payroll-ului:** cele cinci rute **nu inventează nimic**. Fiecare are o funcție
 * `serialise*` care numește câmp cu câmp ce pleacă — deci forma se citește de la RUTA
 * care produce răspunsul, nu de la ecranul care îl desenează (lecția feliei 21).
 * ⛔ Rulările de payroll, profilele și rapoartele **nu** intră aici: alea împrăștie
 * rândul Prisma sau compun zeci de bucăți, și fiecare cere felia ei.
 *
 * ⚠️ **BANII SOSESC ÎN DOUĂ UNITĂȚI, deliberat, și tipurile o spun pe fiecare câmp.**
 * `amount` e în **lire** (serverul a împărțit deja la 100), iar tot ce se termină în
 * `Pence` e în **penny, întreg**. ⛔ Adunarea unuia cu celălalt e greșită cu un factor
 * de 100, iar pe un ecran cu ambele nimic nu o semnalează.
 */
import { apiGet, apiPost, apiDelete } from './apiClient';

/**
 * ⚠️ Ce întoarce `logAuditSafe` pe server: **absent** când auditul a reușit, o
 * propoziție când a eșuat dar înregistrarea s-a salvat oricum.
 *
 * ⛔ **Opțional, nu `string | null`** — `undefined` nu supraviețuiește lui
 * `JSON.stringify`, deci cheia chiar lipsește din răspuns pe drumul fericit.
 */
type WithAuditWarning = { auditWarning?: string };

/* ─── Sporurile (ACHU-321) ─────────────────────────────────────────────────── */

/**
 * ⚠️ ACHU-401 (felia 17) — `code` e STOCAT pe linia de salariu, deci **nu se redenumește**
 * niciodată după prima folosire; `label` și `hint` se pot rescrie oricând. Diferența e chiar
 * motivul pentru care lista vine de la server.
 */
export type PayrollEarningType = { code: string; label: string; hint: string };

/** Un rând din coada de sporuri — `payrollEarnings.ts`, `serialiseEarning`. */
export type PayrollEarning = {
  id: string;
  /** Codul stocat. `label` e citirea lui de azi din catalog, nu o coloană. */
  type: string;
  label: string;
  /** 🔴 În LIRE — ruta împarte `amountPence` la 100. */
  amount: number;
  note: string | null;
  /** `true` = a fost luat de o rulare. ⛔ Atunci nu se mai poate șterge (ruta refuză). */
  paid: boolean;
  paidInRunId: string | null;
  paidAt: string | null;
  createdBy: string;
  createdAt: string;
};

/**
 * ⚠️ **Două liste, nu una cu un indicator** — „așteaptă" și „deja plătit" sunt două
 * întrebări diferite, iar ruta le desparte tocmai ca ecranul să nu le amestece.
 */
export type PayrollEarningsResponse = { waiting: PayrollEarning[]; paid: PayrollEarning[] };

/** Ce se trimite la adăugare — oglindește `earningSchema`. */
export type PayrollEarningInput = {
  type: string;
  /** În LIRE, cum s-a tastat. Serverul convertește și verifică plaja. */
  amount: number;
  /** ✅ `null` e acceptat aici (`.nullable()` pe schemă), spre deosebire de kilometraj. */
  note?: string | null;
};

export function getEarningTypes() {
  return apiGet<{ types: PayrollEarningType[] }>('/payroll/earning-types');
}

export function getPayrollEarnings(cleanerId: string) {
  return apiGet<PayrollEarningsResponse>(`/payroll/people/${cleanerId}/earnings`);
}

export function addPayrollEarning(cleanerId: string, data: PayrollEarningInput) {
  return apiPost<{ success: true; earning: PayrollEarning } & WithAuditWarning>(
    `/payroll/people/${cleanerId}/earnings`, data);
}

export function removePayrollEarning(id: string) {
  return apiDelete<{ success: true } & WithAuditWarning>(`/payroll/earnings/${id}`);
}

/* ─── Reținerile (ACHU-331) ────────────────────────────────────────────────── */

/**
 * 🔴 `reducesNmwPay` e PURTĂTOR DE GREUTATE, nu decor: o reținere în folosul angajatorului
 * scade plata pentru verificarea salariului minim, una care recuperează un avans **nu**.
 * ⛔ Greșit în oricare direcție, avertismentul de subplată arată spre oamenii greșiți — și
 * ăla e cel mai util lucru pe care îl face motorul pentru o firmă de curățenie.
 */
export type PayrollDeductionType = {
  code: string; label: string; hint: string; reducesNmwPay: boolean;
};

/** Ce face reținerea LEGALĂ (ERA 1996 s.13): lege, contract, sau acord scris. */
export type PayrollDeductionAuthority = 'statutory' | 'contract' | 'written-consent';

export type PayrollDeductionTypesResponse = {
  types: PayrollDeductionType[];
  authorities: { code: PayrollDeductionAuthority; label: string }[];
  /** ⚠️ O LIPSĂ numită, nu o funcționalitate: soldul rămas de recuperat nu e modelat nicăieri. */
  runningBalanceNote: string;
};

/** Un rând din coada de rețineri — `payrollDeductions.ts`, `serialiseDeduction`. */
export type PayrollDeduction = {
  id: string;
  type: string;
  label: string;
  /** 🔴 În LIRE, și **pozitiv** — semnul minus îl pune ecranul, nu ruta. */
  amount: number;
  /**
   * ⚠️ Coloana e `String`, nu un enum — ruta o trimite așa cum a fost stocată. Un cod
   * scos din catalog mai târziu ajunge tot aici, deci **nu** e îngustat la uniune.
   */
  authority: string;
  /** Citirea de azi a codului de mai sus; `authority` însuși când catalogul nu-l știe. */
  authorityLabel: string;
  reducesNmwPay: boolean;
  note: string | null;
  /** `true` = a fost luată de o rulare. ⛔ Atunci nu se mai poate șterge. */
  taken: boolean;
  takenInRunId: string | null;
  takenAt: string | null;
  createdBy: string;
  createdAt: string;
};

export type PayrollDeductionsResponse = { waiting: PayrollDeduction[]; taken: PayrollDeduction[] };

/** Ce se trimite la adăugare — oglindește `deductionSchema`. */
export type PayrollDeductionInput = {
  type: string;
  /** În LIRE, cum s-a tastat. */
  amount: number;
  /**
   * 🔴 **OBLIGATORIU, fără implicit.** O reținere neautorizată se poate recupera INTEGRAL
   * la tribunal, inclusiv partea datorată efectiv — de aceea serverul o cere, nu o ghicește.
   */
  authority: string;
  note?: string | null;
};

export function getDeductionTypes() {
  return apiGet<PayrollDeductionTypesResponse>('/payroll/deduction-types');
}

export function getPayrollDeductions(cleanerId: string) {
  return apiGet<PayrollDeductionsResponse>(`/payroll/people/${cleanerId}/deductions`);
}

export function addPayrollDeduction(cleanerId: string, data: PayrollDeductionInput) {
  return apiPost<{ success: true; deduction: PayrollDeduction } & WithAuditWarning>(
    `/payroll/people/${cleanerId}/deductions`, data);
}

export function removePayrollDeduction(id: string) {
  return apiDelete<{ success: true } & WithAuditWarning>(`/payroll/deductions/${id}`);
}

/* ─── Kilometrajul (ACHU-360) ──────────────────────────────────────────────────
 *
 * ⚠️ Separat de sporuri și de rețineri, deliberat. O plată de kilometraj la sau sub
 * tariful aprobat de HMRC **nu e salariu**: fără impozit, fără NI, fără pensie, și **nu**
 * contează la salariul minim. Serverul întoarce fiecare cerere deja împărțită — ⛔ ecranul
 * nu face aritmetica, fiindcă aici sunt **două** plafoane de greșit, nu unul.
 */

/**
 * Împărțeala unei cereri, calculată de `backend/src/lib/mileagePolicy.ts`.
 *
 * 🔴 **Toate câmpurile sunt în PENNY, întregi** — spre deosebire de `amount` de mai sus.
 */
export type PayrollMileageSplit = {
  /** Total plătit de ACHU pentru cererea asta. */
  paidPence: number;
  /** Partea care **nu** e salariu: fără impozit, NI, pensie sau efect pe salariul minim. */
  taxFreePence: number;
  /** Peste plafonul de impozit. Salariu impozabil obișnuit. */
  taxableExcessPence: number;
  /**
   * Peste plafonul de NI. ⚠️ Niciodată mai mare decât `taxableExcessPence`, și de obicei
   * mai mic — plafonul de NI nu are treapta de la 10.000 de mile.
   */
  niableExcessPence: number;
  approvedForTaxPence: number;
  approvedForNiPence: number;
  milesAtFullRate: number;
  milesAtReducedRate: number;
  /**
   * 🔴 Cât **sub** tariful aprobat plătește ACHU. `null` când plătește tariful sau peste —
   * ⛔ **nu `0`**: „zero diferență" și „nu există diferență de discutat" arată la fel pe un
   * ecran, iar doar una dintre ele merită propoziția despre scutirea pe care o poate cere
   * omul de la HMRC.
   */
  shortfallForReliefPence: number | null;
  warnings: string[];
};

/** Ce e adevărat despre orice cerere de kilometraj, calculată sau nu. */
export type PayrollMileageClaimBase = {
  id: string;
  /** `YYYY-MM-DD`. ⚠️ Anul fiscal se ia de aici, nu din ziua de azi și nici din data plății. */
  journeyOn: string;
  miles: number;
  /** ⚠️ Ce plătește ACHU, nu tariful HMRC — ăla e doar plafonul scutirii. */
  pencePerMilePaid: number;
  vehicle: string;
  note: string | null;
  /** ⛔ O cerere neaprobată nu e plătită niciodată de o rulare. */
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  paid: boolean;
  paidInRunId: string | null;
  createdBy: string;
  createdAt: string;
  /** Mile de business deja plătite în anul fiscal al călătoriei, **înainte** de asta. */
  milesAlreadyThisYear: number;
};

/**
 * 🔴 **UNIUNE, nu un obiect cu două câmpuri opționale** (lecția feliei 22): ori există
 * împărțeala, ori există motivul pentru care nu s-a putut calcula. ⛔ Un ecran care citește
 * `split.paidPence` fără să verifice întâi ar afișa 0,00 £ acolo unde adevărul e „nu am
 * tarifele pentru anul ăla".
 */
export type PayrollMileagePricedClaim =
  PayrollMileageClaimBase & { split: PayrollMileageSplit; priceProblem: null };

/** ⚠️ Ruta refuză la CREARE o cerere care nu se poate calcula, deci ramura asta apare doar
 *  pe una veche: tarifele anului ei nu mai sunt ținute. `priceProblem` spune de ce. */
export type PayrollMileageUnpricedClaim =
  PayrollMileageClaimBase & { split: null; priceProblem: string };

export type PayrollMileageClaim = PayrollMileagePricedClaim | PayrollMileageUnpricedClaim;

export type PayrollMileageResponse = {
  waiting: PayrollMileageClaim[];
  approved: PayrollMileageClaim[];
  paid: PayrollMileageClaim[];
  taxYear: { start: string; end: string };
  /** Mile deja PLĂTITE anul ăsta fiscal. De aici se măsoară treapta de 10.000. */
  milesPaidThisTaxYear: number;
  stepsDownAtMiles: number;
  /** Propoziția serverului. ⛔ Se randează verbatim — o a doua formulare e una care se abate. */
  notPayNotice: string;
};

/** Ce se trimite la adăugare — oglindește `mileageSchema`. */
export type PayrollMileageInput = {
  /** `YYYY-MM-DD`. ⛔ În viitor e refuzat: o cerere e pentru o călătorie deja făcută. */
  journeyOn: string;
  /** Nu neapărat întreg — kilometrajele nu sunt, iar rotunjirea se acumulează. */
  miles: number;
  /**
   * 🔴 **OBLIGATORIU, fără implicit.** Tariful aprobat de HMRC e un PLAFON pentru scutire,
   * nu un tarif pe care ACHU îl datorează — o valoare implicită ar însemna că formularul
   * a ales singur o politică de firmă și a stocat-o ca și cum ar fi decis-o cineva.
   */
  pencePerMilePaid: number;
  vehicle?: string;
  /**
   * 🔴 **ACHU-753** — `null` e acceptat de când s-a reparat schema. Până atunci ecranul
   * trimitea `note.trim() || null` pe o schemă `.optional()` **fără** `.nullable()`, iar
   * zod refuza: fiecare cerere de kilometraj **fără notă** — cazul obișnuit — pica cu
   * „Expected string, received null". ⛔ Nu se strâmtează înapoi la `string`.
   */
  note?: string | null;
};

export function getPayrollMileage(cleanerId: string) {
  return apiGet<PayrollMileageResponse>(`/payroll/people/${cleanerId}/mileage`);
}

export function addPayrollMileage(cleanerId: string, data: PayrollMileageInput) {
  return apiPost<{ success: true; claim: PayrollMileageClaim } & WithAuditWarning>(
    `/payroll/people/${cleanerId}/mileage`, data);
}

/** Aprobarea e act separat: o cerere neaprobată nu e plătită niciodată de o rulare. */
export function approvePayrollMileage(id: string) {
  return apiPost<{ success: true; claim: PayrollMileageClaim } & WithAuditWarning>(
    `/payroll/mileage/${id}/approve`, {});
}

export function removePayrollMileage(id: string) {
  return apiDelete<{ success: true } & WithAuditWarning>(`/payroll/mileage/${id}`);
}

/* ─── Cheltuielile (ACHU-361) ──────────────────────────────────────────────────
 *
 * ⚠️ Sora kilometrajului, fără aritmetică: suma e suma de pe bon. Ce are în schimb e o
 * ÎNTREBARE — serverul refuză să stocheze o cerere condiționată până nu răspunde biroul.
 */

/**
 * ⚠️ `qualifyingQuestion` `null` = nu există întrebare de pus. `neverFor` numește cazul în
 * care tipul ăsta nu se aplică niciodată.
 */
export type PayrollExpenseType = {
  code: string; label: string; hint: string;
  qualifyingQuestion: string | null;
  neverFor: string | null;
};

export type PayrollExpenseTypesResponse = {
  types: PayrollExpenseType[];
  /** 🔴 Propoziția pe care ecranul va fi pus să o justifice: *„de ce nu pot bifa scutit?"* */
  reimbursedIsNotTaxFree: string;
  /** ⛔ O rambursare NU e plată — de-aia nu intră în salariu. */
  notPayNotice: string;
};

/** Un rând din coada de cheltuieli — `payrollReimbursements.ts`, `serialiseExpense`. */
export type PayrollExpenseClaim = {
  id: string;
  /**
   * `YYYY-MM-DD`. ⚠️ **`string`, nu `string | null`**, deși ajutorul `iso()` de pe rută are
   * semnătura lărgită: coloana `incurredOn` e `@db.Date` **NOT NULL** în `schema.prisma`,
   * deci ramura `null` nu se poate produce. Verificat în schemă, nu presupus din ecran.
   */
  incurredOn: string;
  type: string;
  /** Eticheta călătorește cu cererea, ca niciun ecran să nu țină a doua copie a catalogului. */
  label: string;
  /** 🔴 În LIRE. `amountPence` de dedesubt e ACELAȘI ban în penny — nu se adună între ele. */
  amount: number;
  amountPence: number;
  /**
   * 🔴 TREI înțelesuri distincte: `true` = s-a răspuns da, deci scutit; `false` = s-a
   * răspuns nu, deci impozabil; `null` = tipul **nu pune** nicio întrebare.
   * ⛔ `null` **nu** înseamnă „încă fără răspuns" — ruta refuză să stocheze așa ceva.
   */
  qualifies: boolean | null;
  /** `null` când cererea nu mai poate fi clasificată (un tip scos din catalog). */
  treatment: 'exempt' | 'taxable' | null;
  note: string | null;
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  paid: boolean;
  paidInRunId: string | null;
  createdBy: string;
  createdAt: string;
};

export type PayrollExpensesResponse = {
  waiting: PayrollExpenseClaim[];
  approved: PayrollExpenseClaim[];
  paid: PayrollExpenseClaim[];
  notPayNotice: string;
};

/** Ce se trimite la adăugare — oglindește `expenseSchema`. */
export type PayrollExpenseInput = {
  /** `YYYY-MM-DD`. ⛔ În viitor e refuzat: o cheltuială e bani deja dați. */
  incurredOn: string;
  type: string;
  /** În LIRE, cum s-a tastat. */
  amount: number;
  /**
   * ⛔ **Se OMITE cu totul** când tipul nu pune întrebare — asta stochează `null`, adică
   * „nu e nimic de răspuns". Un `false` trimis din reflex ar însemna „s-a răspuns nu",
   * deci impozabil, pe o rambursare care nu era.
   */
  qualifies?: boolean;
  /** 🔴 Aceeași reparație ca la kilometraj — ACHU-753. `null` = fără notă. */
  note?: string | null;
};

export function getExpenseTypes() {
  return apiGet<PayrollExpenseTypesResponse>('/payroll/expense-types');
}

export function getPayrollExpenses(cleanerId: string) {
  return apiGet<PayrollExpensesResponse>(`/payroll/people/${cleanerId}/expenses`);
}

export function addPayrollExpense(cleanerId: string, data: PayrollExpenseInput) {
  return apiPost<{ success: true; claim: PayrollExpenseClaim } & WithAuditWarning>(
    `/payroll/people/${cleanerId}/expenses`, data);
}

export function approvePayrollExpense(id: string) {
  return apiPost<{ success: true; claim: PayrollExpenseClaim } & WithAuditWarning>(
    `/payroll/expenses/${id}/approve`, {});
}

export function removePayrollExpense(id: string) {
  return apiDelete<{ success: true } & WithAuditWarning>(`/payroll/expenses/${id}`);
}

/* ─── Sumele care se repetă (ACHU-386) ─────────────────────────────────────────
 *
 * 🔴 Owner-ul a refuzat regulile automate de bonus pe 04/08/2026, fiindcă o regulă
 * plătește tăcut suma greșită la FIECARE rulare, cu un fluturaș care se adună perfect.
 * Ce face suma repetată acceptabilă: cifra e mereu una tastată de un om, iar fiecare
 * rulare spune care linii au venit dintr-o regulă, înainte de aprobare.
 */

/** Un rând — `payroll.ts`, `serialiseRecurring`. Catalogul de tipuri e cel de la sporuri. */
export type PayrollRecurringPayment = {
  id: string;
  type: string;
  label: string;
  /** 🔴 În LIRE, la fiecare perioadă de plată. */
  amount: number;
  note: string | null;
  /** `YYYY-MM-DD`. `endDate` `null` = până la un Stop. */
  startDate: string;
  endDate: string | null;
  /** ⚠️ Un STOP, nu o ștergere — rândul rămâne vizibil cu cine l-a oprit și când. */
  stoppedAt: string | null;
  stoppedBy: string | null;
  createdBy: string;
  createdAt: string;
};

export type PayrollRecurringResponse = {
  running: PayrollRecurringPayment[];
  stopped: PayrollRecurringPayment[];
  /** 🔴 Se randează ÎNAINTEA formularului — e ce trebuie citit primul. */
  notice: string;
};

/** Ce se trimite la adăugare — oglindește `recurringSchema`. */
export type PayrollRecurringInput = {
  type: string;
  /** În LIRE, cum s-a tastat. */
  amount: number;
  note?: string | null;
  startDate: string;
  endDate?: string | null;
};

export function getRecurringPayments(cleanerId: string) {
  return apiGet<PayrollRecurringResponse>(`/payroll/people/${cleanerId}/recurring`);
}

export function addRecurringPayment(cleanerId: string, data: PayrollRecurringInput) {
  return apiPost<{ success: true; recurring: PayrollRecurringPayment } & WithAuditWarning>(
    `/payroll/people/${cleanerId}/recurring`, data);
}

/**
 * ⚠️ Un STOP, nu un delete — rândul rămâne cu cine l-a oprit și când.
 *
 * 🔴 `notice` e OBLIGATORIU în răspuns și spune ce urmează: oprirea se aplică de la
 * următoarea dată de plată, iar o rulare deja aprobată trebuie redeschisă. ⛔ Un
 * „Stopped." vesel în locul lui ar ascunde exact pasul care mai trebuie făcut.
 */
export function stopRecurringPayment(id: string) {
  return apiPost<{
    success: true; recurring: PayrollRecurringPayment; notice: string;
  } & WithAuditWarning>(`/payroll/recurring/${id}/stop`, {});
}

