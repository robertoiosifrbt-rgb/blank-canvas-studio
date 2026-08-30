/**
 * §20 „Communication centre" (Sesiunea 152) — REGISTRUL DISCUȚIILOR CU UN CLIENT.
 *
 * ⚠️ Fișier propriu, ca `endpointsIncidents.ts`: `endpoints.ts` e la clichetul lui de mărime, iar
 * regula (`AGENT_RULES` §7.4) cere să extragi responsabilitatea nouă, nu să ridici cifra.
 * ⛔ `endpoints.ts` face `export * from './communicationEndpoints'`, deci ecranele importă ca înainte.
 *
 * ⚠️ Tipuri ÎNGUSTE, citite din `backend/src/routes/customerCommunications.ts` — nu `any`.
 */
import { apiGet, apiPost, apiPatch } from './apiClient';

export type CommunicationOption = { value: string; label: string };

export type CommunicationRecord = {
  id: string;
  reference: number;
  channel: string;
  channelLabel: string;
  direction: string;
  directionLabel: string;
  /** ISO complet — ora contează, deci ecranul o arată. */
  occurredAt: string;
  summary: string;
  recordedBy: string;
  jobId: string | null;
  /** ⚠️ Numărul citit de om, compus pe server. */
  jobLabel: string | null;
  /** ⚠️ Propoziția vine de la SERVER: firul de istoric spune același lucru despre același rând. */
  headline: string;
};

/**
 * 🆕 §20 „Preferred channel" (Sesiunea 158) — cum a cerut omul să fie contactat, adus lângă
 * formularul în care se notează discuția.
 *
 * ⚠️ **`suggestedChannel` poate fi `null`**, și e o hotărâre: cele două vocabulare nu se contopesc.
 * Clientul alege dintre `phone | sms | whatsapp | email | app`, registrul consemnează pe
 * `phone | message | email | letter | in-person` — iar `app` **nu are canal**, fiindcă mesajele din
 * aplicație nu sunt o discuție „din afară". ⛔ Atunci formularul nu pornește dintr-o potrivire
 * inventată, dar preferința se arată oricum.
 */
export type ContactPreference = {
  method: string | null;
  /** Eticheta vine de la server, ca ecranul să nu aibă un al doilea vocabular. */
  methodLabel: string | null;
  window: string | null;
  windowLabel: string | null;
  note: string | null;
  suggestedChannel: string | null;
};

export type CommunicationsResponse = {
  records: CommunicationRecord[];
  listNote?: string | null;
  breakdown: {
    total: number;
    byChannel: { value: string; label: string; count: number }[];
    byDirection: { value: string; label: string; count: number }[];
  };
  options: { channels: CommunicationOption[]; directions: CommunicationOption[] };
  /** 🆕 §20 „Preferred channel". `null` când fișa clientului nu s-a putut citi. */
  contactPreference?: ContactPreference | null;
};

export function getCustomerCommunications(params: { customerId: string; channel?: string }) {
  return apiGet<CommunicationsResponse>('/customer-communications', params);
}

export function logCustomerCommunication(data: {
  customerId: string; channel: string; direction: string; occurredAt: string;
  summary: string; jobId?: string | null;
}) {
  return apiPost<{ success: boolean; record: CommunicationRecord; auditWarning?: string | null }>(
    '/customer-communications', data,
  );
}

/**
 * Corectarea unui rând scris greșit. ⛔ Nu există ștergere, deliberat: un rând șters ar fi singurul
 * mod de a face să dispară ce s-a promis unui client — exact informația pentru care registrul există.
 */
export function correctCustomerCommunication(id: string, data: {
  channel?: string; direction?: string; occurredAt?: string; summary?: string;
}) {
  return apiPatch<{ success: boolean; record: CommunicationRecord; auditWarning?: string | null }>(
    `/customer-communications/${id}`, data,
  );
}

