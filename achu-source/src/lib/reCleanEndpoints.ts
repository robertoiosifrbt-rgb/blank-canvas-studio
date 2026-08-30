/**
 * §30 „Re-clean workflow" (Sesiunea 144) — RE-CURĂȚENIILE.
 *
 * ⛔ **Fișier propriu**: `endpoints.ts` e exact pe clichetul de mărime, iar felia aduce un tip întreg
 * plus patru funcții. Ecranele importă direct de aici, ca la `taskEndpoints`.
 *
 * 🔴 **Cele trei decizii ale owner-ului (20/08/2026) sunt impuse pe SERVER**, nu aici: gratis
 * (constantă), doar el aprobă (rând de setări, se eșuează închis), curățătorul e plătit ca la orice
 * vizită. ⚠️ Ce vine spre ecran e doar cât să nu arate un buton care ar fi refuzat.
 */
import { apiGet, apiPost } from './apiClient';

export const RECLEAN_SOURCES = ['Customer', 'Admin', 'QualityCheck'] as const;
export type ReCleanSource = typeof RECLEAN_SOURCES[number];

export const CLEANER_PREFERENCES = ['NoPreference', 'Same', 'Different'] as const;
export type CleanerPreference = typeof CLEANER_PREFERENCES[number];

export type ReCleanRecord = {
  id: string;
  reCleanId: number;
  /** `Requested` | `Approved` | `Declined` — hotărârea. */
  status: string;
  /**
   * 🔴 **Ce s-a întâmplat de fapt**, citit din vizită pe server: `Requested` · `Declined` ·
   * `Awaiting booking` · `Booked` · `Done` · `Cancelled`. ⛔ Nu se recalculează pe ecran.
   */
  outcome: string;
  /** ⚠️ O propoziție, nu o stare. `null` unde nu e nimic de făcut. */
  nextStep: string | null;
  source: string;
  reason: string;
  cleanerPreference: string;
  dueDate: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  requestedBy: string | null;
  createdAt: string;
  /** Numerele citite de om și numele clientului — nu `cuid`-uri. */
  originalJobRef: number;
  originalJobDate: string;
  originalService: string;
  customerName: string | null;
  reCleanJobRef: number | null;
  reCleanJobDate: string | null;
  complaintRef: number | null;
};

export type ReCleanListResponse = {
  records: ReCleanRecord[];
  counts: { waiting: number };
  /**
   * ⚠️ **Dacă cel care s-a uitat poate hotărî** — calculat pe server, din ROL. ⛔ Nu e o măsură de
   * securitate (aceea e `requireSuperAdmin()` pe rută); e ca butonul să nu apară în contul „doar
   * citire", unde ar fi refuzat.
   */
  canDecide: boolean;
  /**
   * 🔴 ACHU-786 — **propoziția care spune că lista e tăiată, și că partea deschisă NU e.** `null` =
   * nu s-a tăiat nimic. ⛔ O listă scurtată în tăcere e o minciună despre cât are firma.
   */
  historyNote: string | null;
};

export function getReCleans(params: { status?: string } = {}) {
  return apiGet<ReCleanListResponse>('/re-cleans', params);
}

export function requestReClean(data: {
  originalJobId: string; source: ReCleanSource; reason: string;
  cleanerPreference?: CleanerPreference; dueDate?: string | null; customerRequestId?: string | null;
}) {
  return apiPost<{ success: true; id: string; reCleanId: number }>('/re-cleans', data);
}

/** ⚠️ Un singur drum pentru „da" și „nu": aceeași hotărâre, luată de aceeași persoană. */
export function decideReClean(params: { id: string; status: 'Approved' | 'Declined'; decisionNote?: string | null }) {
  const { id, ...body } = params;
  return apiPost<{ success: true }>(`/re-cleans/${id}/decide`, body);
}

/** 🔴 Aici se aplică „gratis" — suma nu se trimite, vine din constanta serverului. */
export function bookReClean(params: { id: string; jobDate: string }) {
  return apiPost<{ success: true; jobId: string; jobRef: number }>(`/re-cleans/${params.id}/book`, { jobDate: params.jobDate });
}

