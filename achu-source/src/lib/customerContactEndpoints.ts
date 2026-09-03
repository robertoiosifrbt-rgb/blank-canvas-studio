/**
 * §4 „Multiple contacts per customer" (Sesiunea 160) — OAMENII DIN JURUL UNEI FIȘE, ca endpointuri.
 *
 * ⛔ **Fișier propriu**, ca `cleanerPreferenceEndpoints.ts` și `propertyEndpoints.ts`: `endpoints.ts`
 * e pe clichetul lui de mărime, iar „pe cine suni și de ce" e o responsabilitate întreagă.
 * ⚠️ `endpoints.ts` face `export * from './customerContactEndpoints'`, deci ecranele importă de acolo.
 */
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

/**
 * Un contact din jurul fișei.
 *
 * ⚠️ `role` e `string`, nu o uniune: lista trăiește pe server
 * (`backend/src/lib/customerContactPolicy.ts` — `CUSTOMER_CONTACT_ROLES`). Un rol nou nu cere o
 * editare aici. ⛔ Etichetele citite de om vin din `customerContactLabels.ts`, ca ecranul, PDF-ul și
 * un export să spună aceleași cuvinte.
 */
export type CustomerContact = {
  id: string;
  customerContactId: number;
  customerId: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  /** Cel mult unul pe fișă din fiecare — serverul MUTĂ semnul, nu refuză salvarea. */
  isPrimary: boolean;
  isBilling: boolean;
  isEmergency: boolean;
  createdAt: string;
  createdBy: string | null;
};

export type CustomerContactInput = {
  name: string;
  role: string;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
  isPrimary?: boolean;
  isBilling?: boolean;
  isEmergency?: boolean;
};

export function getCustomerContacts(customerId: string) {
  return apiGet<{ contacts: CustomerContact[] }>(`/customer-contacts/${customerId}`, {});
}

export function addCustomerContact(customerId: string, body: CustomerContactInput) {
  return apiPost<{ contact: CustomerContact; auditWarning?: string }>(`/customer-contacts/${customerId}`, body);
}

export function updateCustomerContact(customerId: string, id: string, body: CustomerContactInput) {
  return apiPut<{ contact: CustomerContact; auditWarning?: string }>(`/customer-contacts/${customerId}/${id}`, body);
}

export function deleteCustomerContact(customerId: string, id: string) {
  return apiDelete<{ success: true; auditWarning?: string }>(`/customer-contacts/${customerId}/${id}`);
}

