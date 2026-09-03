/**
 * 🔴 ACHU-770 / §45 „Breach-response workflow" (Sesiunea 148) — REGISTRUL BREȘELOR DE DATE.
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `endpoints.ts`** (`AGENT_RULES` §7): catalogul e la
 * clichetul lui de mărime, iar felia asta aduce o formă întreagă.
 *
 * ⚠️ **Ceasul și „ce lipsește" vin de la SERVER**, nu se calculează aici: ceasul unui telefon poate
 * fi greșit, iar diferența dintre „mai ai 4 ore" și „ai depășit" e o obligație legală (art. 33).
 */
import { apiGet, apiPost } from './apiClient';

/** Ce spune serverul despre termenul de 72 de ore al unui rând. Motivele: `lib/dataBreachPolicy.ts`. */
export type BreachClock = {
  dueAt: string;
  state: 'reported' | 'reported-late' | 'not-reported' | 'not-reported-no-reason' | 'due' | 'overdue';
  /** Ore rămase (pozitiv) sau peste termen (negativ). */
  hours: number;
  /** Propoziția pentru ecran, compusă pe server ca cele două ecrane să nu scrie fiecare alta. */
  label: string;
};

export type BreachRecord = {
  id: string;
  breachId: number;
  discoveredAt: string;
  /** `YYYY-MM-DD` sau `null` — nu s-a putut stabili când s-a întâmplat. */
  occurredOn: string | null;
  summary: string;
  dataTypes: string | null;
  peopleCount: number | null;
  containment: string | null;
  reportedToIco: boolean;
  reportedAt: string | null;
  icoReference: string | null;
  notReportedReason: string | null;
  peopleTold: boolean;
  peopleToldAt: string | null;
  status: 'Open' | 'Closed';
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  clock: BreachClock;
  /** Ce lipsește ca rândul să fie complet, în cuvintele omului. ⛔ Raportat, nu impus. */
  missing: string[];
};

export type BreachRegister = {
  records: BreachRecord[];
  openCount: number;
  overdueCount: number;
  /** 🔴 Rânduri „nu raportăm" fără motiv scris — chiar întrebarea pe care o pune ICO. */
  withoutReasonCount: number;
};

export function getDataBreaches() {
  return apiGet<BreachRegister>('/data-breaches', {});
}

/**
 * Scrie o breșă. ⚠️ Doar două câmpuri sunt cerute de server: ce s-a întâmplat și **când s-a aflat**
 * (de la el curge termenul). ⛔ Restul se raportează ca lipsă, nu se impune — un formular care ar
 * refuza în prima oră ar face ca breșa să nu fie consemnată deloc.
 */
export function recordDataBreach(data: {
  discoveredAt: string; summary: string; occurredOn?: string | null; dataTypes?: string | null;
  peopleCount?: number | null; containment?: string | null;
}) {
  return apiPost<{ success: true; record: BreachRecord }>('/data-breaches', data);
}

/** Actualizează un rând. ⚠️ Nimic nu e imuabil: în primele ore se scrie ce se știe. */
export function updateDataBreach(params: { id: string } & Partial<{
  discoveredAt: string; occurredOn: string | null; summary: string; dataTypes: string | null;
  peopleCount: number | null; containment: string | null;
  reportedToIco: boolean; reportedAt: string | null; icoReference: string | null;
  notReportedReason: string | null; peopleTold: boolean; peopleToldAt: string | null;
  status: 'Open' | 'Closed';
}>) {
  const { id, ...body } = params;
  return apiPost<{ success: true; record: BreachRecord }>(`/data-breaches/${id}`, body);
}

