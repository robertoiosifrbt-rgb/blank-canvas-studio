/**
 * ACHU-401, felia a noua — funcțiile de BOALĂ, scoase din `endpoints.ts`.
 *
 * ⛔ Nu din estetică: `endpoints.ts` e la plafonul lui de mărime și **nu are voie să crească**
 * (`AGENT_RULES` §7). Tipurile de aici au adăugat un rând, iar regula cere ca felia care are nevoie
 * de spațiu să **iasă** din fișier — a cincea oară când se întâmplă exact asta.
 *
 * ⚠️ Formele răspunsurilor sunt în `absenceTypes.ts`, citite din ruta care le produce.
 */
import { apiGet, apiPost, apiPatch } from './apiClient';
import type {
  SicknessListResponse, SicknessMutation, SspPreview,
  FamilyLeaveListResponse, FamilyLeaveMutation, FamilyLeavePreview,
} from './absenceTypes';

export function getSickness(params: { cleanerId?: string; from?: string; to?: string } = {}) {
  return apiGet<SicknessListResponse>('/sickness', params);
}

/** Prices a spell WITHOUT storing it, so the office sees the figure before saving. */
export function previewSickness(params: {
  cleanerId: string; startDate: string; endDate?: string | null; qualifyingWeekdays: string;
}) {
  return apiGet<SspPreview>('/sickness/preview', params);
}

export function createSickness(data: Record<string, unknown>) {
  return apiPost<SicknessMutation>('/sickness', data);
}

export function updateSickness(id: string, data: Record<string, unknown>) {
  return apiPatch<SicknessMutation>(`/sickness/${id}`, data);
}

export function endSickness(id: string, endDate: string) {
  return apiPost<SicknessMutation>(`/sickness/${id}/end`, { endDate });
}

export function recordReturnToWork(id: string, returnToWorkOn: string, note?: string | null) {
  return apiPost<SicknessMutation>(`/sickness/${id}/return-to-work`, { returnToWorkOn, note: note ?? null });
}

export function attachFitNote(id: string, path: string, from?: string | null, to?: string | null) {
  return apiPost<SicknessMutation>(`/sickness/${id}/fit-note`, { path, from: from ?? null, to: to ?? null });
}

export function cancelSickness(id: string, reason: string) {
  return apiPost<SicknessMutation>(`/sickness/${id}/cancel`, { reason });
}

export function getFamilyLeave(params: { cleanerId?: string; type?: string; from?: string; to?: string } = {}) {
  return apiGet<FamilyLeaveListResponse>('/family-leave', params);
}

/** Prices a spell WITHOUT storing it. Refuses when there are no average earnings. */
export function previewFamilyLeave(params: {
  cleanerId: string; type: string; startDate: string; weeks: number; previousYearClass1NiPence?: number;
}) {
  return apiGet<FamilyLeavePreview>('/family-leave/preview', params);
}

export function createFamilyLeave(data: Record<string, unknown>) {
  return apiPost<FamilyLeaveMutation>('/family-leave', data);
}

export function updateFamilyLeave(id: string, data: Record<string, unknown>) {
  return apiPatch<FamilyLeaveMutation>(`/family-leave/${id}`, data);
}

export function endFamilyLeave(id: string, endDate: string) {
  return apiPost<FamilyLeaveMutation>(`/family-leave/${id}/end`, { endDate });
}

export function cancelFamilyLeave(id: string, reason: string) {
  return apiPost<FamilyLeaveMutation>(`/family-leave/${id}/cancel`, { reason });
}

