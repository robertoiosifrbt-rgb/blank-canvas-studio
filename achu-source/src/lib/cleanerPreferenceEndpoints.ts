/**
 * ACHU-554 — CURĂȚĂTORUL PREFERAT SAU INTERZIS DE UN CLIENT, ca endpointuri.
 *
 * ⛔ **MUTATE AICI din `endpoints.ts` în Sesiunea 152**, fiindcă acela era **exact** pe clichetul lui
 * de mărime (236) și felia de §20 adăuga o linie. ⚠️ Regula (`AGENT_RULES` §7.4) cere să extragi o
 * responsabilitate, nu să ridici cifra — iar „pe cine vrea și pe cine nu vrea în casă" e una întreagă.
 *
 * ⚠️ Același tipar ca `propertyEndpoints.ts` și `endpointsIncidents.ts`, care au plecat din același
 * fișier pentru același motiv. `endpoints.ts` face `export * from './cleanerPreferenceEndpoints'`,
 * deci **niciun ecran nu se schimbă**.
 */
import { apiGet, apiPost, apiDelete } from './apiClient';

/**
 * ACHU-554 (Sesiunea 121) — curățătorul preferat sau interzis de un client.
 *
 * ⚠️ `kind` e `string`, nu o uniune: felurile trăiesc pe server
 * (`backend/src/lib/cleanerPreferencePolicy.ts`). Un fel nou nu cere o editare aici.
 */
export function getCustomerCleanerPreferences(params: { customerId: string }) {
  return apiGet<{
    preferences: {
      id: string;
      cleanerId: string;
      cleanerName: string;
      cleanerActive: boolean;
      kind: string;
      reason: string | null;
      createdAt: string;
      createdBy: string | null;
    }[];
  }>(`/customers/${params.customerId}/cleaner-preferences`, {});
}

export function addCustomerCleanerPreference(params: { customerId: string; cleanerId: string; kind: string; reason?: string }) {
  const { customerId, ...body } = params;
  return apiPost<{ success: boolean; id: string }>(`/customers/${customerId}/cleaner-preferences`, body);
}

export function removeCustomerCleanerPreference(params: { customerId: string; preferenceId: string }) {
  return apiDelete<{ success: boolean }>(`/customers/${params.customerId}/cleaner-preferences/${params.preferenceId}`);
}

