/**
 * §47 „Query caching" / „Cache invalidation" (Sesiunea 154) — LISTELE CARE NU SE SCHIMBĂ APROAPE
 * NICIODATĂ NU SE MAI CER LA FIECARE DESCHIDERE DE DIALOG.
 *
 * ─── 🔴 De ce NU se pune un cache peste tot ─────────────────────────────────
 * Un cache general peste toate citirile ar fi părut mai „complet" și ar fi fost mai rău: lista de
 * vizite, plățile, cheltuielile se schimbă în timp ce lucrează trei oameni, iar un ecran care arată
 * o cifră de acum treizeci de secunde **nu se distinge de unul corect**. ⛔ La bani, asta nu e o
 * neplăcere, e o decizie luată pe date vechi.
 *
 * ✅ Deci se ține o **listă scurtă și scrisă** de citiri care sunt, prin natura lor, date de
 * referință: cine sunt curățătorii, ce servicii se vând, ce tarife are calculatorul. ⚠️ Măsurat azi:
 * **17 fișiere** cer lista de curățători, iar catalogul de servicii e cerut de aproape fiecare dialog
 * — de fiecare dată de la zero.
 *
 * ─── 🔴 Regula de invalidare: ORICE scriere golește tot ─────────────────────
 * ⛔ **Nu o hartă „scrierea asta strică citirile alea".** Aceea e exact felul de tabel care se
 * învechește tăcut: cineva adaugă mâine o rută care schimbă un serviciu, uită să o treacă, iar
 * ecranul rămâne pe date vechi **fără ca nimic să pară stricat**.
 * ✅ Golirea totală e grosolană și **întotdeauna corectă**. Costul ei e o singură re-citire a unei
 * liste mici; câștigul e că nu poate fi greșită.
 *
 * ⚠️ **Plus un termen scurt de valabilitate**, ca plasă de siguranță: o schimbare făcută de ALTCINEVA
 * (alt browser, alt om) nu trece prin scrierile noastre, deci n-ar goli nimic. 🔴 Fără termen, o
 * listă putea rămâne veche până la reîncărcarea paginii.
 */

/** Citirile care sunt date de referință. ⚠️ Potrivire pe cale EXACTĂ — un prefix ar prinde din greșeală. */
export const CACHEABLE_PATHS = [
  '/cleaners',
  '/services',
  '/services/active',
  '/price-calculator-rates',
] as const;

/**
 * Cât ține un răspuns.
 *
 * ⚠️ **Un minut e o alegere, nu o măsurătoare.** Destul cât să acopere deschiderea a zece dialoguri
 * la rând; destul de scurt cât o schimbare făcută de altcineva să apară de la sine, fără ca nimeni
 * să reîncarce pagina.
 */
export const REFERENCE_TTL_MS = 60_000;

type Entry = { value: unknown; storedAt: number };

const cache = new Map<string, Entry>();

/** ⛔ Numai calea exactă. `/cleaners/123` NU e o listă de referință. */
export function isCacheable(path: string): boolean {
  return (CACHEABLE_PATHS as readonly string[]).includes(path);
}

/**
 * Răspunsul ținut, dacă e încă bun.
 *
 * ⚠️ Rândul expirat se **șterge** la citire, nu se lasă: o hartă care adună rânduri moarte crește cât
 * timp stă pagina deschisă.
 */
export function readCache<T>(key: string, now: number): { hit: true; value: T } | { hit: false } {
  const entry = cache.get(key);
  if (!entry) return { hit: false };
  if (now - entry.storedAt >= REFERENCE_TTL_MS) {
    cache.delete(key);
    return { hit: false };
  }
  return { hit: true, value: entry.value as T };
}

/**
 * ⛔ Se scrie **numai** un răspuns reușit. Un eșec ținut în cache ar repeta aceeași eroare un minut,
 * fără să mai atingă rețeaua — aceeași lecție ca la unificarea cererilor în aer.
 */
export function writeCache(key: string, value: unknown, now: number): void {
  cache.set(key, { value, storedAt: now });
}

/**
 * Golirea, chemată de **orice** scriere.
 *
 * 🔴 Fără nicio judecată despre ce anume s-a schimbat: vezi nota din capul fișierului. Costă o
 * re-citire a unei liste mici și nu poate fi greșită.
 */
export function invalidateReferenceCache(): void {
  cache.clear();
}

/** Câte rânduri sunt ținute. ⚠️ Numai pentru teste. */
export function cachedCount(): number {
  return cache.size;
}

