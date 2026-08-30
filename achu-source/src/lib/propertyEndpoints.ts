/**
 * CASELE UNUI CLIENT — apelurile către server.
 *
 * 🔴 **De ce un fișier separat, și e chiar regula:** `src/lib/endpoints.ts` e la **exact**
 * clichetul lui de mărime (ACHU-571), iar plafonul nu se ridică — se extrage ce a crescut.
 * Aceeași mișcare pe care ACHU-574 a făcut-o cu tipurile (`propertyTypes.ts`), acum cu
 * funcțiile. ⚠️ `endpoints.ts` le **re-exportă**, deci niciun apelant nu simte mutarea.
 */
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from './apiClient';
import type {
  PropertyRecord, PropertyInputBody, MyProperty, PropertyChecklistPoint, PropertyHistory,
  PropertyFileList, PropertyFileKind,
} from './propertyTypes';

// ─── Biroul: fișa clientului ────────────────────────────────────────

export function getCustomerProperties(params: { customerId: string }) {
  return apiGet<{ records: PropertyRecord[] }>(`/properties/${params.customerId}`, {});
}

export function addCustomerProperty(params: { customerId: string } & PropertyInputBody) {
  return apiPost<{ success: boolean; id: string; isPrimary: boolean }>('/properties', params);
}

export function updateCustomerProperty(params: { id: string; isActive?: boolean } & PropertyInputBody) {
  const { id, ...body } = params;
  return apiPut<{ success: boolean; id: string; primaryMovedTo: string | null }>(`/properties/${id}`, body);
}

export function makeCustomerPropertyPrimary(params: { id: string }) {
  return apiPost<{ success: boolean; id: string }>(`/properties/${params.id}/primary`, {});
}

export function deleteCustomerProperty(params: { id: string }) {
  return apiDelete<{ success: boolean }>(`/properties/${params.id}`);
}

// ─── ACHU-576: clientul, în portalul lui ────────────────────────────

/**
 * ⛔ **Fără niciun parametru de identitate.** Cine ești se citește din SESIUNE, pe server —
 * lecția ACHU-528: o rută care primește un `customerId` din browser e o rută care poate fi
 * întoarsă spre datele altcuiva.
 */
export function getMyProperties() {
  return apiGet<{ records: MyProperty[] }>('/customer-portal/properties', {});
}

/**
 * Instrucțiunile de acces ale UNEI case. ⚠️ Trimite **doar** câmpurile de acces: eticheta,
 * adresa și nota biroului rămân ale biroului (adresa casei principale e adresa de facturare).
 */
export function updateMyPropertyAccess(params: { id: string } & Partial<PropertyInputBody>) {
  const { id, ...body } = params;
  return apiPatch<{ success: boolean; property: MyProperty }>(`/customer-portal/properties/${id}/access`, body);
}

/**
 * §19 „Manage properties", Sesiunea 142 — **clientul își gestionează casele**, decizia Archanei
 * din 19/08/2026.
 *
 * ⛔ **Cele patru funcții trimit DOAR nume/adresă/cod poștal.** Camerele, dotările și prețul pe
 * vizită rămân ale biroului: sunt câmpurile din care se calculează o sumă. Serverul le ignoră
 * oricum (schema lui nu le are), dar un apel care le-ar trimite ar sugera că se pot scrie.
 */
export type PortalPropertyIdentity = { label?: string; address?: string | null; postcode?: string | null };

/** ⚠️ Casa nouă nu devine principală — vezi `makeMyPropertyPrimary`, care e o apăsare separată. */
export function addMyProperty(body: { label: string; address?: string | null; postcode?: string | null }) {
  return apiPost<{ success: boolean; property: MyProperty; auditWarning?: string }>('/customer-portal/properties', body);
}

