/**
 * Wrapperele de rute pentru Backup — mutate din `endpoints.ts` în ACHU-396.
 *
 * ⚠️ MUTATE, NU ADĂUGATE AICI PE LÂNGĂ. Felia care a adăugat parola pe fișierul de
 * backup a spart clichetul de mărime al lui `endpoints.ts` cu 19 rânduri, iar
 * regula (AGENT_RULES §7) spune ce se face atunci: se extrage ce ai adăugat, nu se
 * ridică plafonul. Backup-ul era candidatul evident — un grup coerent de șase
 * funcții și două tipuri, cu un singur consumator (`BackupPage`).
 *
 * `endpoints.ts` re-exportă tot ce e aici, deci niciun import existent nu s-a
 * schimbat.
 */
import { apiGet, apiGetText, apiPost } from './apiClient';

// ─── Backup (Sesiunea 29) ───────────────────────────────────────────

/**
 * ACHU-396 — the export as raw TEXT, because the file may be ciphertext.
 *
 * ⛔ This replaced an `exportFullBackup()` that parsed the body as JSON. It was
 * removed rather than left beside this one: nothing called it any more, and an
 * unused wrapper for the export route is precisely the kind of thing ACHU-392
 * exists to catch — a capability with no caller, which reads as available.
 */
export function exportFullBackupText() {
  return apiGetText('/backup/export');
}

/**
 * ⚠️ ACHU-401 (felia 15) — `stale` e calculat pe SERVER, nu de ecran: șapte zile, „destul de
 * lung cât să nu bată la cap, destul de scurt cât o pierdere să rămână mică". ⛔ Un ecran care
 * și-ar calcula singur pragul l-ar putea contrazice pe al doilea ecran.
 */
export type BackupStatus = {
  lastBackupAt: string | null;
  lastBackupBy: string | null;
  /** `null` = nu s-a făcut niciodată vreunul. */
  daysSince: number | null;
  stale: boolean;
};

export function getBackupStatus() {
  return apiGet<BackupStatus>('/backup/status');
}

/**
 * Fișierele NU sunt în backup-ul de bază de date — chitanțele stau în Supabase Storage, alt
 * serviciu. Arhiva se face în browser, fiindcă backendul are doar cheia anonimă și nu poate citi
 * un bucket privat.
 */
export type BackupReceipt = {
  expenseId: number;
  /** `YYYY-MM-DD`. */
  expenseDate: string;
  supplier: string | null;
  amount: number;
  /** Calea în bucket, nu un URL public — se semnează în browser, cu sesiunea omului. */
  path: string | null;
};

export function getBackupReceipts() {
  return apiGet<{ receipts: BackupReceipt[] }>('/backup/receipts');
}

/**
 * 🔴 ACHU-675 — TOATE fișierele aplicației, nu doar bonurile.
 *
 * ⛔ `/receipts` de deasupra acoperea **un** bucket din patru. Pozele de la vizite, fișierele
 * caselor, pozele din cererile de ofertă și certificatele medicale nu erau nicăieri: nici în
 * exportul de tabele, nici în arhivă. Motivele: `backend/src/lib/backupFileManifest.ts`.
 */
export type BackupFileEntry = {
  bucket: string;
  path: string;
  /** Numele sub care intră în arhivă — compus pe SERVER, ca să lege fișierul de rândul lui. */
  name: string;
  kind: 'receipt' | 'job-photo' | 'property-file' | 'quote-photo' | 'fit-note';
  /** O propoziție pentru `CONTENTS.txt`, citită de un om care caută un anume fișier. */
  describes: string;
};

export function getBackupFiles() {
  return apiGet<{ files: BackupFileEntry[]; note: string }>('/backup/files');
}

/**
 * ACHU-496 — what a restore would do, before doing it. Read-only on the server:
 * no writes, no confirmation phrase, safe to call as often as you like.
 *
 * Typed rather than `any`, unlike its neighbours here: this shape is read field
 * by field on a screen where getting a number wrong means telling somebody
 * their data is safe when it is not.
 */
export type RestorePreviewConflict = { table: string; id: string; fields: string[] };

export type RestorePreview = {
  formatVersionOk: boolean;
  totalInFile: number;
  totalWouldInsert: number;
  totalIdentical: number;
  totalWouldConflict: number;
  databaseEmpty: boolean;
  perTable: { table: string; inFile: number; wouldInsert: number; identical: number; wouldConflict: number }[];
  conflicts: RestorePreviewConflict[];
  unverifiable: string[];
};

/**
 * ACHU-396 — exactly one of `backup` (plain JSON) or `encryptedFile` (ciphertext
 * the browser cannot read). Both optional in the type because which one is
 * present depends on the file the person chose; the backend refuses a body with
 * neither.
 */
export function previewRestore(params: { backup?: unknown; encryptedFile?: string }) {
  return apiPost<{ preview: RestorePreview }>('/backup/restore/preview', params);
}

/**
 * 🔴 ACHU-495, și de-aia forma asta e tipizată, nu `any`: `success` a fost cândva hard-codat
 * `true`. Însemna „cererea nu a aruncat", dar se citea ca **„datele tale sunt înapoi"** — iar o
 * fuziune care n-a restaurat nimic răspundea `success: true` lângă `verified: false`. Acum
 * amândouă vin din aceeași verificare.
 *
 * ⚠️ `missing` și `conflicts` sunt numărate separat fiindcă cer remedii diferite: un rând lipsă
 * se poate re-insera, unul în conflict e o decizie despre a cui valoare e corectă. ⛔ Doar
 * id-uri și nume de câmpuri — niciodată valori, care ar copia datele restaurate într-un răspuns.
 */
export type RestoreResult = {
  success: boolean;
  restored: Record<string, number>;
  totalRestored: number;
  verified: boolean;
  /** `empty` = egalitate strictă pe tabel; `merge` = prezent ȘI neschimbat. */
  verificationMode: 'empty' | 'merge';
  mismatches: string[];
  missing: { table: string; id: string }[];
  conflicts: RestorePreviewConflict[];
};

export function restoreFromBackup(params: {
  backup?: unknown; encryptedFile?: string; confirmation: string; allowNonEmpty?: boolean;
  /** Required by the backend, and must be DIFFERENT from `confirmation`, whenever
   * `allowNonEmpty` is true — merging into a database that already has data is a
   * separate, deliberate act. No screen in this app sets `allowNonEmpty` today. */
  mergeConfirmation?: string;
}) {
  return apiPost<RestoreResult>('/backup/restore', params);
}

// ─── Retenția cererilor de ofertă (ACHU-218) ────────────────────────────
// ⚠️ Aici, nu în `endpoints.ts`: fișierul acela e la clichetul lui de mărime, iar
// regula (AGENT_RULES §7) spune să extragi, nu să ridici plafonul. Retenția stă
// lângă backup fiindcă amândouă sunt „păstrarea datelor", și amândouă au un singur
// consumator.

export type RetentionStatus = {
  retentionDays: number;
  lastRunAt: string | null;
  lastRunSummary: string | null;
};

export function getRetentionStatus() {
  return apiGet<RetentionStatus>('/quote-requests/retention/status');
}

export type RetentionRunResult = {
  deleted: number;
  skipped: { quoteRequestId: number | string; reason: string }[];
  cutoff: string;
};

/** ⛔ Aceeași revizie pe care o rulează ceasul — nu un „mod manual" care ar putea divergea. */
export function runRetentionReview() {
  return apiPost<RetentionRunResult>('/quote-requests/retention/run');
}

