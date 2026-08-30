/**
 * ACHU-401, felia a treisprezecea — CERERILE CLIENTULUI: ce cere el din portal, și ce vede
 * biroul în listă.
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `endpoints.ts`** (`AGENT_RULES` §7).
 *
 * 🔴 **Cele patru liste de clasificare a reclamațiilor sunt scrise pe SERVER**
 * (`backend/src/lib/complaintPolicy.ts`) și vin **odată cu lista**, nu pe o rută separată — o a
 * doua chemare eșuată tăcut ar lăsa dialogul cu selectoare goale, iar biroul ar crede că nu are
 * ce alege. Tipurile de aici oglindesc acel fișier; ⛔ nu se lărgesc la `string`, exact ca la
 * `kind` de mai jos.
 */
import { apiGet, apiPost, apiDelete } from './apiClient';

/**
 * ⚠️ Sursa de adevăr e `backend/src/lib/customerRequestPolicy.ts` (`CUSTOMER_REQUEST_KINDS`).
 * `AccountClosure` a fost adăugat în Sesiunea 118 și `ServiceExtra` în Sesiunea 122 (ACHU-556) —
 * **de fiecare dată prins de `tsc` și de nimic altceva**, fiindcă lista e scrisă în trei locuri
 * și singurul lucru care le ține împreună e că a treia e strict tipizată. ⛔ Nu o lărgi la
 * `string`: un fel nou ar ajunge în producție arătând construit și refuzat de server.
 */
export type CustomerRequestKind =
  | 'Reschedule' | 'Cancellation' | 'Problem' | 'PauseSeries' | 'CancelSeries'
  | 'ProfileCorrection' | 'AccountClosure' | 'Reclean' | 'RefundRequest' | 'ServiceExtra';

export type ComplaintCategory =
  | 'quality' | 'missed' | 'lateness' | 'damage' | 'conduct' | 'billing' | 'communication' | 'other';
export type ComplaintSeverity = 'low' | 'medium' | 'high';
export type ComplaintCause =
  | 'rushed' | 'training' | 'equipment' | 'scheduling' | 'communication' | 'expectation'
  | 'third-party' | 'unknown';
export type ComplaintOutcome = 'reclean' | 'refund' | 'discount' | 'apology' | 'no-fault' | 'other';

/** ACHU-563 — unde stă o reclamație față de promisiunea de 2 zile lucrătoare. */
export type ComplaintResponseState = {
  status: 'answered-on-time' | 'answered-late' | 'overdue' | 'due-today' | 'on-time';
  /** `YYYY-MM-DD`, ultima zi în care răspunsul e la timp. */
  dueOn: string;
  /** Cu câte zile calendaristice s-a depășit termenul. `0` dacă nu s-a depășit. */
  daysLate: number;
  /** Propoziția pentru birou. ⚠️ De la SERVER, ca ecranele să nu scrie fiecare alta. */
  label: string;
};

/**
 * ACHU-560 — detaliul de reclamație. ⚠️ `null` pe rândul care **nu** e o reclamație, nu câmp
 * absent: ecranul deosebește „nu e o reclamație" de „e una neclasificată", iar a doua stare e
 * chiar cea pe care trebuie să o semnaleze.
 */
export type ComplaintDetail = {
  complaintCategory: ComplaintCategory | null;
  complaintSeverity: ComplaintSeverity | null;
  complaintCause: ComplaintCause | null;
  complaintOutcome: ComplaintOutcome | null;
  /** Ce lipsește ca registrul să fie complet — calculat pe server (`missingDetail`). */
  missing: string[];
  /** Vechimea în zile — un FAPT, lângă termen, fiindcă răspund la întrebări diferite. */
  ageDays: number;
  response: ComplaintResponseState;
};

