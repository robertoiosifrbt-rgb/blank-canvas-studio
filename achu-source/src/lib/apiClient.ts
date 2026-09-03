/**
 * Fetch-based replacement for `zite-endpoints-sdk`. See
 * docs/Ghid_Conversie_Zite_Cod.md section 5 and docs/JURNAL.md
 * (Sesiunea 3) for the migration this supports.
 *
 * `VITE_API_BASE_URL` overrides the base URL for deployments where the
 * frontend and backend are on different origins. With no override, requests
 * go to `/api` on the current origin — see vite.config.ts for the dev-server
 * proxy that forwards this to the Express backend.
 *
 * Sesiunea 6 (Supabase Auth): every request now carries the current Supabase
 * session's access token as a Bearer header, verified by the backend's
 * requireAuth/requireAuthenticatedEmail (see backend/src/middleware/auth.ts).
 */
import { supabase } from './supabaseClient';
import { reportApiError } from './sessionExpiry';
import { dedupeGet, getKey } from './inFlightGets';
import { isCacheable, readCache, writeCache, invalidateReferenceCache } from './referenceCache';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';
const LIFE_OS_COPY = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('lifeos') === '1';

/**
 * Life OS contains an independent, data-free copy of ACHU.  It must never
 * fall through to ACHU's original API, even when a screen starts a request.
 * These shapes keep the real screens in their honest empty states until a
 * separate Life OS datastore is connected.
 */
