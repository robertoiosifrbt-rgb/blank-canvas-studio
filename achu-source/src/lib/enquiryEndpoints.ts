/**
 * ACHU-401, felia a douăzeci și treia — CEREREA DE OFERTĂ, de la formularul public până la
 * conversia în client și vizită.
 *
 * ⛔ **Fișier propriu, reexportat din `endpoints.ts`** (`AGENT_RULES` §7) — niciun apelant nu se
 * schimbă.
 *
 * ⛔ **RÂNDUL cererii rămâne `any`, deliberat, și e singurul loc din felie unde rămâne:** ruta
 * împrăștie rândul Prisma întreg prin `toClientShape` (~40 de coloane), iar un tip scris de mână
 * peste el e chiar greșeala care a produs ACHU-741. ⚠️ Ce se poate scrie sunt **răspunsurile de
 * la scriere**, care sunt compuse explicit — și acolo stă și singura deosebire care contează.
 */
import { apiGet, apiPost, apiDelete } from './apiClient';

/**
 * ⛔ Rândul cererii rămâne `any` — vezi antetul. ⚠️ Aliasul se numește la fel ca înainte
 * (`GetQuoteRequestOutputType`), ca cele două ecrane care își derivă tipul din el să nu se atingă.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ruta împrăștie rândul Prisma întreg
export type GetQuoteRequestOutputType = any;

// ─── Quote Requests ─────────────────────────────────────────────────

/**
 * ⚠️ `records` folosește aliasul de mai sus, nu un `any[]` propriu: e **același** rând, iar un al
 * doilea `any` nedocumentat pentru aceeași formă arată ca o scăpare, nu ca o alegere.
 */
export function getQuoteRequests(_params: Record<string, never> = {}) {
  return apiGet<{ records: GetQuoteRequestOutputType[] }>('/quote-requests');
}

/**
 * ACHU-561 — pozele cererii, pentru BIROU. ⚠️ Ruta de Admin, alta poarta decat cea a
 * clientului: aici `requireRole('Admin')`, acolo `customerId` din sesiune.
 */
export function getAdminQuoteRequestPhotos(params: { id: string }) {
  return apiGet<{
    photos: { id: string; description: string | null; uploadedAt: string; signedUrl: string | null }[];
  }>(`/quote-requests/${params.id}/photos`, {});
}

export function getQuoteRequest(params: { id: string }) {
  return apiGet<GetQuoteRequestOutputType>(`/quote-requests/${params.id}`);
}

/**
 * ACHU-546 (Sesiunea 120) — sterge o cerere de oferta, definitiv.
 *
 * ⚠️ **Nu e o „arhivare".** Pagina publica ii promite vizitatorului care nu devine client
 * ca ii stergem cererea; serverul chiar sterge randul, si refuza (409) orice cerere care a
 * devenit client sau vizita — pentru acelea exista stergerea GDPR a clientului.
 */
export function deleteQuoteRequest(params: { id: string }) {
  return apiDelete<{ success: true; quoteRequestId: number }>(`/quote-requests/${params.id}`);
}

/** ⚠️ `_revision` NOU vine înapoi la fiecare salvare — fără el, a doua salvare cade ca CONFLICT. */
export function saveQuoteRequest(data: Record<string, unknown>) {
  return apiPost<{ success: true; id: string; _revision: string; auditWarning?: string }>('/quote-requests/save', data);
}

/**
 * ⚠️ **Nu aruncă la eșec parțial:** răspunsul numără separat ce s-a convertit, ce s-a sărit și ce
 * a picat, iar ecranul trebuie să le arate pe toate trei — un „gata" pe un lot cu 3 eșecuri e
 * chiar tiparul ACHU-520.
 */
export function convertQuoteRequest(_params: Record<string, never> = {}) {
  return apiPost<{
    converted: number; skipped: number; failed: number; remaining: number;
    /** ⚠️ Trimise doar când NU sunt goale — de aceea opționale, nu liste vide. */
    items?: {
      quoteRequestId: string; displayId: string;
      /** ⚠️ `resumed` se numără la CONVERTITE pe server: e o conversie reluată, nu una nouă. */
      outcome: 'converted' | 'skipped' | 'failed' | 'resumed';
      reason?: string; customerId?: string; jobId?: string; userAccountId?: string;
    }[];
    errors?: string[];
  }>('/quote-requests/convert', {});
}

// ─── Request Booking ────────────────────────────────────────────────

/** ⚠️ `jobId` e numărul VIZIBIL al vizitei create, nu cuid-ul — clientul îl vede pe ecran. */
export function requestBooking(data: Record<string, unknown>) {
  return apiPost<{ success: true; id: string; jobId: number; auditWarning?: string }>('/request-booking', data);
}

// ─── Submit Quote Request (in-house Fillout replacement, Sesiunea 26) ──

export function submitQuoteRequest(data: Record<string, unknown>) {
  return apiPost<{ success: true; id: string; quoteRequestId: number; auditWarning?: string }>('/submit-quote-request', data);
}

// ─── Public Quote Request (no login required, Sesiunea 26) ─────────

/**
 * 🔴 **`id` și `quoteRequestId` sunt OPȚIONALE aici, spre deosebire de ruta de deasupra**, și e
 * o alegere de securitate: când capcana pentru roboți se declanșează, ruta răspunde `{ success:
 * true }` **fără să creeze nimic**, tocmai ca robotul să nu afle. ⛔ Un ecran care afișează
 * „cererea #undefined" pe acel răspuns spune unui om că s-a înregistrat ceva ce nu există.
 */
export function submitPublicQuoteRequest(data: Record<string, unknown>) {
  return apiPost<{ success: true; id?: string; quoteRequestId?: number; auditWarning?: string }>('/public-quote-request', data);
}

