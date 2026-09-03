/**
 * §8 „Services catalogue" (Sesiunea 146) — apelurile catalogului, plus forma rândului.
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `endpoints.ts`** (`AGENT_RULES` §7): acela e la
 * plafonul lui de mărime și nu are voie să crească.
 */
import { apiGet, apiPost, apiPut } from './apiClient';

/**
 * Un serviciu din catalog, întreg.
 *
 * 🔴 **`name` e cheia, nu o etichetă:** `jobs.service` și `quote_requests.services` țin chiar
 * textul ăsta. ⛔ De aceea nu există `saveService({ name })` pe un serviciu existent — serverul
 * refuză redenumirea, cu motivul întreg în `backend/src/lib/servicePolicy.ts`.
 */
export type ServiceRecord = {
  id: string;
  /** Numărul vizibil, nu cuid-ul. */
  reference: number;
  name: string;
  category: string | null;
  /** Ce citește clientul pe o ofertă. */
  customerDescription: string | null;
  /** ⛔ Ce-și spune echipa despre treabă. Nu iese niciodată pe ruta publică. */
  internalDescription: string | null;
  /** ⚠️ Stins = nu mai apare pe formularele noi. Vizitele vechi nu sunt atinse. */
  active: boolean;
  /** ⚠️ Se AFIȘEAZĂ. Ofertele se calculează în continuare din Price Calculator. */
  standardMinutes: number | null;
  standardCleaners: number | null;
  minimumNoticeHours: number | null;
  sortOrder: number;
  updatedBy: string | null;
  updatedAt: string;
  /** Subserviciile — pozițiile care se numără și se tarifează. */
  items: ServiceItemRecord[];
};

export function getServices() {
  /**
   * ⚠️ `scope` vine de la SERVER, nu e scris a doua oară în ecran: copiat acolo, cele două s-ar fi
   * depărtat, iar cel greșit ar fi fost chiar cel citit de un om.
   */
  return apiGet<{ scope: string; records: ServiceRecord[] }>('/services');
}

type WriteResult = { success: true; auditWarning?: string };

export function addService(data: { name: string } & Record<string, unknown>) {
  return apiPost<WriteResult & { id: string }>('/services', data);
}

/**
 * ⚠️ **Cheia ABSENTĂ = „nu atinge"; `null` = „șterge"** (`AGENT_RULES` §15) — deci se trimite doar
 * ce s-a schimbat, nu tot rândul.
 */
export function updateService(id: string, data: Record<string, unknown>) {
  return apiPut<WriteResult>(`/services/${id}`, data);
}

/** Un subserviciu — poziția care se numără pe formular și se tarifează în calculator. */
export type ServiceItemRecord = {
  id: string;
  /** 🔴 Puntea către tarif. Nu se schimbă — serverul refuză. */
  fieldKey: string;
  label: string;
  active: boolean;
  sortOrder: number;
};

/**
 * ⚠️ Cheia NU se trimite: o derivă serverul din etichetă. Un om care tastează chei ajunge la
 * „bedroom", „Bedrooms" și „bedRooms" pentru același lucru.
 */
export function addServiceItem(serviceId: string, data: { label: string; sortOrder?: number }) {
  return apiPost<WriteResult & { id: string; fieldKey: string; needsRate: string }>(
    `/services/${serviceId}/items`, data);
}

export function updateServiceItem(itemId: string, data: { label?: string; active?: boolean; sortOrder?: number }) {
  return apiPut<WriteResult>(`/services/items/${itemId}`, data);
}