function lifeOsEmptyResponse(path: string): unknown {
  if (path === '/dashboard') {
    return {
      totalIncome: 0, totalExpenses: 0, netProfit: 0,
      taxRate: 0, taxReserve: 0, niRate: 0, niReserve: 0,
      emergencyRate: 0, emergencyReserve: 0, availableCash: 0,
      outstandingBalances: 0, jobsToday: 0, upcomingJobs: 0,
      completedJobs: 0, cancelledJobs: 0, expensesByCategory: [],
      periodExpenses: 0, settingsConfigured: false, offToday: [],
    };
  }
  if (path === '/action-centre') return {};
  if (path === '/chat/unread-count' || path === '/notifications/unread-count') return { unreadCount: 0 };
  if (path === '/chat/channels') return { channels: [] };
  if (path === '/chat/people') return { people: [] };
  if (path === '/global-search') return { customers: [], jobs: [], cleaners: [], invoices: [], total: 0 };
  if (path === '/services') return { scope: 'life-os', records: [] };
  if (path === '/services/active') return { records: [] };
  if (path === '/jobs/for-select') return { jobs: [] };
  if (path === '/payroll-runs') return { records: [], runs: [] };
  if (path === '/payroll/people') return { people: [], records: [] };
  if (path === '/push/status') return { supported: false, subscribed: false };
  if (path === '/backup/status') return { configured: false, available: false };
  if (path === '/invoice-settings') return { settings: {}, _revision: 'life-os-empty' };
  if (path === '/price-calculator-rates') return { rates: [], _revision: 'life-os-empty' };
  if (path === '/notifications') return { records: [], notifications: [], total: 0 };

  // Most ACHU list screens use one of these names. Supplying all of them is
  // deliberate: the copied UI remains navigable without inventing records.
  return {
    records: [], items: [], rows: [], results: [], jobs: [], customers: [],
    cleaners: [], teams: [], payments: [], expenses: [], invoices: [],
    assignments: [], requests: [], incidents: [], repairs: [], files: [],
    documents: [], tasks: [], events: [], suggestions: [], subscriptions: [],
    notifications: [], total: 0, count: 0, offset: 0, limit: 50,
    note: 'Independent Life OS copy — no ACHU data connected.',
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

async function request<T>(
  // `PUT` adăugat în ACHU-537 — vezi `apiPut` mai jos pentru de ce nu e un `PATCH`.
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  opts?: { query?: Record<string, unknown>; body?: unknown; asText?: boolean },
): Promise<T> {
  if (LIFE_OS_COPY) {
    if (method === 'GET') return lifeOsEmptyResponse(path) as T;
    throw new ApiError('This independent ACHU copy has no datastore connected.', 503, 'LIFE_OS_NO_DATASTORE');
  }
  const url = `${API_BASE}${path}${buildQueryString(opts?.query)}`;
  const hasBody = opts?.body !== undefined;

  /**
   * §47 „Cache invalidation" (Sesiunea 154) — **ORICE scriere golește tot cache-ul de referință.**
   *
   * 🔴 Deliberat fără nicio judecată despre ce anume s-a schimbat. ⛔ O hartă „scrierea asta strică
   * citirile alea" e exact felul de tabel care se învechește tăcut: cineva adaugă mâine o rută care
   * schimbă un serviciu, uită să o treacă, iar ecranul rămâne pe date vechi **fără ca nimic să pară
   * stricat**. ✅ Golirea totală e grosolană și întotdeauna corectă; costă o re-citire a unei liste
   * mici.
   *
   * ⚠️ **ÎNAINTE de cerere, nu după.** Dacă cererea eșuează pe drum, serverul poate să fi apucat
   * totuși să scrie — deci un cache golit degeaba e ieftin, iar unul rămas plin după o scriere
   * reușită e o minciună pe ecran.
   */
  if (method !== 'GET') invalidateReferenceCache();

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  const headers: Record<string, string> = {};
  if (hasBody) headers['Content-Type'] = 'application/json';
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('Network error: Unable to reach the server.', 0);
  }

  const text = await res.text();
  /**
   * ⚠️ `unknown`, nu `any`: corpul răspunsului **chiar** e necunoscut aici — poate fi JSON-ul
   * rutei, o pagină de eroare a proxy-ului, sau nimic. Cele două câmpuri citite mai jos
   * (`error`, `code`) se iau printr-o formă declarată, ca o eroare de proxy să nu treacă drept
   * mesaj de rută.
   */
  let json: { error?: string; code?: string } | null = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON body (proxy/gateway error page, HTML, empty-ish text) —
      // fall through with json=null so the generic message below is used
      // instead of throwing a raw SyntaxError.
    }
  }

  if (!res.ok) {
    const failure = new ApiError(json?.error || `Request failed (${res.status})`, res.status, json?.code);
    /**
     * 🆕 §1 „Expirarea sesiunii" (Sesiunea 155) — **singurul loc prin care trec toate cererile.**
     *
     * ⚠️ `reportApiError` reacționează **doar** la codul `UNAUTHENTICATED` (token lipsă sau refuzat
     * de Supabase), nu la orice 403: un refuz de rol nu e un motiv să scoți omul din cont.
     * ⛔ Nu aruncă și nu schimbă eroarea — ecranul o primește exact ca înainte.
     */
    reportApiError(failure);
    throw failure;
  }
  // ⚠️ `asText` is read AFTER the error handling on purpose: a failure still
  // arrives as JSON (`{ error }`), so the message must be extracted the usual way
  // even when the success path wants the raw body.
  if (opts?.asText) return text as unknown as T;
  return json as T;
}

/**
 * §47 „Prevent duplicate API calls" (Sesiunea 154) — **numai citirile se unesc.**
 *
 * ⚠️ Două cereri identice pornite cât timp prima e încă în aer fac un singur drum: un ecran montat
 * de două ori (React în StrictMode face exact asta), două componente care cer aceeași listă, un om
 * care apasă „Refresh" de două ori. 🔴 A doua nu aduce nimic nou.
 *
 * ⛔ **`apiPost` și celelalte NU trec pe aici, și n-au voie să treacă:** un `POST` trimis de două ori
 * nu e o cerere duplicată, sunt **două acțiuni** — două plăți, două vizite, două mesaje. A le uni ar
 * face aplicația să înghită tăcut o intenție reală, cu ecranul arătând succes. ⚠️ Scrierile au deja
 * apărarea lor, hotărâtă de SERVER: jetoanele de idempotență (ACHU-116). Un test de sursă ține
 * regula (`inFlightGets.test.ts`).
 */