/** Un rând din lista biroului. Compus câmp cu câmp în `backend/src/routes/customerRequests.ts:73`. */
export type CustomerRequestRow = {
  id: string;
  customerRequestId: number;
  kind: CustomerRequestKind;
  status: 'Open' | 'Resolved' | 'Declined';
  message: string;
  /** `YYYY-MM-DD`. `null` când clientul nu a cerut o dată anume. */
  preferredDate: string | null;
  preferredTime: string | null;
  adminResponse: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  jobId: string | null;
  /** Propoziția gata compusă pe server. `null` când cererea nu e legată de o vizită. */
  jobLabel: string | null;
  jobStatus: string | null;
  recurringSeriesId: string | null;
  /** ⚠️ Aceeași frază pe care o vede și clientul în portal — biroul nu citește alt program. */
  seriesLabel: string | null;
  seriesStatus: string | null;
  complaint: ComplaintDetail | null;
};

type Options = { value: string; label: string }[];

export type CustomerRequestsResponse = {
  records: CustomerRequestRow[];
  openCount: number;
  /**
   * 🔴 ACHU-693 — propoziția care spune că lista e TĂIATĂ, compusă pe server (`lib/listCap.ts`).
   * `null` când nu s-a tăiat nimic. ⛔ Nu se compune pe ecran: două ecrane care și-o scriu separat
   * încep să difere, iar unul o uită de tot.
   */
  listNote?: string | null;
  /** Listele de ales, ca niciun ecran să nu le rescrie. */
  complaintOptions?: { categories: Options; severities: Options; causes: Options; outcomes: Options };
  /**
   * „Ce ne strică cel mai des". ⚠️ Numărat pe reclamațiile ÎNCĂRCATE, deci se schimbă odată cu
   * filtrul — **și e corect aici**: e o defalcare a listei pe care biroul o are în față, iar
   * ecranul scrie „din cele N de mai jos".
   */
  complaintBreakdown?: {
    total: number; open: number; closedWithoutCause: number; oldestOpenDays: number | null;
    /** ACHU-563 — față de promisiunea de 2 zile lucrătoare făcută clientului. */
    overdueOpen: number; answeredLate: number;
    byCategory: { value: string; label: string; count: number }[];
    byCause: { value: string; label: string; count: number }[];
    bySeverity: { value: string; label: string; count: number }[];
  };
};

/** Admin side: list customer requests. */
export function getCustomerRequests(params: { status?: string; kind?: string } = {}) {
  return apiGet<CustomerRequestsResponse>('/customer-requests', params);
}

/**
 * Admin side: answer one, with a reply the customer will read.
 *
 * ⚠️ ACHU-560 — cele patru câmpuri de reclamație sunt OPȚIONALE și se trimit doar pe un
 * `Problem`. Serverul le ignoră pe celelalte feluri, deliberat: patru coloane scrise pe o
 * cerere de reprogramare ar arăta ca o informație și nu ar fi.
 */
export function answerCustomerRequest(params: {
  id: string; status: 'Resolved' | 'Declined'; adminResponse: string;
  complaintCategory?: string | null; complaintSeverity?: string | null;
  complaintCause?: string | null; complaintOutcome?: string | null;
}) {
  const { id, ...body } = params;
  /**
   * 🔴 ACHU-629 — `notifyWarning` e prezent când clientul **nu a fost anunțat**: n-are cont de
   * portal, sau vestea nu a ajuns la toți. ⛔ Nu e o eroare — răspunsul e salvat — dar biroul
   * trebuie să afle, ca să dea vestea altfel.
   */
  return apiPost<{
    success: true; status: 'Resolved' | 'Declined'; auditWarning?: string; notifyWarning?: string;
  }>(
    `/customer-requests/${id}/answer`, body,
  );
}

/** Customer side: raise a reschedule/cancellation/problem request. */
export function submitCustomerRequest(data: {
  kind: CustomerRequestKind;
  jobId?: string; recurringSeriesId?: string; message: string; preferredDate?: string; preferredTime?: string;
}) {
  return apiPost<{
    success: true;
    /** Numărul vizibil al cererii, ca omul să îl poată cita la telefon. */
    customerRequestId: number;
    status: 'Open';
    auditWarning?: string;
  }>('/customer-portal/requests', data);
}

