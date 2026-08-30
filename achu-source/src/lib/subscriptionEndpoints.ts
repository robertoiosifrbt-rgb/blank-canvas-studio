/**
 * ABONAMENTELE ȘI CASELE LOR — apelurile către server.
 *
 * 🔴 **De ce un fișier separat, și e chiar regula:** `src/lib/endpoints.ts` e la **exact**
 * clichetul lui de mărime (ACHU-571), iar plafonul nu se ridică — se extrage ce a crescut.
 * Aceeași mișcare ca la `propertyEndpoints.ts`. ⚠️ `endpoints.ts` le re-exportă, deci niciun
 * apelant nu simte mutarea.
 */
import { apiGet, apiPost } from './apiClient';
import type { InvoiceRecord } from './billingEndpoints';

/* eslint-disable @typescript-eslint/no-explicit-any -- mutate ca atare de la ACHU-582; tiparea
   lor e o curățenie separată, iar o felie de bani nu e locul unde se face. */

// ─── Subscriptions (Sesiunea 45, backlog 53) ────────────────────────
// A prepaid term laid over a recurring contract, at a discount. The office
// previews the figures before committing — see previewSubscription.

/**
 * ACHU-401 (Sesiunea 115, MUTATE aici în felia 13). Formele pe care le citește ecranul.
 *
 * ⛔ **Mutate, nu rescrise.** Stăteau declarate în `SubscriptionsPage.tsx`, care e peste 500 de
 * linii; regula de mărime (`AGENT_RULES` §7, punctul 4) cere ca o modificare semnificativă
 * acolo să **extragă** o responsabilitate, iar formele răspunsurilor își au casa lângă funcția
 * care le cere. ⚠️ Niciun câmp nu a fost re-ghicit: sunt exact cele care erau, cuvânt cu cuvânt.
 *
 * 🔴 CÂMPURILE DE BANI SUNT `string`, ȘI NU E O SCĂPARE. Un rând stocat e împrăștiat direct din
 * Prisma (`res.json(rows.map(r => ({ ...r, … })))`, `subscriptions.ts:307`), iar un `Decimal`
 * din Prisma se serializează ca **text** peste JSON — de-aia fiecare citire din ecran e deja
 * învelită în `Number(…)`. Ruta de previzualizare e pe dos: întoarce `Priced`
 * (`backend/src/lib/subscriptionOperations.ts:74`), calculat în penny și trimis ca numere
 * simple. ⛔ Două forme, deliberat; tipizate la fel, una dintre ele ar minți.
 */
export type SubscriptionRow = {
  id: string;
  subscriptionId: number;
  customerName: string | null;
  status: string;
  service: string;
  termMonths: number;
  startDate: string;
  endDate: string;
  expectedVisits: number;
  /** Prisma `Decimal` → string over JSON. Read through `Number(…)`. */
  prepaidAmount: string;
  pricePerVisit: string;
  fullPricePerVisit: string;
  discountPercent: string;
};

export type SubscriptionDetail = SubscriptionRow & {
  /** ACHU-582 — de care client e termenul, ca secțiunea de case să-i poată cere casele lui. */
  customerId: string;
  scheduleDescription: string | null;
  visitsCompleted: number;
  jobs: { id: string; jobId: number; jobDate: string; status: string }[];
  paidAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  refundAmount: string | null;
  refundExplanation: string | null;
  /** Computed live, never stored — what cancelling TODAY would return. */
  refundIfCancelledNow: { amount: number; explanation: string } | null;
};

/** `priceTerm` — plain numbers, not Decimals. See the note above. */
export type SubscriptionPreview = {
  startDate: string;
  endDate: string;
  expectedVisits: number;
  pricePerVisit: number;
  prepaidAmount: number;
  fullTermAmount: number;
  savings: number;
  scheduleDescription: string;
};

export type SubscriptionOptions = {
  suggestedTermMonths: { months: number; suggestedDiscountPercent: number }[];
  maxTermMonths: number;
  maxDiscountPercent: number;
  cancellationRule: string;
};

/** Factura ridicată pentru un termen, cât citește ecranul din ea. */
/**
 * ⚠️ ACHU-401 (felia 20) — era un al doilea tip pentru aceeași factură, scris de mână aici.
 * Acum e chiar forma publicată de `getInvoices`, care e și ruta din care vine lista asta.
 * ⛔ Numele rămâne, ca ecranul să nu se atingă.
 */
export type SubscriptionInvoice = InvoiceRecord;

export function getSubscriptionOptions() {
  return apiGet<SubscriptionOptions>('/subscriptions/options');
}

