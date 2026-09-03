/**
 * ACHU-401, felia a douăzeci și doua — CELE PATRU ÎNREGISTRĂRI DE BAZĂ: citirea **și** scrierea
 * lor. Clientul, vizita, plata, cheltuiala.
 *
 * ⛔ **Fișier propriu, reexportat din `endpoints.ts`** (`AGENT_RULES` §7), deci niciun apelant nu
 * se schimbă. Perechea lui e `adminRecordTypes.ts`, care ține **formele rândurilor** — aici stau
 * doar apelurile și **ce răspunde serverul după o scriere**.
 *
 * 🔴 **Listele au așteptat două felii degeaba.** Formele lor au fost publicate la felia 19 și le
 * foloseau opt ecrane; catalogul, care le **produce**, era singurul loc rămas cu `apiGet<any>`.
 * ⛔ Același tipar ca la felia 14 — *un tip publicat pe care ecranul de alături nu-l folosește nu
 * apără nimic* — de data asta chiar pe fișierul care publică tipul.
 *
 * 🔴 **Iar răspunsurile de la SCRIERE erau chiar motivul scris în antetul lui `endpoints.ts`**
 * pentru care totul a rămas `any`: *„rutele `save*` adaugă `duplicateConflict`/`warning`/
 * `message` pe ramuri specifice de business"*. ⚠️ Adevărat — și de aceea se scriu ca **uniuni**,
 * nu ca un obiect cu tot opțional: un `success: false` **nu are** id, iar un ecran care citește
 * `res.id` pe ramura de duplicat citește șirul gol și crede că a salvat.
 */
import { apiGet, apiPost, apiDownloadPost } from './apiClient';
import type { CustomerRecord, JobRecord, PaymentRecord, ExpenseRecord } from './adminRecordTypes';

/** Ce s-a scris în istoric, când scrierea a mers dar auditul nu. ⚠️ Prezent = salvat, dar fără urmă. */
type AuditWarning = { auditWarning?: string };

// ─── Clienți ────────────────────────────────────────────────────────

/** 🔴 §47 (Sesiunea 154) — paginată și sortată de server, ca vizitele și plățile. */
export type CustomerListPage = {
  records: CustomerRecord[]; total: number; page: number; pageSize: number;
  /** 🆕 §4 (Sesiunea 157) — ce înseamnă un „Next job" gol; de la server, ca ecranul să nu inventeze. */
  activityNote?: string;
};

export function getCustomers(params: {
  search?: string; sortBy?: string; sortDir?: 'asc' | 'desc'; page?: number; pageSize?: number;
}) {
  return apiGet<CustomerListPage>('/customers', params);
}

/**
 * Cu cine seamănă clientul pe care biroul îl creează acum (ACHU-530).
 *
 * ⛔ **AVERTISMENT, NU BLOCAJ:** doi oameni reali pot purta același nume, iar un refuz l-ar face
 * pe al doilea imposibil de înregistrat. ⚠️ **Doar la CREARE** — la editare, un nume care se
 * potrivește e cel mai probabil corectarea unei greșeli de tastare.
 */
export type CustomerDuplicate = {
  id: string;
  customerId: number;
  customerName: string;
  phone: string | null;
  email: string | null;
  postcode: string | null;
  /** Pe ce s-a potrivit: `name` · `phone` · `postcode`. Biroul decide mai repede dacă știe. */
  matchedOn: string[];
};

export type SaveCustomerResult =
  | { success: true; id: string; auditWarning?: string; duplicates?: undefined }
  | { success: false; id: ''; duplicateConflict: true; duplicates: CustomerDuplicate[]; auditWarning?: undefined };

export function saveCustomer(data: Record<string, unknown>) {
  return apiPost<SaveCustomerResult>('/customers/save', data);
}

// ─── Vizite ─────────────────────────────────────────────────────────

/**
 * 🔴 §47 (Sesiunea 154) — lista vine **paginată, sortată și numărată de server**.
 *
 * ⚠️ `statusCounts` e pe **stare**, nu pe grup: care stare intră în ce secțiune e regula din
 * `jobGrouping.ts`, iar ea rămâne singura. ⛔ Serverul numără un fapt, ecranul îl adună pe grupuri.
 * `total` e peste **tot setul filtrat**, nu peste pagină — altfel pastilele ar minți.
 */
