/**
 * ENDPOINTURILE INCIDENTELOR (ACHU-569) + DOVADA LOR (§32, Sesiunea 147).
 *
 * ⛔ **MUTATE AICI din `endpoints.ts` în Sesiunea 147, fiindcă a spart clichetul de mărime:**
 * cele trei funcții de poze l-au dus la 318 rânduri de cod față de un plafon de 300. Regula
 * (`AGENT_RULES` §7.4) spune să extragi responsabilitatea atinsă, nu să ridici cifra.
 *
 * ⚠️ Același tipar ca `endpointsBackup.ts`, care a plecat din același fișier pentru același motiv.
 * `endpoints.ts` face `export * from './endpointsIncidents'`, deci **niciun ecran nu se schimbă**:
 * importurile din `@/lib/endpoints` merg mai departe.
 *
 * ⚠️ Tipuri ÎNGUSTE, citite din `backend/src/routes/incidents.ts` și `incidentPhotos.ts` — nu
 * `any` (`CLAUDE.md` 2.1a).
 */
import { apiGet, apiPost, apiDelete } from './apiClient';

// ─── Incidente (ACHU-569) ────────────────────────────────────────────
//
// Tipuri INGUSTE, citite din `backend/src/routes/incidents.ts` — nu `any`, desi restul
// fisierului e (CLAUDE.md 2.1a: fiecare ecran primeste un tip ingust, citit din ruta).

export type IncidentOption = { value: string; label: string; reportable?: boolean; legalNote?: string | null };

export type IncidentRecord = {
  id: string; incidentId: number;
  kind: string; kindLabel: string;
  severity: string; severityLabel: string;
  status: string; occurredOn: string; description: string;
  outcome: string | null; customerConduct: string | null;
  reportedExternally: boolean; reportedExternallyNote: string | null;
  legalNote: string | null; reportable: boolean;
  customerName: string | null; cleanerName: string | null; jobLabel: string | null;
  createdAt: string; closedAt: string | null; closedBy: string | null;
  /**
   * §29 (Sesiunea 150) — dosarul: ce s-a făcut pe loc, cine a văzut, ce s-a aflat, ce s-a schimbat,
   * cine îl duce, cât a costat. ⚠️ Tot opțional; nimic din ele nu se cere ca să se poată închide.
   */
  immediateAction: string | null;
  witnesses: string | null;
  investigation: string | null;
  correctiveAction: string | null;
  preventiveAction: string | null;
  owner: string | null;
  costAmount: number | null;
  costNote: string | null;
};

/** Ce se trimite la salvarea dosarului. ⚠️ Doar ce s-a schimbat — vezi `saveIncidentDossier`. */
export type IncidentDossierPatch = {
  immediateAction?: string | null;
  witnesses?: string | null;
  investigation?: string | null;
  correctiveAction?: string | null;
  preventiveAction?: string | null;
  owner?: string | null;
  costAmount?: number | null;
  costNote?: string | null;
};

export type IncidentsResponse = {
  records: IncidentRecord[];
  openCount: number;
  options: { kinds: IncidentOption[]; severities: IncidentOption[] };
  breakdown: {
    total: number; open: number; openReportable: number;
    closedReportableWithoutRecord: number;
    /** §29 — câte dosare grave s-au închis fără să scrie nimeni ce s-a aflat sau ce s-a schimbat. */
    closedSeriousWithoutFollowUp: number;
    byKind: { value: string; label: string; count: number }[];
    bySeverity: { value: string; label: string; count: number }[];
  };
};

export function getIncidents(params: { status?: string; kind?: string } = {}) {
  return apiGet<IncidentsResponse>('/incidents', params);
}

export function createIncident(data: {
  kind: string; severity: string; occurredOn: string; description: string;
  /** §29 — ce s-a făcut pe loc. ⚠️ Cerut la deschidere fiindcă atunci se știe și repede se uită. */
  immediateAction?: string | null;
  jobId?: string | null; customerId?: string | null; cleanerId?: string | null;
}) {
  return apiPost<{ success: boolean; id: string; incidentId: number; legalNote: string | null; auditWarning?: string | null }>('/incidents', data);
}

/**
 * §29 (Sesiunea 150) — scrie în dosar.
 *
 * ⚠️ **Se trimite doar ce s-a schimbat**, nu tot obiectul: `undefined` înseamnă „nu atinge", `null`
 * înseamnă „șterge". ⛔ Altfel doi oameni care completează două câmpuri diferite s-ar șterge unul pe
 * altul, iar cel de-al doilea nici nu ar afla.
 */
export function saveIncidentDossier(id: string, data: IncidentDossierPatch) {
  return apiPost<{ success: boolean; changed: string[]; auditWarning?: string | null }>(`/incidents/${id}/dossier`, data);
}

export function closeIncident(id: string, data: {
  outcome: string; customerConduct?: string | null;
  reportedExternally?: boolean; reportedExternallyNote?: string | null;
}) {
  return apiPost<{ success: boolean; auditWarning?: string | null }>(`/incidents/${id}/close`, data);
}

// ─── §32 „Incident evidence" (Sesiunea 147) — dovada dosarului ────────────
//
// 🔴 Un incident se consemna cu felul lui si o descriere scrisa. Un obiect spart sau o pata pe o
// canapea erau AFIRMATII, nu dovezi — iar incidentele sunt exact locul unde cuvantul cuiva se
// confrunta cu cuvantul altcuiva.

export type IncidentPhoto = {
  id: string; storagePath: string; description: string | null;
  uploadedAt: string; uploadedBy: string | null;
  /** ⚠️ `null` = linkul semnat n-a putut fi facut. Ecranul o SPUNE, nu arata o imagine rupta. */
  signedUrl: string | null;
};

export type IncidentPhotosResponse = {
  records: IncidentPhoto[];
  /** ⚠️ Vine de la SERVER: plafonul e al lui, iar aceeasi cifra in doua locuri e forma §3.1b. */
  canAdd: boolean;
};

export function getIncidentPhotos(id: string) {
  return apiGet<IncidentPhotosResponse>(`/incidents/${id}/photos`);
}

export function addIncidentPhoto(id: string, data: { imageData: string; description?: string }) {
  return apiPost<{ success: boolean; record: IncidentPhoto }>(`/incidents/${id}/photos`, data);
}

export function deleteIncidentPhoto(id: string, photoId: string) {
  return apiDelete<{ success: boolean }>(`/incidents/${id}/photos/${photoId}`);
}

