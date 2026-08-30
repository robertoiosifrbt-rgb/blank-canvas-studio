/**
 * ACHU-401, felia a șaisprezecea — CURĂȚĂTORII: apelurile, plus forma rândului.
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `endpoints.ts`** (`AGENT_RULES` §7) — acela nu are
 * voie să crească, iar tipul de mai jos îl urcase cu cincisprezece rânduri.
 */
import { apiGet, apiPost } from './apiClient';

/**
 * Un curățător, întreg.
 *
 * ⚠️ ACHU-401 (felia 16) — ruta face `prisma.cleaner.findMany()` **fără `select`**, deci trimite
 * rândul întreg. ⛔ De obicei asta e chiar cazul pe care îl las pe `any` (vezi antetul) — aici
 * **nu**, fiindcă modelul are exact **zece** coloane scalare, toate de mai jos, verificate în
 * `schema.prisma`. Diferența nu e comoditatea, e dacă forma se poate citi cap-coadă sau nu.
 */
export type CleanerRecord = {
  id: string;
  /** Numărul vizibil, nu cuid-ul. */
  cleanerId: number;
  cleanerName: string;
  phone: string | null;
  email: string | null;
  /** ⚠️ Un curățător INACTIV nu dispare: rămâne pe vizitele lui vechi și poate fi încă preferat. */
  active: boolean;
  notes: string | null;
  /**
   * 🆕 §26 „Profit by team" B (Sesiunea 154) — echipa lui. Hotărârea lui Roberto: **una singură**.
   * ⚠️ `null` = fără echipă, și e o stare normală, nu o lipsă de date.
   */
  teamId: string | null;
  /**
   * 🆕 §13 „Standard working days" + „Standard working hours" (Sesiunea 158) — programul obișnuit.
   *
   * ⚠️ Zilele ca numere ISO în text (`"1,2,3"`, 1 = luni), orele ca `"HH:MM"`. ⛔ `null` înseamnă
   * **„nimeni nu a scris"**, niciodată „nu lucrează" — toate fișele de azi sunt așa.
   */
  standardWorkingDays: string | null;
  standardStartTime: string | null;
  standardFinishTime: string | null;
};

/**
 * 🆕 §26 „Profit by team" B (Sesiunea 154) — o echipă fixă.
 *
 * ⛔ Echipa nu se **șterge** din ecran, se dezactivează: una ștearsă ar goli tăcut rapoartele vechi
 * care se citesc pe ea. ⚠️ `cleanerCount` nu e decorativ — o echipă goală arată altfel identic cu una
 * desființată, iar raportul pe echipe nu va avea niciun rând pentru ea.
 */
export type TeamRecord = {
  id: string;
  teamId: number;
  name: string;
  active: boolean;
  notes: string | null;
  cleanerCount: number;
};

/** ⚠️ Implicit doar echipele active; `includeInactive` le aduce pe toate, pentru ecranul de echipe. */
export function getTeams(params: { includeInactive?: string } = {}) {
  return apiGet<{ records: TeamRecord[] }>('/teams', params);
}

export function saveTeam(data: { id?: string; name: string; active?: boolean; notes?: string }) {
  return apiPost<{ success: true; id: string; auditWarning?: string }>('/teams/save', data);
}

export function getCleaners(params: { search?: string }) {
  return apiGet<{ records: CleanerRecord[] }>('/cleaners', params);
}

/**
 * ⚠️ ACHU-401 (felia 19) — ruta întoarce **același** răspuns la creare și la editare
 * (`backend/src/routes/cleaners.ts`), deci un singur tip acoperă amândouă.
 *
 * `auditWarning` e prezent doar când scrierea în istoric a eșuat, iar salvarea **a rămas
 * făcută** — auditul e best-effort aici, spre deosebire de conturile de acces, unde e critic.
 * ⛔ Un ecran care îl ignoră spune că totul e în regulă când istoricul lipsește.
 */
export function saveCleaner(data: Record<string, unknown>) {
  return apiPost<{ success: true; id: string; auditWarning?: string }>('/cleaners/save', data);
}

/**
 * §15 (Sesiunea 158) — răspunsul curățătorului la o vizită: vine, sau nu poate.
 *
 * ⚠️ **Cine** răspunde vine din sesiune, nu din corp — ca la „am plecat spre client". ⛔ Motivul se
 * trimite doar la refuz, iar acolo serverul îl **cere**: regula e a lui, ecranul doar nu o încalcă.
 */
export function respondToVisit(jobId: string, response: 'Accepted' | 'Declined', reason?: string) {
  return apiPost<{ success: true; response: string; respondedAt: string; declineReason: string | null }>(
    `/cleaner-jobs/${jobId}/respond`, { response, ...(reason ? { reason } : {}) },
  );
}

