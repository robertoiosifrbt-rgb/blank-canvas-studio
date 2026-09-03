/**
 * §41 „Bulk operations" (Sesiunea 148) — **asignarea unui curățător pe mai multe vizite.**
 *
 * ⛔ **Fișier propriu, nu în catalogul `endpoints.ts`:** acela e exact pe clichetul lui de mărime,
 * iar regula spune ce se face atunci — iese cod, cifra nu urcă (`AGENT_RULES` §7).
 *
 * 🔴 **Două funcții, nu una cu un steag.** Previzualizarea nu scrie nimic, aplicarea scrie — iar
 * două nume diferite fac imposibil să apeși din greșeală pe cea care scrie.
 */
import { apiPost, apiDownloadPost } from './apiClient';

/** Un rând din plan. ⚠️ Eticheta vine de la SERVER: ecranul nu știe care regulă a decis. */
export type BulkAssignLine = {
  id: string;
  jobId: number | null;
  verdict: 'assign' | 'alreadyAssigned' | 'missing' | 'cancelled' | 'failed';
  label: string;
  /** Preferința clientului („a cerut să nu-l trimitem") — nu oprește, dar se vede înainte. */
  warning?: string;
};

export type BulkAssignPreview = {
  cleanerName: string;
  lines: BulkAssignLine[];
  summary: { total: number; toAssign: number; skipped: number; warnings: number };
};

export type BulkAssignResult = {
  cleanerName: string;
  lines: BulkAssignLine[];
  summary: { total: number; assigned: number; skipped: number; failed: number };
};

/** 🔴 Nu scrie nimic. Un POST doar fiindcă o listă de o sută de identificatori nu încape în adresă. */
export function previewBulkAssign(body: { jobIds: string[]; cleanerId: string }) {
  return apiPost<BulkAssignPreview>('/jobs-bulk-assign/preview', body);
}

export function applyBulkAssign(body: { jobIds: string[]; cleanerId: string }) {
  return apiPost<BulkAssignResult>('/jobs-bulk-assign/apply', body);
}

/**
 * ─── 🔴 §41 „Undo where safe" (Sesiunea 150) ────────────────────────────────
 *
 * ⚠️ Se cheamă cu **exact** ce a raportat aplicarea ca asignat, nu cu selecția de pe ecran: între
 * apăsări selecția se poate schimba, iar „undo" trebuie să însemne „ia înapoi ce ai făcut acum",
 * nu „scoate-l de pe ce e bifat".
 */
export type BulkUndoLine = {
  id: string;
  jobId: number | null;
  verdict: 'undone' | 'nothingToUndo' | 'missing' | 'refused' | 'failed';
  label: string;
};

export type BulkUndoResult = {
  cleanerName: string;
  lines: BulkUndoLine[];
  summary: { total: number; undone: number; refused: number; nothingToUndo: number };
};

export function undoBulkAssign(body: { jobIds: string[]; cleanerId: string }) {
  return apiPost<BulkUndoResult>('/jobs-bulk-assign/undo', body);
}

/**
 * ─── §41 „Bulk export" (Sesiunea 150) ───────────────────────────────────────
 *
 * ⛔ **Nu întoarce date, întoarce un FIȘIER** — deci `apiDownloadPost`, nu `apiPost`: ecranul nu are
 * ce face cu textul CSV, iar numele fișierului îl alege serverul.
 */
export function exportSelectedVisits(body: { jobIds: string[] }) {
  return apiDownloadPost('/jobs-bulk-export', body, 'ACHU-jobs.csv');
}

/**
 * ─── 🆕 §41 „Bulk change status" (Sesiunea 157) ──────────────────────────────
 *
 * Mutarea mai multor vizite într-o altă stare. ⛔ `Completed` și `Cancelled` sunt **refuzate de
 * server**, cu motivul scris (prima are poarta de checklist și se poate rezolva în altă stare;
 * a doua atinge taxa de anulare promisă în scris și anunță clientul). ⚠️ Ecranul **nu** le ascunde
 * dintr-o listă scrisă de mână aici: mesajul serverului e cel care spune de ce, ca să nu existe două
 * variante ale aceleiași reguli.
 */
export type BulkStatusLine = {
  jobId: string;
  jobNumber: number | null;
  customerName: string | null;
  action: 'change' | 'already' | 'missing';
  fromStatus: string | null;
  note?: string;
};

export type BulkStatusPlan = {
  status: string;
  lines: BulkStatusLine[];
  /** `summary` e propoziția gata scrisă de server — ecranul nu recompune cifrele. */
  summary: { changed: number; already: number; missing: number; summary: string };
};

/** 🔴 Nu scrie nimic. */
export function previewBulkStatus(body: { jobIds: string[]; status: string }) {
  return apiPost<BulkStatusPlan>('/jobs-bulk-status/preview', body);
}

export function applyBulkStatus(body: { jobIds: string[]; status: string }) {
  return apiPost<BulkStatusPlan>('/jobs-bulk-status/apply', body);
}