export type JobListPage = {
  records: JobRecord[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<string, number>;
};

export function getJobs(params: {
  search?: string; customerId?: string;
  sortBy?: string; sortDir?: 'asc' | 'desc';
  page?: number; pageSize?: number;
}) {
  return apiGet<JobListPage>('/jobs', params);
}

/** O vizită, cu `_revision` calculat pe SERVER — fără el, fiecare salvare e respinsă ca CONFLICT. */
export function getJob(params: { id: string }) {
  return apiGet<{ record: JobRecord }>(`/jobs/${params.id}`);
}

/**
 * ⚠️ `warning` NU e o eroare: vizita s-a salvat. E propoziția despre o oră sau o dată care arată
 * greșit (`validateSaveJobTiming`), iar ecranul o arată **lângă** confirmarea de salvare.
 */
export function saveJob(data: Record<string, unknown>) {
  return apiPost<{ success: true; id: string; warning?: string } & AuditWarning>('/jobs/save', data);
}

/**
 * 🔴 `resolvedStatus` e starea pe care a decis-o SERVERUL, nu cea cerută — poate diferi, iar
 * ecranul trebuie să o arate pe cea reală.
 *
 * ⚠️ Ruta are **două căi**, de birou și de curățător, plus o a treia scurtă: când aceeași apăsare
 * ajunge de două ori, tokenul de idempotență întoarce `{ success: true }` **fără** stare — a doua
 * apăsare nu mai schimbă nimic, deci nu are ce raporta.
 */
export function updateJobStatus(params: { id: string; [key: string]: unknown }) {
  const { id, ...body } = params;
  return apiPost<{ success: true; resolvedStatus?: string } & AuditWarning>(`/jobs/${id}/status`, body);
}

// ─── Plăți ──────────────────────────────────────────────────────────

/**
 * 🔴 §47 (Sesiunea 154) — lista vine **paginată și sortată de server**, ca la vizite.
 * ⚠️ Fără numărători: lista de plăți n-are pastile de secțiune. `total` e peste tot setul căutat.
 */
export type PaymentListPage = {
  records: PaymentRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export function getPayments(params: {
  search?: string; customerId?: string; jobId?: string;
  sortBy?: string; sortDir?: 'asc' | 'desc';
  page?: number; pageSize?: number;
}) {
  return apiGet<PaymentListPage>('/payments', params);
}

/** O plată care seamănă cu cea care se scrie acum. Aceeași formă ca la clienți, deliberat. */
export type PaymentDuplicate = {
  paymentId: number;
  paymentDate: string;
  amount: number;
  paymentStatus: string | null;
  externalReference: string | null;
};

/** 🔴 ACHU-750 — ce vede biroul despre bonul cu care se ciocnește, ca la plăți. */
export type ExpenseDuplicate = {
  expenseId: number;
  expenseDate: string;
  supplier: string | null;
  amount: number;
  category: string | null;
  documentNumber: string | null;
};

export type SavePaymentResult =
  | { success: true; id: string; duplicates?: undefined }
  | { success: false; id: ''; duplicateConflict: true; duplicates: PaymentDuplicate[] };

export function savePayment(data: Record<string, unknown>) {
  return apiPost<SavePaymentResult>('/payments/save', data);
}

/**
 * Cât se mai poate rambursa pe o vizită. ⚠️ **În lire, nu în penny** — ruta împarte la 100 chiar
 * înainte de a răspunde, deși socotește în penny tocmai ca să nu piardă bani la rotunjire.
 */
export function getRefundInfo(params: { jobId: string; excludePaymentId?: string }) {
  const { jobId, ...query } = params;
  return apiGet<{ totalActiveReceived: number; totalActiveRefunded: number; maxRefundable: number }>(
    `/payments/refund-info/${jobId}`, query,
  );
}

/** ⚠️ O plată nu se șterge, se **stinge** — rândul rămâne, cu motivul scris. */
export function voidRestorePayment(params: { paymentId: string; action: 'void' | 'restore'; correctionNotes: string }) {
  const { paymentId, ...body } = params;
  return apiPost<{ success: true; id: string }>(`/payments/${paymentId}/void-restore`, body);
}

// ─── Cheltuieli ─────────────────────────────────────────────────────

/** 🔴 §47 (Sesiunea 154) — paginată și sortată de server. */
export type ExpenseListPage = { records: ExpenseRecord[]; total: number; page: number; pageSize: number };

/**
 * 🆕 §25 „Expense export" (Sesiunea 155) — lista de cheltuieli, ca fișier.
 *
 * ⚠️ **`POST`, ca celelalte exporturi** (ACHU-779): metoda e poarta pentru contul „doar citire".
 * 🔴 Se trimite **căutarea de pe ecran**, deci fișierul conține exact ce se vede filtrat — nu tot
 * tabelul, și nu doar pagina.
 */
export function exportExpenses(params: { search?: string; sortBy?: string; sortDir?: string } = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][],
  ).toString();
  return apiDownloadPost(`/expenses/export${qs ? `?${qs}` : ''}`, {}, 'ACHU-expense-list.csv');
}

export function getExpenses(params: {
  search?: string; sortBy?: string; sortDir?: 'asc' | 'desc'; page?: number; pageSize?: number;
}) {
  return apiGet<ExpenseListPage>('/expenses', params);
}

/**
 * 🔴 **ACHU-750 (owner, 19/08/2026) — cheltuielile AU acum ramura de duplicat, ca plățile și clienții.**
 *
 * 📜 **ISTORIC, adevărat până pe 19/08/2026.** Aici scria: *„Cheltuielile NU au ramura de duplicat a
 * celorlalte două: un bon identic e REFUZAT, cu eroare, fiindcă acolo duplicatul înseamnă aceeași
 * hârtie scanată de două ori."* ⛔ **Era o scăpare descrisă ca o alegere** — două bonuri identice în
 * aceeași zi sunt perfect normale (două parcări de £5), iar al doilea nu se putea înregistra deloc.
 *
 * ⚠️ Iar scanerul avea deja un ecran de confirmare pe care **nimeni nu îl putea deschide**. Motivul
 * întreg: `backend/src/lib/expenseDuplicateOverride.ts`.
 */
export type SaveExpenseResult =
  | ({ success: true; id: string; duplicates?: undefined } & AuditWarning)
  /** ⚠️ `auditWarning?: undefined` explicit: un conflict raportat nu a scris nimic, deci nu are ce audita. */
  | { success: false; id: string; duplicateConflict: true; duplicates: ExpenseDuplicate[]; auditWarning?: undefined };

export function saveExpense(data: Record<string, unknown>) {
  return apiPost<SaveExpenseResult>('/expenses/save', data);
}

export function voidRestoreExpense(params: { expenseId: string; action: 'void' | 'restore'; correctionNotes: string }) {
  const { expenseId, ...body } = params;
  return apiPost<{ success: true; id: string } & AuditWarning>(`/expenses/${expenseId}/void-restore`, body);
}

