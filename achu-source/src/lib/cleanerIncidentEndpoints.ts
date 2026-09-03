/**
 * §15 „Report incident" (Sesiunea 160) — două citiri și o scriere, atât.
 *
 * ⛔ **`cleanerId` NU se trimite de aici.** Vine din sesiune, pe server — un curățător nu poate
 * deschide un incident în numele altuia.
 */
import { apiGet, apiPost } from './apiClient';

export type MyIncident = {
  id: string;
  incidentId: number;
  kind: string;
  severity: string;
  status: string;
  occurredOn: string;
  description: string;
};

export function reportIncident(body: {
  kind: string; severity: string; occurredOn: string; description: string;
  immediateAction?: string | null; jobId?: string | null;
}) {
  return apiPost<{ success: true; id: string; incidentId: number; legalNote: string | null }>('/my-incidents', body);
}

export function getMyIncidents() {
  return apiGet<{ incidents: MyIncident[] }>('/my-incidents', {});
}

/**
 * §15 „Upload damage photos" (Sesiunea 160) — dovada, pe incidentul lui.
 *
 * ⛔ Doar pe unul DESCHIS și doar pe al lui: serverul verifică amândouă. ⚠️ Poza se micșorează
 * înainte de trimitere (`prepareImageForUpload`), ca la punctele de checklist.
 */
export function addIncidentPhoto(incidentId: string, imageData: string, description?: string) {
  return apiPost<{ success: true; record: { id: string; description: string | null; uploadedAt: string } }>(
    `/my-incidents/${incidentId}/photos`, { imageData, ...(description ? { description } : {}) },
  );
}