export function getSubscriptions(params: { status?: string; customerId?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.customerId) qs.set('customerId', params.customerId);
  const query = qs.toString();
  return apiGet<SubscriptionRow[]>(`/subscriptions${query ? `?${query}` : ''}`);
}

export function getSubscription(params: { id: string }) {
  return apiGet<SubscriptionDetail>(`/subscriptions/${params.id}`);
}

/**
 * Works out the price WITHOUT saving anything. The whole point of the flow: the
 * office sees the exact figures the customer will be quoted before committing.
 */
export function previewSubscription(params: {
  recurringSeriesId: string; startDate: string; termMonths: number;
  fullPricePerVisit: number; discountPercent: number;
}) {
  return apiPost<SubscriptionPreview>('/subscriptions/preview', params);
}

export function createSubscription(params: {
  recurringSeriesId: string; startDate: string; termMonths: number;
  fullPricePerVisit: number; discountPercent: number; notes?: string;
}) {
  return apiPost<any>('/subscriptions', params);
}

export function setSubscriptionStatus(params: { id: string; status: 'Awaiting Payment' | 'Active' | 'Completed'; paidOn?: string }) {
  return apiPost<any>(`/subscriptions/${params.id}/status`, { status: params.status, paidOn: params.paidOn });
}

/** Separate from setSubscriptionStatus because cancelling has to work out a refund. */
export function cancelSubscription(params: { id: string; reason: string; visitsDelivered?: number }) {
  return apiPost<any>(`/subscriptions/${params.id}/cancel`, { reason: params.reason, visitsDelivered: params.visitsDelivered });
}

// ─── ACHU-582: casele dintr-un termen ───────────────────────────────


/** O casă acoperită de un termen, așa cum o întoarce `GET /subscription-lines/:id`. */
export type SubscriptionLineRecord = {
  id: string;
  reference: number;
  property: { id: string; label: string; address: string | null } | null;
  service: string;
  coveredFrom: string;
  status: 'Active' | 'Cancelled';
  /** ⚠️ Toate sumele sunt TEXT: o zecimală de bani prin `number` e felul în care se pierde un penny. */
  fullPricePerVisit: string;
  pricePerVisit: string;
  expectedVisits: number;
  amountForThisProperty: string;
  refundAmount: string | null;
  refundExplanation: string | null;
  visitsDelivered: number | null;
};

export type SubscriptionLineList = {
  records: SubscriptionLineRecord[];
  /**
   * 🔴 **Două cifre, două întrebări.** `totalPaid` = tot ce s-a facturat pe termen, **inclusiv**
   * casele ieșite — o încasare nu dispare când cineva renunță. `stillToDeliver` = ce mai e de
   * livrat. ⚠️ Confundate, o rambursare deja plătită devine inexplicabilă.
   */
  totalPaid: number;
  stillToDeliver: number;
  activeProperties: number;
  summary: string;
};

export type SubscriptionLinePreview = {
  property: { id: string; label: string };
  coveredFrom: string;
  coveredTo: string;
  expectedVisits: number;
  fullPricePerVisit: number;
  discountPercent: number;
  pricePerVisit: number;
  amountForThisProperty: number;
  /** 🔴 Ce se facturează SEPARAT. `0` când termenul nu e încă plătit — suma intră în total. */
  toInvoiceNow: number;
  explanation: string;
};

export type AddSubscriptionLineInput = {
  subscriptionId: string;
  propertyId: string;
  recurringSeriesId: string;
  service: string;
  fullPricePerVisit: number;
  /** Lipsă = startul termenului. Prezentă = adăugare la mijloc, deci factură suplimentară. */
  fromDate?: string;
};

export function getSubscriptionLines(params: { subscriptionId: string }) {
  return apiGet<SubscriptionLineList>(`/subscription-lines/${params.subscriptionId}`, {});
}

/** Ce ar costa casa asta, fără să se schimbe nimic. */
export function previewSubscriptionLine(params: AddSubscriptionLineInput) {
  return apiPost<SubscriptionLinePreview>('/subscription-lines/preview', params);
}

export function addSubscriptionLine(params: AddSubscriptionLineInput) {
  return apiPost<{
    success: boolean; id: string;
    amountForThisProperty: number; toInvoiceNow: number; termTotalNow: number;
    visitsCovered: number; explanation: string;
  }>('/subscription-lines', params);
}

/** ⚠️ Scoate DOAR casa asta. Restul termenului rămâne neatins. */
export function cancelSubscriptionLine(params: { id: string; reason: string; visitsDelivered?: number }) {
  const { id, ...body } = params;
  return apiPost<{
    success: boolean;
    refund: { amount: number; explanation: string; nothingToRefund: boolean; visitsDelivered: number };
    stillCovered: number;
  }>(`/subscription-lines/${id}/cancel`, body);
}

