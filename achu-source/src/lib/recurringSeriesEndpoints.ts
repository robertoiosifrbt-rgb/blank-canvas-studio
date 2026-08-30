/**
 * ACHU-401, felia a douăsprezecea — CONTRACTELE RECURENTE: apelurile lor, plus forma
 * fiecărui răspuns.
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `endpoints.ts`:** acela are peste 1200 de rânduri
 * și **nu are voie să crească** (`AGENT_RULES` §7).
 *
 * ⚠️ **Formele rândurilor stau în `recurringSeriesTypes.ts`, nu aici** — acolo erau deja, citite
 * de dialog, iar un fapt se scrie într-un singur loc (`AGENT_RULES` §11). Aici stau doar
 * răspunsurile ACȚIUNILOR, care nu au altă casă.
 *
 * 🔴 **Fiecare câmp e citit din `backend/src/routes/recurringSeries.ts`**, din `res.json`-ul
 * rutei care îl produce — nu ghicit din cum arată ecranul.
 */
import { apiGet, apiPost } from './apiClient';
import type { RecurringSeriesRecord, RecurringSeriesListRow } from './recurringSeriesTypes';

export type { RecurringSeriesRecord, RecurringSeriesListRow };

export function getRecurringSeriesList(params: { status?: string; customerId?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.customerId) qs.set('customerId', params.customerId);
  const query = qs.toString();
  return apiGet<{ records: RecurringSeriesListRow[] }>(`/recurring-series${query ? `?${query}` : ''}`);
}

export function getRecurringSeries(params: { id: string }) {
  return apiGet<{ record: RecurringSeriesRecord }>(`/recurring-series/${params.id}`);
}

/**
 * Creare sau editare, după prezența lui `id`.
 *
 * ⚠️ `futureVisitsUnchanged` vine **doar la editare**: e numărul vizitelor viitoare care au
 * rămas pe valorile vechi. Serverul le **numără, nu le atinge** — o vizită generată poate fi
 * mutată, asignată, plătită parțial sau facturată, iar un șablon nu suprascrie decizia unui om.
 * Pentru asta există acțiunea explicită de mai jos.
 */
export type SaveRecurringSeriesResponse = {
  success: true;
  id: string;
  description: string;
  futureVisitsUnchanged?: number;
};

export function saveRecurringSeries(params: Record<string, unknown>) {
  return apiPost<SaveRecurringSeriesResponse>('/recurring-series/save', params);
}

/**
 * ⚠️ `skipped` numără două lucruri deodată: datele la care exista deja o vizită, și cele pe care
 * o scriere concurentă le-a prins înainte. Ambele înseamnă „nu s-a creat nimic nou aici".
 */
export type GenerateVisitsResponse = {
  success: true;
  created: number;
  skipped: number;
  /** Până unde s-a generat efectiv — nu neapărat ce s-a cerut. */
  horizon: string;
  dates: string[];
  /** Prezent când s-a atins plafonul pe o rulare, SAU când rularea s-a oprit — vezi `stoppedBecause`. */
  note?: string;
  /**
   * 🔴 ACHU-604/703/733 — cineva a pus contractul pe pauză sau l-a anulat **în timpul** rulării, iar
   * generarea s-a oprit acolo. ⚠️ Absent în cazul obișnuit. ⛔ Nu e o eroare: vizitele făcute până
   * atunci rămân, deci răspunsul e 200 — dar diferența dintre „am cerut până în octombrie" și „am
   * primit 6 vizite" are o singură explicație, și doar serverul o știe.
   */
  stoppedBecause?: 'paused' | 'cancelled' | string;
  /**
   * 🔴 ACHU-700 — numele curățătorilor impliciți care NU au fost puși pe vizitele noi, fiindcă
   * între timp au devenit inactivi. ⚠️ Absent în cazul obișnuit, și absent pe o rulare care
   * n-a adăugat nimic: acolo nu s-a reținut nimeni de la nimic.
   */
  withheldCleaners?: string[];
};

export function generateRecurringVisits(params: { id: string; until?: string }) {
  return apiPost<GenerateVisitsResponse>(`/recurring-series/${params.id}/generate`, params.until ? { until: params.until } : {});
}

export type RecurringSeriesStatusResponse = {
  success: true;
  status: 'active' | 'paused' | 'cancelled';
  /** Câte vizite viitoare s-au anulat odată cu contractul. 0 dacă nu s-a cerut. */
  cancelledVisits: number;
};

export function setRecurringSeriesStatus(params: { id: string; status: 'active' | 'paused' | 'cancelled'; cancelFutureVisits?: boolean }) {
  return apiPost<RecurringSeriesStatusResponse>(`/recurring-series/${params.id}/status`, { status: params.status, cancelFutureVisits: params.cancelFutureVisits });
}

export type ApplyToFutureResponse = {
  success: true;
  updated: number;
  /** Numite, nu ascunse: acestea au fost lăsate în pace fiindcă le mutase cineva. */
  skippedRescheduled: number;
};

export function applyRecurringSeriesToFuture(params: { id: string }) {
  return apiPost<ApplyToFutureResponse>(`/recurring-series/${params.id}/apply-to-future`, {});
}

