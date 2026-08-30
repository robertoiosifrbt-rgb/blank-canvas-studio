/**
 * ACHU Business Hub — Centralised Validation Constants & Helpers (ACHU-045)
 * 
 * Single source of truth for all field length limits, format validators,
 * normalisation helpers, and shared business rules.
 * Import from '../lib/validation' (backend) or '@/lib/validation' (frontend).
 */

// ─── Field Length Limits ───────────────────────────────────────────

export const LIMITS = {
  customerName: 200,
  supplierName: 200,
  address: 500,
  phone: 30,
  email: 254,
  service: 200,
  description: 500,
  instructions: 2000,
  notes: 5000,
  documentNumber: 100,
  completionNotes: 5000,
  correctionNotes: 2000,
  externalReference: 200,
  paidBy: 200,
  assignmentRole: 100,
  firstName: 100,
  lastName: 100,
  currency: 10,
  settingsKey: 100,
  quoteNumber: 100,
  globalSearch: 200,
} as const;

// ─── Date Validation ───────────────────────────────────────────────

/** Validate YYYY-MM-DD format AND that it's a real calendar date */
export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// ─── Time Validation ───────────────────────────────────────────────

/** Validate HH:MM 24-hour format AND that it's a real time (00:00–23:59) */
export function isValidTime(timeStr: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return false;
  const [h, m] = timeStr.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/** Compare two valid HH:MM time strings. Returns negative if a < b, 0 if equal, positive if a > b */
export function compareTimes(a: string, b: string): number {
  return a.localeCompare(b);
}

// ─── Effective Time Range Validation (ACHU-127) ────────────────────

/**
 * Validate the effective time range for a job, considering partial updates.
 * Returns null if valid, or an error message string.
 *
 * For updates, pass the existing stored values so the effective interval
 * is computed as: effectiveStart = incomingStart ?? existingStart, etc.
 * For creates, omit existingStart/existingFinish.
 */
export function validateEffectiveTimeRange(
  incomingStart: string | undefined,
  incomingFinish: string | undefined,
  existingStart?: string,
  existingFinish?: string,
): string | null {
  if (incomingStart && !isValidTime(incomingStart)) return 'Start time must be in HH:MM format (00:00–23:59).';
  if (incomingFinish && !isValidTime(incomingFinish)) return 'Finish time must be in HH:MM format (00:00–23:59).';
  const effectiveStart = (incomingStart?.trim() || undefined) ?? existingStart ?? undefined;
  const effectiveFinish = (incomingFinish?.trim() || undefined) ?? existingFinish ?? undefined;
  if (effectiveStart && effectiveFinish && isValidTime(effectiveStart) && isValidTime(effectiveFinish) && compareTimes(effectiveFinish, effectiveStart) < 0) {
    return 'Finish time cannot be before start time.';
  }
  return null;
}

// ─── Email ──────────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= LIMITS.email;
}

/** Normalize email: trim + lowercase */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ─── Phone ──────────────────────────────────────────────────────────

/** Normalize phone: trim, collapse spaces, remove non-digit/non-+ chars except spaces */
export function normalizePhone(phone: string | null | undefined): string | undefined {
  if (phone == null) return undefined;
  const trimmed = phone.trim().replace(/\s+/g, ' ');
  return trimmed === '' ? undefined : trimmed;
}

// ─── Name ───────────────────────────────────────────────────────────

/** Normalize name: trim, collapse spaces, preserve casing */
export function normalizeName(name: string | null | undefined, maxLength: number): string | undefined {
  if (name == null) return undefined;
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed === '') return undefined;
  if (trimmed.length > maxLength) return undefined; // caller should reject, not truncate
  return trimmed;
}

// ─── Address ────────────────────────────────────────────────────────

/** Normalize address: trim, collapse spaces */
export function normalizeAddress(address: string | null | undefined): string | undefined {
  if (address == null) return undefined;
  const trimmed = address.trim().replace(/\s+/g, ' ');
  return trimmed === '' ? undefined : trimmed;
}

// ─── Free Text ──────────────────────────────────────────────────────

/** Normalize free text: trim, collapse repeated spaces (preserves newlines) */
export function normalizeFreeText(value: string | null | undefined, maxLength: number): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim().replace(/[^\S\n]+/g, ' ');
  if (trimmed === '') return undefined;
  if (trimmed.length > maxLength) return undefined; // caller should reject
  return trimmed;
}

// ─── Supplier ───────────────────────────────────────────────────────

