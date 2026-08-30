/**
 * NOTELE VIZITELOR — apelurile către server (§36 + ACHU-537).
 *
 * 🔴 **De ce un fișier separat, și e chiar regula:** `src/lib/endpoints.ts` era la **exact**
 * clichetul lui de mărime, iar desfacerea pe curățător și pe serviciu (§36, Sesiunea 142) i-a
 * adăugat un tip și trei câmpuri. `AGENT_RULES` §7 spune ce se face atunci: **se extrage**, nu se
 * ridică plafonul. Aceeași mișcare făcută deja de ACHU-574 cu `propertyTypes.ts` și de ACHU-571 cu
 * `propertyEndpoints.ts`. ⚠️ `endpoints.ts` le re-exportă, deci niciun apelant nu simte mutarea.
 */
import { apiGet, apiPut, apiPost } from './apiClient';

/**
 * ACHU-537 — nota clientului pentru o vizită încheiată.
 *
 * `PUT`, nu `POST`: e cel mult una per vizită, iar a doua trimitere o înlocuiește. `comment`
 * lipsă înseamnă „fără text" — ⛔ nu trimite `''`, fiindcă un text gol și un text șters
 * trebuie să ajungă la server ca același lucru, iar ruta face `trim()` și scrie `null`.
 */
export function rateJob(params: { jobId: string; score: number; comment?: string }) {
  return apiPut<{
    rating: { score: number; comment: string | null; updatedAt: string };
    auditWarning?: string;
  }>(`/customer-portal/jobs/${params.jobId}/rating`, { score: params.score, comment: params.comment });
}

/** O serie de note grupată — pe curățător sau pe serviciu (§36). */
type RatingSeries = {
  key: string;
  label: string;
  count: number;
  average: number | null;
  tooFewToJudge: boolean;
  months: { month: string; count: number; average: number | null }[];
};

/**
 * ACHU-537, partea biroului. ⚠️ `summary` se calculează pe TOATE notele, nu pe cele
 * filtrate — altfel media firmei s-ar schimba la fiecare filtru apăsat (vezi ruta).
 */
export function getJobRatings(params: { score?: number; withComment?: 'true' | 'false' } = {}) {
  return apiGet<{
    summary: {
      count: number;
      /** `null` = nicio notă încă. ⛔ Nu-l afișa ca 0: un zero e o notă foarte proastă. */
      average: number | null;
      distribution: Record<string, number>;
      withComment: number;
    };
    trend: { month: string; count: number; average: number | null }[];
    /**
     * §36 — aceeași fereastră de 12 luni, desfăcută pe curățător și pe serviciu.
     *
     * ⛔ **Nu e un clasament de oameni.** Clientul notează o VIZITĂ, deci una cu doi curățători
     * intră la amândoi, iar o notă mică poate fi despre timpul alocat sau despre o factură.
     * `tooFewToJudge` vine de la server tocmai ca ecranul să nu decidă singur când o medie
     * dintr-o singură notă „contează".
     */
    byCleaner: RatingSeries[];
    byService: RatingSeries[];
    minRatingsToJudge: number;
    records: {
      id: string; jobRatingId: number; score: number; comment: string | null;
      createdAt: string; updatedAt: string | null;
      customerName: string; customerEmail: string | null; customerPhone: string | null;
      jobNumber: number; jobDate: string; service: string | null; cleaners: string[];
      /**
       * §36 — cine a sunat clientul după o notă mică, și când. `null` = nimeni încă.
       * ⚠️ `needsFollowUp` vine de la SERVER: pragul de „notă mică" e al lui, ca ecranul să nu
       * aibă a doua definiție a aceluiași lucru.
       */
      followUp: { at: string; by: string; note: string | null } | null;
      needsFollowUp: boolean;
    }[];
    scale: number[];
  }>('/job-ratings', params);
}