export const apiGet = <T>(path: string, query?: Record<string, unknown>): Promise<T> => {
  const key = getKey(path, query);

  /**
   * §47 „Query caching" (Sesiunea 154) — **numai listele de referință**, și numai cele scrise în
   * `referenceCache.ts`. ⛔ Un cache peste toate citirile ar fi arătat mai complet și ar fi fost mai
   * rău: o listă de vizite sau o cifră de bani de acum treizeci de secunde nu se distinge de una
   * corectă, iar la bani asta e o decizie luată pe date vechi.
   */
  if (!isCacheable(path)) return dedupeGet(key, () => request<T>('GET', path, { query }));

  const cached = readCache<T>(key, Date.now());
  if (cached.hit) return Promise.resolve(cached.value);

  return dedupeGet(key, () => request<T>('GET', path, { query })
    /** ⛔ Numai un răspuns REUȘIT se ține: un eșec în cache ar repeta aceeași eroare un minut. */
    .then(value => { writeCache(key, value, Date.now()); return value; }));
};

/**
 * ACHU-396 — the body as the text the server sent, unparsed.
 *
 * Added for the encrypted backup download, which is deliberately NOT JSON: the
 * browser must be able to save a file it cannot read. `apiGet` would hand back
 * `null` for it, because a body that fails `JSON.parse` falls through as such.
 */
export const apiGetText = (path: string, query?: Record<string, unknown>): Promise<string> =>
  request<string>('GET', path, { query, asText: true });

export const apiPost = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>('POST', path, { body: body ?? {} });

/** Sesiunea 29 — added for the chat module's message edit; no PATCH route existed before. */
export const apiPatch = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>('PATCH', path, { body: body ?? {} });

/**
 * ACHU-537 — primul `PUT` din aplicație, pentru nota unei vizite.
 *
 * ⚠️ `PUT`, nu `PATCH`, și diferența e reală aici: nota clientului pentru o vizită e cel mult
 * una, iar a doua trimitere o **înlocuiește** întreagă (scor + text). Un `PATCH` ar fi
 * sugerat că poți trimite doar textul și păstra scorul, ceea ce ruta nu face — și nu poate
 * face, fiindcă un text fără notă nu se salvează.
 */
export const apiPut = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>('PUT', path, { body: body ?? {} });

/**
 * ⚠️ Corp OPȚIONAL pe DELETE (ACHU-498): ștergerea unor ore poartă un motiv scris
 * de om. Rămâne opțional, deci apelurile existente nu se ating.
 */
export const apiDelete = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>('DELETE', path, body === undefined ? undefined : { body });

/**
 * Download a file the API generates (ACHU-295, Sesiunea 74d).
 *
 * Not a plain link. Every endpoint here needs a Bearer token, and an <a href>
 * sends no Authorization header — it would land on a 403 page instead of a file,
 * which reads to the user as "the export is broken".
 *
 * So: fetch with the token, take the filename the SERVER chose from
 * Content-Disposition (the server knows the tax year and the report kind; the
 * screen would have to reconstruct both), and hand the blob to the browser.
 */
export async function apiDownload(path: string, query?: Record<string, unknown>, fallbackFilename = 'download.csv'): Promise<void> {
  return downloadFrom(`${API_BASE}${path}${buildQueryString(query)}`, undefined, fallbackFilename);
}

/**
 * 🔴 §41 „Bulk export" (Sesiunea 150) — același drum, dar cu un CORP.
 *
 * ⚠️ **De ce un POST pentru o descărcare:** exportul selecției poartă o listă de identificatori, iar
 * aceea nu încape într-o adresă la cinci sute de vizite (același motiv ca la `/preview`). ⛔ Iar
 * plumbăria de descărcare **nu s-a scris a doua oară**: cele două intrări cheamă `downloadFrom`. O a
 * doua copie s-ar fi despărțit de prima la primul detaliu de browser reparat într-una din ele — și
 * nimeni nu ar fi știut care e cea folosită de ecranul lui.
 */
export async function apiDownloadPost(path: string, body: unknown, fallbackFilename = 'download.csv'): Promise<void> {
  return downloadFrom(`${API_BASE}${path}`, body, fallbackFilename);
}

async function downloadFrom(url: string, body: unknown, fallbackFilename: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    let message = `Download failed (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* a non-JSON error body is not worth a second failure */ }
    throw new ApiError(message, res.status);
  }

  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? fallbackFilename;

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next tick: revoking synchronously can cancel the download in
  // some browsers before it has started reading the blob.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
