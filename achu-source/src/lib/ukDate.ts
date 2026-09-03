/**
 * UK business-date utilities using Europe/London timezone.
 * Handles GMT/BST automatically — never uses hardcoded UTC offsets.
 * FIX 5 — ACHU-011: All period calculations are Europe/London safe.
 *
 * Backend: import from '../lib/ukDate'
 * Frontend: import from '@/lib/ukDate'
 */

const TZ = 'Europe/London';

/** Format a Date as YYYY-MM-DD in Europe/London */
function fmtLondon(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

/** Parse YYYY-MM-DD into { year, month, day } integers */
function parseParts(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m, day: d };
}

/** Create a UTC Date from date parts at noon (avoids DST edge-case shifts) */
function dateFromParts(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

/** Pad a number to 2 digits */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format parts as YYYY-MM-DD */
function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// ─── Public API ───────────────────────────────────────────

/**
 * Returns the current date in Europe/London as a YYYY-MM-DD string.
 * Safe for comparing against date-only database fields.
 */
export function ukToday(): string {
  return fmtLondon(new Date());
}

/**
 * Returns the current time in Europe/London as HH:MM (24h).
 */
export function ukTimeNow(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

/**
 * Returns the current date+time in Europe/London as "YYYY-MM-DD HH:MM:SS".
 */
export function ukNowStamp(): string {
  const d = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const p: Record<string, string> = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/**
 * Get the current Europe/London date parts { year, month, day }.
 */
export function ukTodayParts(): { year: number; month: number; day: number } {
  return parseParts(ukToday());
}

/**
 * Add (or subtract) calendar days from a YYYY-MM-DD string.
 */
export function addDays(dateStr: string, days: number): string {
  const { year, month, day } = parseParts(dateStr);
  const d = dateFromParts(year, month, day);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Month start for a given YYYY-MM-DD or current Europe/London date.
 */
export function monthStart(dateStr?: string): string {
  const { year, month } = dateStr ? parseParts(dateStr) : ukTodayParts();
  return ymd(year, month, 1);
}

/**
 * Month end for a given YYYY-MM-DD or current Europe/London date.
 */
export function monthEnd(dateStr?: string): string {
  const { year, month } = dateStr ? parseParts(dateStr) : ukTodayParts();
  // Day 0 of next month = last day of current month
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return ymd(year, month, lastDay);
}

/**
 * Quarter start (Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec).
 */
export function quarterStart(dateStr?: string): string {
  const { year, month } = dateStr ? parseParts(dateStr) : ukTodayParts();
  const qMonth = Math.floor((month - 1) / 3) * 3 + 1;
  return ymd(year, qMonth, 1);
}

/**
 * Quarter end.
 */
export function quarterEnd(dateStr?: string): string {
  const { year, month } = dateStr ? parseParts(dateStr) : ukTodayParts();
  const qEndMonth = Math.floor((month - 1) / 3) * 3 + 3;
  const lastDay = new Date(Date.UTC(year, qEndMonth, 0)).getUTCDate();
  return ymd(year, qEndMonth, lastDay);
}

/**
 * Calendar year start.
 */
export function yearStart(dateStr?: string): string {
  const { year } = dateStr ? parseParts(dateStr) : ukTodayParts();
  return ymd(year, 1, 1);
}

/**
 * Calendar year end.
 */
export function yearEnd(dateStr?: string): string {
  const { year } = dateStr ? parseParts(dateStr) : ukTodayParts();
  return ymd(year, 12, 31);
}

/**
 * UK tax year boundaries.
 * Tax year starts 6 April and ends 5 April of the following year.
 *
 * On 5 April 2027: start = 2026-04-06, end = 2027-04-05
 * On 6 April 2027: start = 2027-04-06, end = 2028-04-05
 */
export function ukTaxYear(dateStr?: string): { start: string; end: string } {
  const { year, month, day } = dateStr ? parseParts(dateStr) : ukTodayParts();
  const afterApril6 = month > 4 || (month === 4 && day >= 6);
  const startYear = afterApril6 ? year : year - 1;
  return {
    start: ymd(startYear, 4, 6),
    end: ymd(startYear + 1, 4, 5),
  };
}

/**
 * 🔴 ACHU-746 — CE POATE INTRA ÎNTR-UN `<input type="date">`, și de ce trebuie tăiat.
 *
 * Rutele de listă își construiesc răspunsul cu `...rând` peste rândul Prisma, deci o coloană
 * `@db.Date` ajunge în browser ca **timestamp întreg** — „2026-06-01T00:00:00.000Z" — deși nu
 * are oră în ea. Un `<input type="date">` **aruncă** orice nu e exact `YYYY-MM-DD` (algoritmul
 * de sanitizare din specificația HTML, nu un capriciu de browser), deci câmpul apare **gol**,
 * iar salvarea cade pe „…date are required" pentru o înregistrare care evident are o dată.
 *
 * ⚠️ **Tăiat ca ȘIR, nu parsat:** `new Date(...)` urmat de formatare reintroduce un fus orar,
 * iar la vest de UTC transformă miezul nopții UTC în **ziua precedentă** — o cheltuială care se
 * mută singură cu 24 de ore înapoi e mult mai rău decât un câmp gol.
 *
 * ⛔ **Normalizat la INTRAREA în ecran, nu în API** (decizia de la ACHU-228, păstrată): un
 * dialog se deschide din mai multe pagini, deci o reparație la intrare acoperă toți apelanții,
 * prezenți și viitori. Una în API ar repara un producător și ar lăsa componenta tot
 * încrezătoare în ce primește.
 */
export function toDateInputValue(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '';
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '';
}

/**
 * Sunday-start week boundaries for a given date (or current Europe/London date).
 * Returns { start: Sunday YYYY-MM-DD, end: Saturday YYYY-MM-DD }.
 */
export function weekBounds(dateStr?: string): { start: string; end: string } {
  const todayStr = dateStr ?? ukToday();
  const { year, month, day } = parseParts(todayStr);
  const d = dateFromParts(year, month, day);
  const dow = d.getUTCDay(); // 0=Sun … 6=Sat

  const sunday = new Date(d);
  sunday.setUTCDate(sunday.getUTCDate() - dow);
  const saturday = new Date(d);
  saturday.setUTCDate(saturday.getUTCDate() + (6 - dow));

  return {
    start: ymd(sunday.getUTCFullYear(), sunday.getUTCMonth() + 1, sunday.getUTCDate()),
    end: ymd(saturday.getUTCFullYear(), saturday.getUTCMonth() + 1, saturday.getUTCDate()),
  };
}