/**
 * ⚠️ **Trimite doar câmpurile schimbate**: cheia absentă înseamnă „nu atinge", iar un obiect cu
 * toate trei ar goli ce nu s-a editat.
 *
 * `notice` vine de la server când adresa s-a schimbat cu adevărat: vizitele deja programate
 * păstrează adresa cu care au fost programate.
 */
export function updateMyPropertyIdentity(params: { id: string } & PortalPropertyIdentity) {
  const { id, ...body } = params;
  return apiPatch<{
    success: boolean; property: MyProperty;
    addressChanged: boolean; billingAddressMoved: boolean; notice?: string; auditWarning?: string;
  }>(`/customer-portal/properties/${id}`, body);
}

/** 🔴 Mută adresa de facturare — de aceea e o apăsare proprie, cu textul lângă ea. */
export function makeMyPropertyPrimary(params: { id: string }) {
  return apiPost<{ success: boolean; id: string; alreadyPrimary?: boolean }>(`/customer-portal/properties/${params.id}/primary`, {});
}

/** ⛔ Stinge, nu șterge (`AGENT_RULES` §15). Nu există drum invers din portal. */
export function switchOffMyProperty(params: { id: string }) {
  return apiPost<{
    success: boolean; property: MyProperty; primaryMovedTo: string | null; alreadyOff: boolean;
  }>(`/customer-portal/properties/${params.id}/switch-off`, {});
}

// ─── ACHU-577: punctele de checklist ale unei case ──────────────────

/**
 * ⚠️ **Prefix propriu, nu `/properties/:id/checklist`** — ruta de proprietăți are deja
 * `GET /:customerId`, care ar fi înghițit orice cale nouă de sub ea.
 */
export function getPropertyChecklist(params: { propertyId: string }) {
  return apiGet<{ records: PropertyChecklistPoint[] }>(`/property-checklist/${params.propertyId}`, {});
}

/** ⚠️ §16: `required` absent = obligatoriu. Muncă scrisă de birou pe o casă e muncă de făcut. */
export function addPropertyChecklistPoint(params: { propertyId: string; label: string; required?: boolean; photoRequired?: boolean }) {
  return apiPost<{ success: boolean; id: string }>('/property-checklist', params);
}

export function updatePropertyChecklistPoint(params: { id: string; label?: string; sortOrder?: number; required?: boolean; photoRequired?: boolean }) {
  const { id, ...body } = params;
  return apiPut<{ success: boolean; id: string }>(`/property-checklist/${id}`, body);
}

export function deletePropertyChecklistPoint(params: { id: string }) {
  return apiDelete<{ success: boolean }>(`/property-checklist/${params.id}`);
}

// ─── ACHU-579: istoricul unei case ──────────────────────────────────

/**
 * ⚠️ **Prefix propriu**, din același motiv ca la checklist: `/properties` are deja
 * `GET /:customerId`, care ar fi înghițit orice cale nouă de sub el.
 */
export function getPropertyHistory(params: { propertyId: string }) {
  return apiGet<PropertyHistory>(`/property-history/${params.propertyId}`, {});
}

// ─── ACHU-581: pozele și documentele unei case ──────────────────────

/**
 * ⛔ **Admin-only pe server** (`requireRole('Admin')`) — decizia lui Roberto din 14/08/2026:
 * *„doar biroul"*. ⚠️ Prefix propriu, ca la checklist și istoric.
 */
export function getPropertyFiles(params: { propertyId: string }) {
  return apiGet<PropertyFileList>(`/property-files/${params.propertyId}`, {});
}

/** ⚠️ `fileData` e base64, cu sau fără prefixul `data:...;base64,` — serverul acceptă ambele. */
export function uploadPropertyFile(params: {
  propertyId: string;
  kind: PropertyFileKind;
  filename: string;
  fileData: string;
  label?: string | null;
}) {
  return apiPost<{ success: boolean; id: string }>('/property-files/upload', params);
}

export function deletePropertyFile(params: { id: string }) {
  return apiDelete<{ success: boolean }>(`/property-files/${params.id}`);
}

