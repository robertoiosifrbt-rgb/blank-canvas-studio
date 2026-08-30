import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { globalSearch } from '@/lib/endpoints';
import { useDebouncedCallback } from 'use-debounce';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errMsg } from '@/lib/errorMessage';
/**
 * §22 (Sesiunea 148) — secțiunile căutării trăiesc ca DATE, într-un singur loc, ca să le poată citi
 * și testul care păzește textul din casetă. ⚠️ Motivele fiecărei destinații sunt acolo.
 */
import { SECTIONS } from '@/lib/searchSections';

const SEARCH_TIMEOUT_MS = 15000;
// ACHU-138: query lives in this URL param, not just component state, so it
// survives navigation (clicking a result) and a page reload/deep link.
const SEARCH_PARAM = 'gsearch';

/**
 * ACHU-401 (Sesiunea 115), înlocuit la felia 23: forma o publică acum `officeToolsEndpoints.ts`,
 * iar `globalSearch()` chiar o întoarce — până acum ecranul își scria propria copie peste `any`.
 */
import type { GlobalSearchResults as SearchResults } from '@/lib/officeToolsEndpoints';

/**
 * ─── §22 „Recent searches" (Sesiunea 148) ─────────────────────────────────────────────────────
 *
 * 🔴 **`sessionStorage`, NU `localStorage`, și asta e chiar decizia feliei.**
 *
 * ⛔ Ce se tastează aici sunt **nume de clienți, adrese, coduri poștale**. Pe un calculator de birou
 * folosit de mai mulți oameni, `localStorage` le-ar păstra **după** ce cel care a căutat a plecat de
 * la masă — deci următorul deschide caseta și citește pe cine a căutat celălalt. ⚠️ Nu e o scurgere
 * în afară, dar e exact felul de „de unde știe asta despre clientul meu?" pe care nu vrei să-l
 * explici.
 *
 * ✅ `sessionStorage` trăiește cât ține fila. Atât cât să folosească la ce e cerut („am căutat asta
 * acum două minute, o caut iar"), nu mai mult.
 *
 * ⚠️ **Fiecare citire și scriere în `try/catch`:** într-o filă privată sau cu datele blocate,
 * accesul ARUNCĂ, iar o casetă de căutare nu are voie să cadă pentru o comoditate.
 */
const RECENT_KEY = 'achu.recentSearches';
const RECENT_MAX = 5;

function readRecent(): string[] {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string').slice(0, RECENT_MAX) : [];
  } catch { return []; }
}

function rememberRecent(term: string): string[] {
  const clean = term.trim();
  if (clean.length < 2) return readRecent();
  /** ⚠️ Fără duplicate, și cel mai nou primul — o listă de cinci în care apar de trei ori aceleași litere nu ajută. */
  const next = [clean, ...readRecent().filter(v => v.toLowerCase() !== clean.toLowerCase())].slice(0, RECENT_MAX);
  try { sessionStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* o comoditate, nu o funcție */ }
  return next;
}