/**
 * Customer side: accept or reject a Final quote.
 *
 * ⚠️ `RevisionRequested` a fost adăugat în Sesiunea 118 — sursa de adevăr e
 * `QUOTE_CUSTOMER_RESPONSES` din `backend/src/lib/customerRequestPolicy.ts`. Tipul strict de
 * aici a fost singurul care a prins că lipsea a treia valoare; lintul și ambele suite nu se uită.
 */
/** ⚠️ `acceptedExtras` are înțeles NUMAI la `Accepted` — serverul îl ignoră la celelalte două. */
export function respondToQuote(params: { id: string; response: 'Accepted' | 'Rejected' | 'RevisionRequested'; note?: string; acceptedExtras?: string[] }) {
  const { id, ...body } = params;
  return apiPost<{
    success: true;
    customerResponse: 'Accepted' | 'Rejected' | 'RevisionRequested';
    auditWarning?: string;
  }>(`/customer-portal/quotes/${id}/respond`, body);
}

/**
 * §6 „Viewed" (Sesiunea 160) — portalul spune ce oferte tocmai a arătat omului.
 *
 * ⚠️ **Trimite ce a DESENAT ecranul**, nu tot ce are clientul: serverul reține prima deschidere a
 * fiecăreia, iar biroul poate deosebi „a văzut-o și se gândește" de „nu i-a ajuns sub ochi".
 * ⛔ Serverul filtrează oricum după clientul din sesiune și după `Final` — lista de aici e o
 * afirmație despre ecran, nu o autorizație.
 */
export function markQuotesViewed(ids: string[]) {
  return apiPost<{ marked: number }>('/customer-portal/quotes/viewed', { ids });
}

/**
 * ─── §32 „Complaint evidence" (Sesiunea 148) — POZELE UNEI RECLAMAȚII ─────────────────
 *
 * ⚠️ **Adresate prin NUMĂRUL cererii** (`ref`) pe partea clientului și prin `id` pe partea
 * biroului — nu din neglijență: portalul primește cererile cu numărul lor, ecranul de birou cu
 * cuid-ul. Motivul întreg e în `backend/src/routes/customerPortalComplaintPhotos.ts`.
 */
export type ComplaintPhoto = {
  id: string;
  /** Numărul cererii de care atârnă, ca ecranul să le grupeze fără o a doua chemare. */
  requestRef: number;
  description: string | null;
  uploadedAt: string;
  /** `null` = depozitul n-a răspuns la semnare. Ecranul spune că nu se poate deschide acum. */
  signedUrl: string | null;
};

/**
 * Client: pozele de pe TOATE reclamațiile lui, într-o singură chemare.
 *
 * ⚠️ `uploadsAvailable` și `maxPhotos` vin de la server, nu din bundle: prima spune dacă depozitul
 * primește fișiere (ACHU-517), a doua e plafonul impus oricum de rută. ⛔ Aceeași cifră ținută și
 * aici ar fi două surse de adevăr pentru aceeași regulă.
 */
export function getMyComplaintPhotos() {
  return apiGet<{ photos: ComplaintPhoto[]; maxPhotos: number; uploadsAvailable: boolean }>(
    '/customer-portal/requests/photos', {},
  );
}

/** Client: trimite o poză cu reclamația. ⚠️ `imageData` e deja micșorat de `imageCompression`. */
export function uploadComplaintPhoto(params: { ref: number; imageData: string; description?: string }) {
  const { ref, ...body } = params;
  return apiPost<{ success: true; photo: { id: string } }>(
    `/customer-portal/requests/${ref}/photos`, body,
  );
}

/** Client: retrage o poză trimisă din greșeală. ⚠️ Se poate și după ce biroul a răspuns. */
export function deleteComplaintPhoto(params: { ref: number; photoId: string }) {
  return apiDelete<{ success: true }>(`/customer-portal/requests/${params.ref}/photos/${params.photoId}`);
}

/** Birou: ce dovadă a trimis clientul cu reclamația asta. ⛔ Doar citire — încarcă doar clientul. */
export function getCustomerRequestPhotos(params: { id: string }) {
  return apiGet<{ records: ComplaintPhoto[] }>(`/customer-requests/${params.id}/photos`, {});
}