/** Normalize supplier for duplicate detection (lowercase, collapsed spaces) */
export function normalizeSupplier(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

// ─── String Sanitisation ───────────────────────────────────────────

/** Trim and collapse spaces. Returns undefined for empty/null/undefined.
 *  Does NOT silently truncate — use for fields where over-limit was already rejected. */
export function sanitize(value: string | null | undefined, maxLength: number): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed === '') return undefined;
  return trimmed.slice(0, maxLength);
}

/** Strict sanitize that throws if over limit */
export function sanitizeStrict(value: string | null | undefined, maxLength: number, fieldName: string): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed === '') return undefined;
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength} characters.`);
  }
  return trimmed;
}

// ─── Monetary ──────────────────────────────────────────────────────

/** Round to 2 decimal places for exact monetary comparison */
export function monetaryRound(n: number): number {
  return Math.round(n * 100) / 100;
}

/** ACHU-123: Check if a number has at most 2 decimal places (valid for monetary amounts) */
export function isValidMoneyAmount(n: number): boolean {
  if (!Number.isFinite(n)) return false;
  return Math.abs(Math.round(n * 100) / 100 - n) < 1e-9;
}

// ─── Shared Business Constants (ACHU-092) ──────────────────────────

/** Valid customer types — single source of truth for saveCustomer + converter */
export const VALID_CUSTOMER_TYPES: string[] = ['Domestic', 'Commercial', 'Airbnb', 'Landlord', 'Other'];

/**
 * 🔴 ACHU-798 (Sesiunea 158) — **AICI AU FOST DOUĂ LISTE DE STĂRI. S-AU ȘTERS.**
 *
 * ⚠️ `VALID_JOB_STATUSES` și `VALID_CUSTOMER_STATUSES` existau și pe frontend, copiate din server.
 * ⛔ Cea de vizite era **învechită**: îi lipsea „Completion Review", starea în care intră orice
 * vizită pe care curățătorul a marcat-o gata. 🔴 **Nefolosită de nimeni**, deci nimic nu se comporta
 * greșit — dar primul ecran care ar fi validat o stare pe ea ar fi respins o vizită perfect valabilă,
 * fără ca cineva să poată spune de ce.
 *
 * ⚠️ **Frontendul NU validează stări** — serverul o face, iar el are lista vie
 * (`backend/src/lib/validation.ts`). O a doua listă lângă ecran nu adaugă nicio pază; adaugă doar un
 * loc care se poate învechi. 🔴 Ștearsă la hotărârea lui Roberto, 28/08/2026.
 *
 * ⛔ Cele două de mai jos **rămân**, și diferența e chiar miezul: ele **umplu liste derulante**
 * (`QuoteFormDialog`, `PublicQuoteRequestPage`), deci ecranul chiar are nevoie de ele. O listă de
 * ales dintre valori nu e o listă de validat valori.
 *
 * 📜 Paza care ține hotărârea: `validationNoStatusList.test.ts` citește **sursa** acestui fișier.
 */

/** See backend/prisma/schema.prisma QuoteRequest.propertyType comment. */
export const VALID_PROPERTY_TYPES: string[] = ['House', 'Flat', 'Studio', 'Office', 'Commercial Unit', 'Other'];

/**
 * 🔴 §6 „Urgency" (Sesiunea 159) — opțiunile din formular, cuvânt cu cuvânt ca pe server.
 *
 * ⚠️ **De ce lista e și aici, deși ACHU-798 a șters două liste de pe ecran:** acelea **validau**
 * ceva ce serverul valida oricum, deci nu adăugau nicio pază — doar un loc care se putea învechi.
 * ⛔ Asta nu validează nimic: e mulțimea de **opțiuni** pe care le vede omul, iar un formular nu
 * poate oferi ce nu știe. 🔴 Ce ține cele două liste împreună e o pază care citește amândouă
 * fișierele (`validationSharedLists.test.ts`), nu un comentariu.
 */
export const VALID_QUOTE_URGENCIES: string[] = [
  'As soon as possible', 'Within the next week', 'Within the next month', 'No particular rush',
];

/**
 * ⛔ **ȘTEARSĂ în Sesiunea 146 (§8).** Lista serviciilor stă acum în tabelul `services`, într-un
 * singur loc, iar rutele o citesc prin `backend/src/lib/serviceCatalogue.ts`.
 *
 * 🔴 Vectorul ăsta exista de DOUĂ ori — aici și, copiat literă cu literă, în celălalt
 * `validation.ts` — deci cine adăuga un serviciu trebuia să-și amintească de amândouă.
 */

// ─── Pagination Validation (ACHU-080) ──────────────────────────────

/** Pagination validation error — carries BAD_REQUEST code for the framework to return 400 */
export class PaginationValidationError extends Error {
  readonly code = 'BAD_REQUEST' as const;
  constructor(message: string) {
    super(message);
    this.name = 'PaginationValidationError';
  }
}

/** Max allowed offset for pagination — prevents abuse */
const MAX_PAGINATION_OFFSET = 100_000;

/**
 * Validate a pagination offset: must be integer >= 0 and <= MAX_PAGINATION_OFFSET.
 * Rejects NaN, Infinity, negatives, decimals, above max. Never clamps/rounds/coerces.
 */
export function validateOffset(value: number | undefined, fieldName: string): number {
  if (value === undefined || value === null) return 0;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > MAX_PAGINATION_OFFSET) {
    throw new PaginationValidationError(`${fieldName} must be a non-negative integer (max ${MAX_PAGINATION_OFFSET}).`);
  }
  return value;
}

/**
 * Validate a pagination limit: must be integer >= 1 and <= maxAllowed.
 * Rejects NaN, Infinity, negatives, zero, decimals, above max. Never clamps/rounds/coerces.
 */
export function validateLimit(value: number | undefined, fieldName: string, defaultVal: number, maxAllowed: number): number {
  if (value === undefined || value === null) return defaultVal;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1 || value > maxAllowed) {
    throw new PaginationValidationError(`${fieldName} must be an integer between 1 and ${maxAllowed}.`);
  }
  return value;
}

// ─── Notes Audit Helper (ACHU-075) ─────────────────────────────────

/** Summarise a notes value for audit — truncate large values, redact if needed */
export function summariseNotes(val: string | null | undefined): string {
  if (val == null || val === '') return '';
  const trimmed = val.trim();
  if (trimmed.length <= 100) return trimmed;
  return trimmed.slice(0, 97) + '…';
}

// ─── Custom Date Range Validation (ACHU-078) ──────────────────────

/**
 * Validate a custom date range for the Dashboard.
 * Returns null if valid, or an error message string.
 * Shared between frontend (Dashboard.tsx) and backend (getDashboard.ts).
 */
export function validateDateRange(startDate: string | undefined, endDate: string | undefined): string | null {
  if (!startDate || !endDate) return 'Both start and end dates are required.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return 'Start date must be in YYYY-MM-DD format.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return 'End date must be in YYYY-MM-DD format.';
  const [sy, sm, sday] = startDate.split('-').map(Number);
  const sdt = new Date(sy, sm - 1, sday);
  if (sdt.getFullYear() !== sy || sdt.getMonth() !== sm - 1 || sdt.getDate() !== sday) return 'Start date is not a valid calendar date.';
  const [ey, em, eday] = endDate.split('-').map(Number);
  const edt = new Date(ey, em - 1, eday);
  if (edt.getFullYear() !== ey || edt.getMonth() !== em - 1 || edt.getDate() !== eday) return 'End date is not a valid calendar date.';
  if (startDate > endDate) return 'Start date cannot be after end date.';
  return null;
}

// ─── Upload Size Limits ────────────────────────────────────────────

/** Max PDF upload size in bytes — shared by frontend and backend */
export const MAX_PDF_BYTES = 14 * 1024 * 1024;

/** Max image upload size in bytes */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

// ─── Linked Record ID extraction ───────────────────────────────────

/** Extract a single ID from a linked record field (string | string[] | undefined) */
export function extractId(v: string[] | string | undefined | null): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v || null;
}

// ─── ACHU-017: Deterministic Duplicate Signatures ──────────────────

/**
 * Compute a deterministic signature for a Payment from its material fields.
 * Used with bulkCreate matchOn to prevent concurrent duplicate creation.
 */
export function computePaymentSignature(
  jobId: string, date: string, amount: number, status: string, externalRef?: string
): string {
  const parts = ['pay', jobId, date, String(monetaryRound(amount)), status];
  if (externalRef) parts.push(externalRef);
  return parts.join(':');
}

/**
 * Compute a deterministic signature for an Expense from its material fields.
 * Used with bulkCreate matchOn to prevent concurrent duplicate creation.
 */
export function computeExpenseSignature(
  date: string, supplier: string, amount: number
): string {
  return ['exp', date, normalizeSupplier(supplier), String(monetaryRound(amount))].join(':');
}

