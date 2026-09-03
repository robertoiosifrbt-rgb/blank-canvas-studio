/**
 * §31 „Quality assurance" (Sesiunea 145) — VERIFICĂRILE DE CALITATE.
 *
 * ⛔ **Fișier propriu**: `endpoints.ts` e exact pe clichetul de mărime, iar felia aduce un tip întreg
 * plus trei funcții. Ecranele importă direct de aici, ca la `reCleanEndpoints`.
 *
 * 🔴 **Regulile sunt pe SERVER**, nu aici: un „nu a trecut" cere ce s-a văzut ȘI ce se face, un
 * verdict nu se dă de două ori, iar nota pe care o scrie verificarea e **nota biroului** din §36 —
 * nu o a doua cifră. Ce vine spre ecran e doar cât să nu se ceară ceva ce va fi refuzat.
 */
import { apiGet, apiPost } from './apiClient';

export type QualityCheckRecord = {
  id: string;
  qualityCheckId: number;
  /** `Required` | `Passed` | `Failed`. */
  status: string;
  /** ⚠️ O propoziție, nu o stare. `null` unde nu e nimic de făcut. */
  nextStep: string | null;
  /** `Manual` | `Sampling` — un om a cerut-o, sau a ieșit la tragerea la sorți. */
  source: string;
  requestedBy: string;
  requestedNote: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
  photosReviewed: boolean;
  checklistReviewed: boolean;
  findings: string | null;
  correctiveAction: string | null;
  createdAt: string;
  /** Numerele citite de om, nu `cuid`-uri (dar `jobId` rămâne, pentru legături). */
  jobId: string;
  jobRef: number;
  jobDate: string;
  service: string;
  customerName: string | null;
  cleaners: string[];
  /** 🔴 Câte sunt DE PRIVIT. Fără ele, „am privit pozele" nu se poate bifa cinstit. */
  photoCount: number;
  checklistCount: number;
  /** Nota biroului — cea pe care o scrie verificarea. `null` = nimeni nu a judecat vizita încă. */
  officeScore: number | null;
  officeNote: string | null;
  /** Ce a spus clientul. Read-only aici: biroul nu-i atinge nota. */
  customerScore: number | null;
};

export type QualityCheckListResponse = {
  records: QualityCheckRecord[];
  counts: { waiting: number; failed: number };
  /** ⚠️ Propoziția care spune cine NU vede asta, și la ce nu se adaugă cifra. Vine de pe server. */
  audience: string;
  /** ⚠️ Că un verdict dat nu se mai editează — spus înainte de a fi apăsat, nu după. */
  evidenceNote: string;
  /**
   * 🔴 ACHU-786 — **propoziția care spune că lista e tăiată, și că partea deschisă NU e.** `null` =
   * nu s-a tăiat nimic. ⛔ O listă scurtată în tăcere e o minciună despre cât are firma.
   */
  historyNote: string | null;
};

export function getQualityChecks(params: { status?: string } = {}) {
  return apiGet<QualityCheckListResponse>('/quality-checks', params);
}

/** „Uită-te la vizita asta." ⚠️ Motivul e opțional — nu orice cerere are un „de ce". */
export function requestQualityCheck(data: { jobId: string; requestedNote?: string | null }) {
  return apiPost<{ success: true; id: string; qualityCheckId: number }>('/quality-checks', data);
}

/**
 * 🔴 **Trage la sorți, nu judecă.** ⚠️ Serverul spune și **din câte** a ales: „am cerut 10 și am
 * primit 3" fără cifra aia arată ca un defect, când atâtea vizite neverificate existau.
 */
export function sampleQualityChecks(data: { count: number; from: string; to: string }) {
  return apiPost<{ success: true; picked: number; availableToPickFrom: number }>('/quality-checks/sample', data);
}

/** 🔴 Verdictul. `score` e nota BIROULUI — aceeași scală, același rând ca §36. */
export function recordQualityCheck(params: {
  id: string;
  outcome: 'Passed' | 'Failed';
  score: number;
  photosReviewed: boolean;
  checklistReviewed: boolean;
  findings?: string | null;
  correctiveAction?: string | null;
}) {
  const { id, ...body } = params;
  return apiPost<{ success: true }>(`/quality-checks/${id}/record`, body);
}

