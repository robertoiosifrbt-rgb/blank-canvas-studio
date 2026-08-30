/**
 * ACHU-401, felia a douăzeci și una — ȘTERGEREA DATELOR UNUI CLIENT, și exportul lui.
 *
 * ⛔ **Fișier propriu, reexportat din `endpoints.ts`** (`AGENT_RULES` §7), deci niciun apelant
 * nu se schimbă.
 *
 * 🔴 **De ce merită scris cap-coadă tocmai aici, mai mult decât oriunde:** ecranul de ștergere
 * e **singura acțiune ireversibilă** din aplicație. Ce nu ajunge pe el înainte de a se tasta
 * cuvântul de confirmare **nu se mai poate afla după**. Iar răspunsul serverului nu e un rând
 * Prisma împrăștiat: e o evaluare compusă explicit (`backend/src/lib/customerAnonymisationAssessment.ts`),
 * din liste care stau într-un singur loc (`gdprAnonymisePolicy.ts`) — deci se citește cap-coadă.
 *
 * ⚠️ **Tiparul care a produs ACHU-537, ACHU-550 și acum ACHU-749 e ACELAȘI:** serverul calculează
 * și trimite ceva despre ce se pierde, iar ecranul nu-l arată. Un tip publicat nu-l repară singur,
 * dar face lipsa **vizibilă** — un câmp care există în răspuns și nu apare în niciun ecran se vede.
 */
import { apiGet, apiPost } from './apiClient';

/**
 * Un câmp golit, cu motivul pe care l-ar cere un om care verifică.
 *
 * ⚠️ `replaceWith` există fiindcă o coloană `NOT NULL` nu poate fi golită — primește un
 * înlocuitor. ⛔ Înlocuitorul stă în POLITICĂ, nu în rută: au fost cândva două liste, și cea a
 * rutei era cea care rula.
 */
export type GdprClearedField = {
  /** Modelul Prisma. */
  model: string;
  field: string;
  /** Citit de oameni, nu de cod. */
  reason: string;
  replaceWith?: string;
};

/** Un câmp păstrat, sau unul lăsat pentru citirea unui om. ⚠️ Fără `replaceWith`: nu se atinge. */
export type GdprPolicyField = { model: string; field: string; reason: string };

/**
 * 🔴 Un RÂND întreg care dispare, nu un câmp golit — casele clientului, preferințele lui de
 * curățător, pozele lui (cu fișier cu tot).
 *
 * ⛔ **Listă separată de `willClear` fiindcă deosebirea contează pentru cine citește ecranul:**
 * un câmp golit lasă rândul acolo, aici nu mai rămâne nimic de golit. Vezi ACHU-749.
 */
export type GdprDeletedRows = { model: string; what: string; reason: string };

/** Un motiv de REFUZ. ⚠️ Ștergerea nu rulează pe un client încă servit. */
export type GdprBlocker = { code: string; message: string };

/**
 * Ce AR FACE ștergerea, fără să o facă.
 *
 * ⛔ Apel separat de acțiune, deliberat: un dialog de confirmare care e prima oară când cineva
 * vede detaliul nu e o măsură de siguranță.
 */
export type AnonymisePreview = {
  customer: {
    id: string;
    customerId: number;
    customerName: string;
    /** `null` = datele NU au fost deja șterse. Altfel, ștergerea e refuzată ca deja făcută. */
    anonymisedAt: string | null;
    anonymisedBy: string | null;
  };
  canProceed: boolean;
  blockers: GdprBlocker[];
  /** ⚠️ Avertizează, **nu** blochează — decizia rămâne a omului. */
  warnings: string[];
  /** Câte rânduri s-ar atinge, ca scara să se vadă înainte, nu după. */
  scope: {
    jobs: number;
    quoteRequests: number;
    customerRequests: number;
    loginAccounts: number;
    /** ⛔ Șterse definitiv, cu fișierul din Storage cu tot. */
    propertyPhotos: number;
    /** ⚠️ Doar COMENTARIUL se șterge; scorul (1–5) rămâne. */
    ratingComments: number;
    /** 🔴 ACHU-749 — case ȘTERSE cu totul: adresa, codul de la poartă, câte camere are casa. */
    properties: number;
    /** 🔴 ACHU-749 — preferințele și excluderile de curățător, rândul întreg, cu motivul scris. */
    cleanerPreferences: number;
    /**
     * 🔴 22/08/2026 (ACHU-761 / 774) — numărate ÎNAINTE, ca biroul să nu afle după ce a apăsat.
     * ⚠️ Opționale în tip: o producție care încă rulează versiunea de ieri nu le trimite.
     */
    internalNotes?: number;
    qualityCheckFindings?: number;
    incidents?: number;
    /** 🔴 §20 (Sesiunea 152) — discuțiile consemnate: rândul întreg dispare, ca sarcinile. */
    communications?: number;
  };
  /** Păstrate din obligație legală, niciodată atinse. */
  retainedCounts: { payments: number; invoices: number };
  willClear: GdprClearedField[];
  willDelete: GdprDeletedRows[];
  willRetain: GdprPolicyField[];
  needsManualReview: GdprPolicyField[];
  /** ⛔ Vine de la SERVER: ecranul nu are voie să aibă cuvântul lui, scris în cod. */
  confirmationPhrase: string;
};

