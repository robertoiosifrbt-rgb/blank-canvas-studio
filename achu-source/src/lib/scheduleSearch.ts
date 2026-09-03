/**
 * §11 „Calendar search" (Sesiunea 158) — CĂUTAREA ÎN PERIOADA PRIVITĂ.
 *
 * ─── 🔴 Ce caută, și ce NU caută ────────────────────────────────────────────
 *
 * ⛔ **Caută în perioada de pe ecran, nu în toată istoria.** Aceea e căutarea globală (§22, `⌘K`), și
 * ea există deja. 🔴 O casetă pe orar care ar aduce vizite din altă lună ar muta calendarul sub mâna
 * omului — el caută „Mrs Smith **săptămâna asta**", altfel ar fi deschis căutarea globală.
 *
 * ⚠️ De asta filtrează rândurile deja aduse: **zero cereri în plus**, deci răspunde la fiecare tastă
 * fără să aștepte rețeaua, și nu poate arăta altceva decât ce e desenat.
 *
 * ─── Ce câmpuri, și de ce tocmai ele ───────────────────────────────────────
 * Numele clientului · serviciul · adresa · **numărul vizitei**. ⚠️ Ultimul e cel care pare de prisos
 * și nu e: numărul e ce se citește la telefon („e vorba de #412"), iar fără el omul ar trebui să-l
 * caute altundeva. ⛔ Orele NU intră: „09" ar prinde jumătate de zi.
 */

/** Ce citește căutarea dintr-o intrare de calendar. ⚠️ Structural: nu tipul întreg al ecranului. */
export type SearchableEntry = {
  reference: number;
  customerName: string | null;
  service: string | null;
  address: string | null;
};

/**
 * ⚠️ **Fără diacritice și fără majuscule**, în amândouă părțile: cine scrie „ionescu" trebuie să
 * găsească „Ionescu", iar cine scrie „Deep" trebuie să găsească „deep clean". ⛔ `NFD` + tăierea
 * semnelor e singurul loc unde se face, ca să nu existe două feluri de a normaliza.
 */
function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Potrivește o intrare cu ce s-a tastat.
 *
 * ⚠️ **Un text gol potrivește tot** — deliberat: altfel ecranul s-ar goli la ștergerea căutării, iar
 * omul ar crede că a pierdut săptămâna. ⛔ `#412` și `412` se caută la fel: diezul e felul în care
 * numărul e scris pe ecran, nu parte din el.
 */
export function matchesSearch(entry: SearchableEntry, query: string): boolean {
  const q = fold(query.trim()).replace(/^#/, '');
  if (!q) return true;
  const haystack = [
    String(entry.reference),
    entry.customerName ?? '',
    entry.service ?? '',
    entry.address ?? '',
  ].map(fold);
  return haystack.some(h => h.includes(q));
}

/** ⚠️ Păstrează ordinea primită: sortarea e a serverului, iar o căutare nu are voie s-o schimbe. */
export function filterBySearch<T extends SearchableEntry>(entries: T[], query: string): T[] {
  if (!query.trim()) return entries;
  return entries.filter(e => matchesSearch(e, query));
}