export default function GlobalSearch() {
  const [sp, setSp] = useSearchParams();
  const [query, setQuery] = useState(() => sp.get(SEARCH_PARAM) ?? '');
  const [results, setResults] = useState<SearchResults>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  /**
   * §22 (Sesiunea 148) — citit o dată, la montare; scris când un rezultat e chiar deschis.
   * ⚠️ **Declarat aici, sus, cu celelalte stări** — nu lângă locul unde se folosește: `go` e definit
   * mai jos și îl scrie, iar lintul a prins accesul înaintea declarației. Nu e un moft: o stare
   * citită înainte de a fi declarată nu se mai actualizează când se schimbă.
   */
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  const nav = useNavigate();
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  /** The query string that was active when we last fired a request */
  const activeQueryRef = useRef('');

  const syncQueryParam = useCallback((q: string) => {
    const next = new URLSearchParams(sp);
    if (q) next.set(SEARCH_PARAM, q); else next.delete(SEARCH_PARAM);
    setSp(next, { replace: true });
  }, [sp, setSp]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const doSearch = useDebouncedCallback(async (q: string) => {
    if (q.length < 2) {
      // Short/empty query — invalidate everything outstanding
      ++seqRef.current;
      activeQueryRef.current = '';
      setResults(null);
      setError(null);
      setStale(false);
      setLoading(false);
      setOpen(false);
      return;
    }
    const mySeq = ++seqRef.current;
    activeQueryRef.current = q;
    setLoading(true);
    setError(null);
    setStale(false);
    try {
      const data = await Promise.race([
        globalSearch({ query: q }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Search timed out')), SEARCH_TIMEOUT_MS)),
      ]);
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      setResults(data);
      setError(null);
      setStale(false);
      setOpen(true);
    } catch (e) {
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      const msg = errMsg(e) || 'Search failed';
      setError(msg);
      // Preserve previous results — mark stale
      setStale(results !== null);
      setOpen(true);
    } finally {
      if (mountedRef.current && mySeq === seqRef.current) setLoading(false);
    }
  }, 300);

  // ACHU-138: restore a search that was in progress before a reload/deep link.
  useEffect(() => {
    const initial = sp.get(SEARCH_PARAM) ?? '';
    if (initial.length >= 2) doSearch(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = useCallback((val: string) => {
    setQuery(val);
    syncQueryParam(val);
    if (val.length < 2) {
      // Immediately invalidate — don't wait for debounce
      doSearch.cancel();
      ++seqRef.current;
      activeQueryRef.current = '';
      setResults(null);
      setError(null);
      setStale(false);
      setLoading(false);
      setOpen(false);
    } else {
      doSearch(val);
    }
  }, [doSearch, syncQueryParam]);

  const handleRetry = useCallback(() => {
    const q = query;
    if (q.length >= 2) {
      // Fire immediately (bypass debounce) for retry
      doSearch.cancel();
      doSearch(q);
      doSearch.flush();
    }
  }, [query, doSearch]);

  // ACHU-138/RA-003: navigating to a result no longer wipes the search — the
  // query stays in the box and in the URL, so it's still there if the user
  // comes back (browser back, or reopening the search box on the new page).
  // The destination URL must carry `gsearch` forward itself (not just the
  // page we're leaving) — otherwise a refresh on the destination page loses
  // it, since the search box reads its initial value from the current URL.
  const go = useCallback((path: string) => {
    /**
     * §22 (Sesiunea 148) — ⚠️ se ține minte **doar căutarea care a dus la ceva**, nu fiecare literă
     * tastată. ⛔ Altfel lista de cinci ar fi plină de prefixe („Sm", „Smi", „Smit") ale unei
     * singure căutări, adică zgomot exact acolo unde ar trebui să fie scurtături.
     */
    setRecent(rememberRecent(query));
    setOpen(false);
    const separator = path.includes('?') ? '&' : '?';
    nav(`${path}${separator}${SEARCH_PARAM}=${encodeURIComponent(query)}`);
  }, [nav, query]);

  /**
   * §22 (Sesiunea 148) — numărat din ACEEAȘI listă din care se randează. ⛔ Suma scrisă de mână se
   * despărțea de ecran la fiecare entitate adăugată: la facturi a fost nevoie de un `?? 0` pus
   * separat aici, iar cinci entități noi ar fi cerut încă cinci.
   */
  const sections = results ? SECTIONS.map(s => ({ ...s, items: s.rows(results) })).filter(s => s.items.length > 0) : [];
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const hasResults = results && total > 0;

  /**
   * ─── §22 „Keyboard navigation" + „Highlight selected result" (Sesiunea 148) ───────────────
   *
   * 🔴 **Aceeași listă plată pentru tastatură și pentru evidențiere**, nu două. ⚠️ Ordinea vizuală
   * e cea a secțiunilor, deci o a doua listă „pentru taste" s-ar fi despărțit de ce vede omul la
   * prima reordonare — iar atunci Enter ar deschide alt rând decât cel luminat. ⛔ Asta e mai rău
   * decât lipsa tastaturii: deschide altceva decât ce ai ales.
   */
  const flat = sections.flatMap(s => s.items);
  /**
   * 🔴 **Rândul ales se ține pe `id`, nu pe poziție** — și asta rezolvă două lucruri deodată:
   *
   *   1. ⚠️ **Nu trebuie golit la fiecare set nou de rezultate.** Un id din căutarea veche pur și
   *      simplu nu se mai potrivește, deci selecția „dispare" singură. ⛔ Varianta cu poziție cerea
   *      un `useEffect` care scrie state — exact ce lintul interzice (și pe bună dreptate: rândul 3
   *      din căutarea veche nu e rândul 3 din cea nouă, deci poziția era oricum o afirmație falsă).
   *   2. **Enter deschide exact rândul luminat**, fiindcă amândouă citesc aceeași listă plată.
   */
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIndex = flat.findIndex(i => i.id === activeId);

  /** ⛔ Fără `useCallback`: `flat` se reface la fiecare randare, deci memoizarea n-ar ține nimic. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!open || flat.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const next = activeIndex < 0
        ? (delta > 0 ? 0 : flat.length - 1)
        : (activeIndex + delta + flat.length) % flat.length;
      setActiveId(flat[next].id);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      /**
       * ⚠️ Enter **fără** niciun rând ales nu deschide primul. ⛔ Cineva care apasă Enter din reflex,
       * ca la un motor de căutare, ar fi trimis la un rând pe care nu s-a uitat — iar de acolo
       * înapoi înseamnă să-și rescrie căutarea.
       */
      e.preventDefault();
      go(flat[activeIndex].to);
    }
  };

  return (
    <div className="relative max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input placeholder="Customers, jobs, properties, cleaners, incidents, complaints…" className="pl-9 pr-9" value={query}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={onKeyDown}
        /* §22 (Sesiunea 148) — un cititor de ecran trebuie să afle CÂTE rezultate sunt și că lista e deschisă. */
        role="combobox"
        aria-expanded={open && hasResults ? true : false}
        aria-controls="global-search-results"
        aria-label={`Search. ${total} result${total === 1 ? '' : 's'}`}
        /* §22 (Sesiunea 148) — caseta se deschide și GOALĂ, dacă are ce arăta: căutările recente. */
        onFocus={() => ((query.length >= 2 && (results || error)) || (query.length === 0 && recent.length > 0)) && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}

      {/**
        * §22 (Sesiunea 148) — căutările recente apar **doar pe o casetă goală și deschisă**: cu litere
        * în ea, ce se caută acum are prioritate față de ce s-a căutat înainte.
        */}
      {open && query.length === 0 && recent.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 p-2">
          <p className="text-xs font-medium text-muted-foreground px-2 pb-1">Recent searches</p>
          {recent.map(term => (
            <button
              key={term}
              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted"
              onClick={() => handleChange(term)}
            >
              {term}
            </button>
          ))}
        </div>
      )}

      {open && error && !hasResults && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 p-4 text-center space-y-2">
          <AlertCircle className="h-5 w-5 mx-auto text-destructive/60" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="ghost" size="sm" onClick={handleRetry} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      )}

      {open && hasResults && (
        <div id="global-search-results" role="listbox" aria-label="Search results"
          className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-auto">
          {stale && error && (
            <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-xs text-amber-800">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="flex-1">{error} — showing cached results</span>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleRetry} disabled={loading}>
                <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />Retry
              </Button>
            </div>
          )}
          {sections.map((section, index) => (
            <div key={section.key} className={index === 0 ? 'p-2' : 'p-2 border-t border-border'}>
              <p className="text-xs font-medium text-muted-foreground px-2 pb-1 flex items-center gap-1">
                <section.icon className="h-3 w-3" /> {section.label}
              </p>
              {section.items.map(item => (
                <button
                  key={item.id}
                  /**
                   * §22 (Sesiunea 148) — ⚠️ **rândul ales se vede**, cu aceeași culoare ca la trecerea
                   * mausului: două semne diferite pentru „ăsta e" ar fi cerut de la om să învețe două
                   * lucruri. `aria-selected` pentru cine nu vede culoarea.
                   */
                  className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted${
                    item.id === activeId ? ' bg-muted' : ''}`}
                  aria-selected={item.id === activeId}
                  onClick={() => go(item.to)}
                >
                  {item.text}
                  {item.muted && <span className="text-xs text-muted-foreground"> {item.muted}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {open && !error && results && total === 0 && query.length >= 2 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 p-4 text-center text-sm text-muted-foreground">No results found</div>
      )}
    </div>
  );
}