/** Textul liber pe care un om trebuie să-l citească DUPĂ. ⚠️ Numerele sunt cele vizibile, nu cuid-uri. */
export type AnonymiseManualReview = {
  why: string;
  payments: { paymentId: number; notes?: string | null; correctionNotes?: string | null }[];
  recurringContracts: { recurringSeriesId: number; notes?: string | null }[];
  subscriptions: { subscriptionId: number; notes?: string | null; cancellationReason?: string | null }[];
  /**
   * 🔴 22/08/2026 (hotărârea lui Roberto la ACHU-774 / 761 / 764) — ce a scris FIRMA și rămâne,
   * fiindcă poate numi o terță persoană: dosarul unui incident, ce s-a făcut cu un angajat, și
   * pozele care nu se șterg singure.
   */
  incidents?: {
    incidentId: number;
    witnesses?: string | null; investigation?: string | null; immediateAction?: string | null;
    correctiveAction?: string | null; preventiveAction?: string | null; costNote?: string | null;
  }[];
  qualityChecks?: { jobQualityCheckId: number; correctiveAction?: string | null }[];
  incidentPhotos?: { incidentId: number; photos: number }[];
  /** ⚠️ A doua propoziție: motivul rândurilor de mai sus nu e „explică bani". Vine de la SERVER. */
  whyRecords?: string;
};

export type AnonymiseResult = {
  success: true;
  /** Propoziția compusă pe server din numerele de mai jos — ca ecranul să nu scrie a doua. */
  summary: string;
  rowsTouched: Record<string, number>;
  retained: { payments: number; invoices: number };
  manualReview: AnonymiseManualReview;
};

/**
 * Ce ar face ștergerea acestui client. **Nu schimbă nimic.**
 */
export function previewCustomerAnonymisation(params: { customerId: string }) {
  return apiGet<AnonymisePreview>(`/gdpr/customer/${params.customerId}/anonymise-preview`);
}

/** Ireversibil. Golește datele personale, păstrează înregistrarea financiară. */
export function anonymiseCustomer(params: { customerId: string; confirmation: string; reason: string }) {
  return apiPost<AnonymiseResult>(`/gdpr/customer/${params.customerId}/anonymise`, {
    confirmation: params.confirmation,
    reason: params.reason,
  });
}

/**
 * Tot ce ține firma despre acest client, ca fișier.
 *
 * ⛔ **`unknown`, nu o formă scrisă — și e deliberat, la fel ca la `getMyData`.** Conținutul e
 * strâns din vreo zece modele (`collectCustomerExport`) și **se lungește** de fiecare dată când
 * apare un model nou; ecranul nu citește niciun câmp din el, doar îl scrie într-un fișier. Un tip
 * scris aici ar rămâne în urmă tăcut, iar un export incomplet dat cuiva care își exercită dreptul
 * de acces e o problemă de conformitate.
 */
export function exportCustomerData(params: { customerId: string }) {
  return apiGet<{ export: CustomerDataExport }>(`/gdpr/customer/${params.customerId}/export`);
}

/**
 * Fișierul în sine: **opac, cu o singură excepție**.
 *
 * ⚠️ Excepția e chiar ce nu are voie să se piardă: ACHU-222 ține notele interne **în afara**
 * exportului și le listează separat, iar ecranul trebuie să numere câte au rămas de citit — un
 * simplu „descărcat" ar lăsa singurul caz care cere o decizie umană să treacă neobservat.
 * ⛔ Restul rămâne `unknown`: se lungește la fiecare model nou, iar un tip scris aici ar rămâne
 * în urmă tăcut.
 */
export type CustomerDataExport = {
  internalReviewRequired?: {
    explanation: string;
    /** Vizitele cu note interne, ținute deoparte până le citește un om. */
    jobsWithAdminNotes?: unknown[];
  };
  [section: string]: unknown;
};

