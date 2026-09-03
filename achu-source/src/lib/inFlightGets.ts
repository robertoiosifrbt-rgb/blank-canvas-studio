/**
 * §47 „Prevent duplicate API calls" (Sesiunea 154) — DOUĂ CERERI IDENTICE ÎN AER, UN SINGUR DRUM.
 *
 * ─── Ce NU rezolvă asta, fiindcă era deja rezolvat ──────────────────────────
 * ⚠️ **Nu tastarea.** Fiecare căsuță de căutare are deja `useDebouncedCallback(…, 300)`, deci
 * apăsările pe taste nu produc o cerere fiecare. ⛔ Nici răspunsurile venite în altă ordine:
 * `useTrackedRequest` ține un număr de secvență și aruncă răspunsul vechi.
 *
 * ─── Ce rezolvă ─────────────────────────────────────────────────────────────
 * Două cereri **identice**, pornite cât timp prima e încă în aer: un ecran montat de două ori (React
 * în StrictMode face exact asta), două componente care cer aceeași listă, un om care apasă
 * „Refresh" de două ori. 🔴 A doua cerere nu aduce nimic nou — plătește un drum dus-întors și încă o
 * citire în baza de date pentru un răspuns pe care primul îl aduce oricum.
 *
 * ─── 🔴 NUMAI CITIRI. NICIODATĂ SCRIERI. ────────────────────────────────────
 * ⛔ Un `POST` trimis de două ori **nu e o cerere duplicată, sunt două acțiuni**: două plăți, două
 * vizite, două mesaje. A le uni ar însemna ca aplicația să înghită tăcut o intenție reală a
 * omului — cel mai rău fel de defect, fiindcă ecranul arată succes.
 * ⚠️ Scrierile au deja apărarea LOR, și e alta: jetoanele de idempotență (ACHU-116), unde SERVERUL
 * hotărăște că a doua cerere e aceeași cu prima. 🔴 Aici, în browser, nu se poate ști asta.
 *
 * ─── ⚠️ Ce trebuie știut despre răspunsul întors ────────────────────────────
 * Cei doi apelanți primesc **același obiect**, nu două copii. ⛔ O copiere adâncă a unei liste
 * întregi la fiecare cerere ar fi un cost, nu o economie. ⚠️ Deci un răspuns se citește, nu se
 * modifică pe loc — regulă pe care codul o respectă deja (`sortRecords` întoarce o copie), și pe care
 * un test de mai jos o face vizibilă în loc să o lase o presupunere.
 */

/** Cererile în aer, pe cheie. ⚠️ Rândul se scoate la încheiere, reușită sau nu. */
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Cheia unei citiri: calea plus interogarea, cu **cheile sortate**.
 *
 * 🔴 Sortarea nu e cosmetică: `{ from, to }` și `{ to, from }` sunt aceeași cerere, iar fără sortare
 * ar fi fost două chei, deci două drumuri — adică exact lucrul pe care fișierul îl repară, ratat pe
 * cazul cel mai obișnuit (două ecrane care compun aceiași parametri în altă ordine).
 *
 * ⚠️ `undefined` se sare, ca la construirea interogării: un parametru nedat nu e un parametru dat gol.
 */
export function getKey(path: string, query?: Record<string, unknown>): string {
  if (!query) return path;
  const parts = Object.keys(query)
    .sort()
    .filter(k => query[k] !== undefined)
    .map(k => `${k}=${String(query[k])}`);
  return parts.length === 0 ? path : `${path}?${parts.join('&')}`;
}

/**
 * Pornește citirea, sau se agață de una identică deja în aer.
 *
 * ⚠️ **Curățarea se face în `finally`**, deci și pe eșec: o cerere căzută care ar rămâne în hartă ar
 * face ca fiecare încercare următoare să primească **aceeași eroare**, la nesfârșit, fără să mai
 * atingă rețeaua. 🔴 Un „cache" care ține eșecuri e mai rău decât niciunul.
 */
export function dedupeGet<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const started = run().finally(() => { inFlight.delete(key); });
  inFlight.set(key, started);
  return started;
}

/** Câte citiri sunt în aer. ⚠️ Numai pentru teste — nicio decizie de aplicație nu o citește. */
export function inFlightCount(): number {
  return inFlight.size;
}

