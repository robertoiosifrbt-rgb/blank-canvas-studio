/**
 * §33 + §14 (Sesiunea 146) — hârtiile unui curățător, dinspre ecran.
 *
 * ⛔ **Fișier propriu**, ca `qualityCheckEndpoints`: `cleanerEndpoints.ts` e despre fișa omului, iar
 * asta e un registru cu ciclul lui de viață.
 */
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

/** `NoExpiry` = hârtia nu are termen · `Valid` · `ExpiringSoon` · `Expired`. */
export type ExpiryState = 'NoExpiry' | 'Valid' | 'ExpiringSoon' | 'Expired';

export type CleanerDocumentRecord = {
  id: string;
  reference: number;
  kind: string;
  kindLabel: string;
  label: string | null;
  status: 'AwaitingVerification' | 'Verified' | 'Rejected';
  effectiveDate: string | null;
  expiryDate: string | null;
  /** 🔴 **Calculat de server la fiecare citire**, nu o coloană din bază. */
  expiry: ExpiryState;
  recordedBy: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  /** O propoziție despre ce e de făcut, sau `null` dacă nu e nimic. */
  nextStep: string | null;
};

export type CleanerDocumentType = { key: string; label: string; expiresTypically: boolean };

export function getCleanerDocuments(cleanerId: string) {
  /**
   * ⚠️ `types`, `audience` și `expiryWarningDays` vin de la SERVER. ⛔ Scrise în ecran, ar fi a doua
   * copie a politicii — iar cea greșită ar fi chiar cea citită de un om.
   */
  return apiGet<{
    records: CleanerDocumentRecord[];
    types: CleanerDocumentType[];
    audience: string;
    expiryWarningDays: number;
    /**
     * 🆕 §33 „Compliance status" (Sesiunea 158) — ce îi lipsește omului din cele trei obligatorii.
     * ⛔ Gol = e în regulă. `complianceNote` e `null` atunci, iar ecranul nu desenează nimic:
     * un rând care spune „e în regulă" pe fiecare fișă, în fiecare zi, e zgomot.
     */
    complianceGaps: { kind: string; label: string; reason: string; note: string }[];
    complianceNote: string | null;
  }>(`/cleaner-documents/${cleanerId}`);
}

type WriteResult = { success: true; auditWarning?: string };

export function addCleanerDocument(data: {
  cleanerId: string; kind: string; label?: string | null;
  effectiveDate?: string | null; expiryDate?: string | null;
}) {
  return apiPost<WriteResult & { id: string }>('/cleaner-documents', data);
}

/** ⚠️ Cheia ABSENTĂ = „nu atinge"; `null` = „șterge". */
export function updateCleanerDocument(id: string, data: Record<string, unknown>) {
  return apiPut<WriteResult & { verificationCleared: boolean }>(`/cleaner-documents/${id}`, data);
}

/** ⚠️ Un „nu" cere motiv — serverul refuză fără el, cu exemple în mesaj. */
export function recordCleanerDocumentVerdict(id: string, data: {
  verdict: 'Verified' | 'Rejected'; rejectionReason?: string | null;
}) {
  return apiPost<WriteResult>(`/cleaner-documents/${id}/verdict`, data);
}

export function deleteCleanerDocument(id: string) {
  return apiDelete<WriteResult>(`/cleaner-documents/${id}`);
}

