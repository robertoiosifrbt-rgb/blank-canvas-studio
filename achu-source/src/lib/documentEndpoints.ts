/**
 * §33 „Document management" (Sesiunea 161) — drumurile către rută.
 *
 * ⚠️ **Fișier propriu**, ca la fișierele casei: `endpoints.ts` e la clichetul lui de mărime.
 */
import { apiGet, apiPost, apiDelete } from './apiClient';
import type { DocumentList, DocumentScope } from './documentTypes';

export function getDocuments(params: { scope: DocumentScope; ownerId?: string | null }) {
  return apiGet<DocumentList>('/documents', {
    scope: params.scope,
    ...(params.ownerId ? { ownerId: params.ownerId } : {}),
  });
}

export function uploadDocument(params: {
  scope: DocumentScope;
  ownerId?: string | null;
  kind: string;
  filename: string;
  fileData: string;
  label?: string | null;
  expiryDate?: string | null;
}) {
  return apiPost<{ success: true; id: string; auditWarning?: string }>('/documents/upload', params);
}

/**
 * 🔴 **`POST`, nu `GET`, și e chiar rândul „Download history" din §33.** ⛔ O descărcare SCRIE un
 * rând de audit — cine a luat hârtia, și când — iar o citire care schimbă starea nu are ce căuta pe
 * un `GET`: ar fi unită cu alte citiri identice (`apiGet` le unește) și repetată de orice
 * preîncărcare de browser, deci registrul ar minți în amândouă felurile.
 */
export function downloadDocument(params: { id: string }) {
  return apiPost<{ success: true; signedUrl: string }>(`/documents/${params.id}/download`, {});
}

export function deleteDocument(params: { id: string }) {
  return apiDelete<{ success: true }>(`/documents/${params.id}`);
}

