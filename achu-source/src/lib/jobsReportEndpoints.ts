/**
 * §38 „Jobs report" (Sesiunea 155) — apelul, plus forma răspunsului.
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `reportEndpoints.ts`**, și nu din estetică: acela e la
 * **445 din 500** de rânduri de cod, iar plafonul nu se ridică (`AGENT_RULES` §7). ⚠️ Al doilea
 * raport pus acolo l-ar fi împins peste — deci felia aceasta **iese**, în loc să ceară o excepție.
 * 🔴 Aceeași alegere ca la `actionCentreCleanerDocuments.ts` și la celelalte douăzeci și două de
 * extrageri din catalogul de endpointuri: o felie iese ca să încapă.
 *
 * ⚠️ Fiecare câmp e citit din `backend/src/lib/jobsReportPolicy.ts` — de acolo vin și nulabilitățile
 * (`percent` e `null`, nu `0`, când nu există numitor).
 */
import { apiGet, apiDownloadPost } from './apiClient';

export type JobsCountGroup = { key: string; count: number };

/** ⛔ `percent` e `null` când numitorul e 0 — nu `0%`, care ar afirma ceva despre nimic. */
export type JobsShare = { count: number; percent: number | null };

export type JobsServiceLine = {
  key: string;
  total: number;
  completed: number;
  didNotHappen: number;
  percentDidNotHappen: number | null;
};

export type JobsReportResponse = {
  period: { from: string; to: string; days: number };
  /** Munca din calendar: tot ce nu e cerere de ofertă. Numitorul fiecărui procent. */
  bookedWork: number;
  /** ⚠️ Numărate separat, ținute în afara numitorului. */
  enquiries: number;
  outcome: { completed: number; cancelled: number; noAccess: number; stillOpen: number };
  /** 🔴 Anulate + fără acces — cifra pentru care există raportul. */
  didNotHappen: JobsShare;
  /** ⚠️ Rândul lui: un drum făcut degeaba se repară altfel decât o anulare. */
  noAccess: JobsShare;
  byStatus: JobsCountGroup[];
  byService: JobsServiceLine[];
  byArrangement: JobsCountGroup[];
  /** Toate șapte zilele, inclusiv cele cu zero. */
  byWeekday: JobsCountGroup[];
  cleaner: { noneRecorded: number; completedWithoutCleaner: number };
  trend: Array<{ month: string; total: number; completed: number; didNotHappen: number }>;
  notes: {
    noMoney: string; noCancelReason: string; enquiries: string; noAccess: string;
    period: string; cleanerRecorded: string; capacity: string;
  };
};

export function getJobsReport(params: { from?: string; to?: string } = {}) {
  return apiGet<JobsReportResponse>('/jobs-report', params);
}

/** ⚠️ `POST`, ca celelalte exporturi (ACHU-779): metoda e poarta pentru contul „doar citire". */
export function exportJobsReport(params: { from?: string; to?: string } = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiDownloadPost(`/jobs-report/export${qs ? `?${qs}` : ''}`, {}, 'ACHU-jobs-report.csv');
}