/**
 * §36 — „am vorbit cu clientul".
 *
 * ⛔ **Nu schimbă nota clientului** și nu promite nimic: notă goală e un rezultat legitim
 * („nu era nevoie"). Serverul întoarce `alreadyFollowedUp` când altcineva a apucat primul,
 * cu numele lui — nu o eroare, fiindcă treaba e făcută.
 */
export function followUpJobRating(params: { id: string; note?: string | null }) {
  return apiPost<{
    success: boolean;
    alreadyFollowedUp: boolean;
    followedUpBy: string | null;
    followedUpAt?: string;
    message: string;
    auditWarning?: string;
  }>(`/job-ratings/${params.id}/follow-up`, { note: params.note ?? null });
}

// ─── §36 (Sesiunea 142): nota BIROULUI despre o vizită, și ce a spus curățătorul ──

/**
 * Ce știe firma despre vizită: nota ei și rapoartele celor care au fost acolo.
 *
 * ⚠️ **Amândouă în același răspuns**, fiindcă cine notează are nevoie să vadă întâi „nu am avut
 * destul timp" — altfel biroul pune 2 pentru o curățenie pe care nimeni nu o putea face în ora
 * alocată.
 */
export function getJobInternalRating(params: { jobId: string }) {
  return apiGet<{
    canRate: boolean;
    notRateableReason?: string;
    audience: string;
    rating: { score: number; note: string | null; ratedBy: string; updatedAt: string } | null;
    cleanerReports: {
      cleanerId: string; cleanerName: string | null; updatedAt: string;
      accessWorked: boolean | null; timeEnough: boolean | null; conditionWorseThanUsual: boolean | null;
    }[];
  }>(`/job-internal-ratings/${params.jobId}`, {});
}

/** ⛔ Nu ajunge la client, nu ajunge la curățător, și nu intră în satisfacția clienților. */
export function saveJobInternalRating(params: { jobId: string; score: number; note?: string | null }) {
  const { jobId, ...body } = params;
  return apiPut<{
    success: boolean;
    rating: { score: number; note: string | null; ratedBy: string; updatedAt: string };
    auditWarning?: string;
  }>(`/job-internal-ratings/${jobId}`, body);
}

/**
 * Ce spune CURĂȚĂTORUL despre o vizită încheiată: trei fapte despre muncă.
 *
 * ⛔ **Nimic despre client și niciun text liber** — decizia proprietarului din 19/08/2026. Textul
 * liber al curățătorului are casa lui: notele de finalizare a vizitei.
 * ⚠️ Trimite doar întrebările la care a răspuns: cheia absentă înseamnă „nu atinge", `null`
 * înseamnă „retrag răspunsul".
 */
export function saveVisitReport(params: {
  jobId: string;
  accessWorked?: boolean | null;
  timeEnough?: boolean | null;
  conditionWorseThanUsual?: boolean | null;
}) {
  const { jobId, ...body } = params;
  return apiPut<{
    success: boolean;
    report: {
      accessWorked: boolean | null; timeEnough: boolean | null;
      conditionWorseThanUsual: boolean | null; updatedAt: string;
    };
    auditWarning?: string;
  }>(`/cleaner-jobs/${jobId}/visit-report`, body);
}

/**
 * §16 „Customer-visible completion summary" (Sesiunea 143) — câte lucruri s-au bifat la o vizită
 * încheiată, pentru CLIENT.
 *
 * ⛔ **Doar cifre.** Serverul nu trimite etichetele punctelor, iar ecranul nu are de unde să le
 * inventeze — decizia și motivul sunt în `backend/src/routes/customerPortalChecklist.ts`.
 *
 * ⚠️ Stă aici, lângă notele vizitei, fiindcă `endpoints.ts` e la plafonul lui de mărime și nu are
 * voie să crească (`AGENT_RULES` §7): amândouă răspund la „ce s-a întâmplat la vizita asta".
 */
export function getMyJobChecklistSummary(params: { jobId: string }) {
  return apiGet<{ available: boolean; done: number; skipped: number; total: number }>(
    `/customer-portal/jobs/${params.jobId}/checklist-summary`, {},
  );
}

