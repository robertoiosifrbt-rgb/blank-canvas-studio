/**
 * §13 „Standard working days" (Sesiunea 158) — ZILELE, PENTRU ECRAN.
 *
 * ⚠️ **De ce o a doua copie a numerotării, când serverul o are pe a lui:** ecranul are nevoie de
 * *etichete* și de o *ordine de desenat*, serverul de *validare* și de *citire*. 🔴 Ce s-ar fi putut
 * desincroniza — ce înseamnă un număr — e chiar ce nu se poate schimba: 1 e luni în ISO, peste tot.
 * ⛔ Regula (ce e valid, ce se refuză) rămâne o singură dată, pe server: aici nu se validează nimic.
 *
 * ⚠️ **Luni prima, nu duminică.** Firma lucrează pe săptămâna britanică, iar o săptămână desenată
 * care începe altfel decât cea din capul omului se citește greșit exact la marginea weekendului.
 */

export type WorkingDay = { value: number; short: string; long: string };

export const WORKING_DAYS: WorkingDay[] = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 7, short: 'Sun', long: 'Sunday' },
];

/**
 * Textul din bază → bifele de pe ecran.
 *
 * ⚠️ Ce nu se poate citi devine **nicio bifă**, nu o bifă greșită: un formular deschis pe un rând
 * stricat trebuie să arate gol, ca omul să-l poată rescrie, nu să pară că e altceva.
 */
export function daysFromText(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const out: number[] = [];
  for (const part of raw.split(',')) {
    const p = part.trim();
    if (!/^[1-7]$/.test(p)) continue;
    const n = Number(p);
    if (!out.includes(n)) out.push(n);
  }
  return out.sort((a, b) => a - b);
}

/** Bifele → textul trimis serverului. ⛔ Nicio bifă = `''`, adică „șterge ce era scris". */
export function daysToText(days: number[]): string {
  return [...new Set(days)].sort((a, b) => a - b).join(',');
}

/** Bifat/debifat, fără să conteze ordinea clicurilor. */
export function toggleDay(days: number[], value: number): number[] {
  return days.includes(value) ? days.filter(d => d !== value) : [...days, value].sort((a, b) => a - b);
}

