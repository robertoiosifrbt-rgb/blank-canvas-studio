/**
 * §43 „Tasks și internal workflow" (Sesiunea 144) — SARCINILE DE BIROU.
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `endpoints.ts`** (`AGENT_RULES` §7): acela e un catalog
 * sub urmărire de mărime, iar felia asta aduce un tip întreg plus patru funcții.
 *
 * ⚠️ Tipul se poate scrie de mână fiindcă ruta compune explicit câmpurile (`routes/tasks.ts`,
 * `taskShape`) — nu împrăștie rândul Prisma. Aceeași linie despărțitoare ca la `jobEndpoints.ts`.
 */
import { apiGet, apiPost, apiPut } from './apiClient';

export const TASK_PRIORITIES = ['Low', 'Medium', 'High'] as const;
export type TaskPriority = typeof TASK_PRIORITIES[number];

export type TaskRecord = {
  id: string;
  /** Numărul citit de om — ce se spune la telefon. */
  taskId: number;
  title: string;
  notes: string | null;
  /** `Open` | `Done`. ⚠️ Două stări, deliberat — motivul e în `backend/src/lib/taskPolicy.ts`. */
  status: string;
  priority: string;
  /** `YYYY-MM-DD` sau `null`. ⚠️ O zi, nu un moment: un fus ar muta-o cu una. */
  dueDate: string | null;
  assignedTo: string | null;
  /**
   * 🔴 **Calculat pe SERVER.** „Azi" înseamnă azi în Regatul Unit; un browser deschis în alt fus ar
   * fi colorat altfel aceeași listă.
   */
  overdue: boolean;
  completedBy: string | null;
  completedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  /** ⚠️ Numele clientului, nu doar id-ul: un `cuid` pe un ecran de birou nu spune nimic. */
  customerName: string | null;
  customerId: string | null;
  jobRef: number | null;
  jobId: string | null;
  /**
   * 🔴 §43 „Related quote / payment / complaint / incident" (Sesiunea 150) — **ce anume e de făcut.**
   *
   * ⚠️ Fiecare are **numărul citit de om** (ce se spune la telefon) plus id-ul. ⛔ `requestKind` nu e
   * decor: tabelul cererilor e comun (§28), deci fără el ecranul ar scrie „complaint" pe o cerere de
   * mutare a unei vizite.
   */
  quoteRef: string | null;
  priceQuoteId: string | null;
  paymentRef: number | null;
  paymentId: string | null;
  requestRef: number | null;
  requestKind: string | null;
  customerRequestId: string | null;
  incidentRef: number | null;
  incidentId: string | null;
};

/**
 * 🔴 §43 (Sesiunea 150) — **DESPRE CE e sarcina, când se scrie de pe ecranul lucrului respectiv.**
 *
 * ⚠️ O singură formă, trimisă de `TaskComposer` mai departe: ecranul care deschide formularul știe
 * deja despre ce e vorba, deci nu se cere nimănui să caute din nou.
 */
export type TaskAbout =
  | { kind: 'customer'; id: string; label: string }
  | { kind: 'job'; id: string; label: string }
  | { kind: 'quote'; id: string; label: string }
  | { kind: 'payment'; id: string; label: string }
  | { kind: 'request'; id: string; label: string }
  | { kind: 'incident'; id: string; label: string };

/** ⚠️ Traducerea într-un câmp al cererii, într-un singur loc: patru `if`-uri prin ecrane s-ar despărți. */
export function aboutToLink(about?: TaskAbout | null): Record<string, string> {
  if (!about) return {};
  switch (about.kind) {
    case 'customer': return { customerId: about.id };
    case 'job': return { jobId: about.id };
    case 'quote': return { priceQuoteId: about.id };
    case 'payment': return { paymentId: about.id };
    case 'request': return { customerRequestId: about.id };
    case 'incident': return { incidentId: about.id };
  }
}

export type TaskListResponse = {
  records: TaskRecord[];
  /** ⚠️ Numărate pe server, nu pe ecran: două calcule ale aceleiași cifre se despart. */
  counts: { open: number; mine: number; overdue: number };
};

/** `open` · `mine` · `team` · `overdue` · `done` — aceleași rânduri privite altfel. */
export function getTasks(params: { view?: string; customerId?: string } = {}) {
  return apiGet<TaskListResponse>('/tasks', params);
}

export function createTask(data: {
  title: string; notes?: string; priority?: TaskPriority;
  dueDate?: string | null; assignedTo?: string | null;
  customerId?: string | null; jobId?: string | null;
  // §43 (Sesiunea 150) — toate opționale: o sarcină poate fi despre nimic anume.
  priceQuoteId?: string | null; paymentId?: string | null;
  customerRequestId?: string | null; incidentId?: string | null;
}) {
  return apiPost<{ success: true; id: string; taskId: number; auditWarning?: string }>('/tasks', data);
}

/**
 * ⚠️ **Cheia ABSENTĂ = „nu atinge"; `null` = „șterge"** (`AGENT_RULES` §15). Un ecran care trimite
 * doar câmpul schimbat nu golește restul.
 */
export function updateTask(params: {
  id: string; title?: string; notes?: string | null; priority?: TaskPriority;
  dueDate?: string | null; assignedTo?: string | null; status?: 'Open' | 'Done';
}) {
  const { id, ...body } = params;
  return apiPut<{ success: true; unchanged?: boolean; auditWarning?: string }>(`/tasks/${id}`, body);
}

/** Sarcinile de pe fișa unui client. ⚠️ Rută proprie: fișa nu are nevoie de cifrele echipei. */
export function getTasksForCustomer(params: { customerId: string }) {
  return apiGet<{ records: TaskRecord[] }>(`/tasks/for-customer/${params.customerId}`, {});
}

