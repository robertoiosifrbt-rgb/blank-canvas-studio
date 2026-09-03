/**
 * Înlocuitorul lui `zite-endpoints-sdk`: o funcție per rută, cu același nume și aceeași
 * semnătură ca SDK-ul pe care îl înlocuiește (`docs/Ghid_Conversie_Zite_Cod.md` §5) — s-a
 * schimbat doar implementarea, dintr-un apel de SDK într-un `fetch` către Express.
 *
 * 🔴 **`any` NU MAI E REGULA AICI, ȘI ANTETUL ĂSTA A SPUS CONTRARIUL PREA MULT TIMP.** SDK-ul
 * genera tipurile din inferența platformei; noi n-avem generator, iar o primă versiune scrisă de
 * mână a greșit mai multe răspunsuri (`getJobAssignments` întoarce `{ assignments }`, nu
 * `{ records }`; rutele `save*` adaugă `duplicateConflict`/`warning`/`message` pe ramuri
 * specifice de business). De acolo a venit `any` peste tot, și a rămas.
 *
 * ⚠️ **ACHU-401 a răsturnat proporția, felie cu felie:** ce se poate CITI din rută se scrie, iar
 * formele stau în module proprii, reexportate mai jos — deci niciun apelant nu se schimbă.
 * ⛔ **Testul, nu gustul:** o rută se scrie cap-coadă dacă **nu inventează nimic** — compune
 * explicit câmpurile, sau întoarce un model mic ale cărui coloane se pot citi toate. Ce
 * împrăștie un rând Prisma mare fără un ecran care să-i citească subsetul rămâne `any`,
 * deliberat: un tip ghicit peste ~40 de coloane e chiar greșeala care a produs ACHU-741.
 */
import { apiGet, apiPost, apiPatch, apiDelete } from './apiClient';
import type { AuditHistoryResponse } from './officeToolsEndpoints';
import type { LeaveListResponse, LeaveMutation } from './absenceTypes';
/** ACHU-401 (felia 11) — vezi `errorLogTypes.ts` pentru de ce doar tipurile stau separat aici. */
import type { ErrorLogResponse, ErrorReportAck } from './errorLogTypes';
/**
 * ACHU-545 — the ONE exception to the `any` rule above, and it is type-only.
 * The privacy notice is rendered straight out of the response (headings, paragraphs,
 * groups); with `any`, a renamed field on the server would show a customer an empty
 * section instead of failing to compile. Shape lives with the other portal shapes.
 */
import type { PortalCustomer } from '@/components/customer/portalTypes';
/** ACHU-401 (felia 14) — forma checklistului, ca aliasul de mai jos să nu mai fie `any`. */
import type { JobChecklistResponse } from './jobEndpoints';

export type GetDashboardOutputType = any;
export type GetActionCentreOutputType = any;
/**
 * ACHU-401 (felia 14) — nu mai e `any`: aliasul arată acum forma reală, iar cele două ecrane
 * care îl citesc (`WorkChecklist.tsx`, `AdminChecklistSection.tsx`) se verifică prin el fără
 * să-și schimbe niciun import.
 */
export type GetJobChecklistOutputType = JobChecklistResponse;
export type GetCleanerJobsOutputType = any;
export type GetCustomerPortalOutputType = any;
/** ACHU-401 (felia 23) — aliasul arată acum forma reală; ecranul care îl citește nu s-a atins. */
export type GetAuditHistoryOutputType = AuditHistoryResponse;

// ─── Cele patru înregistrări de bază ────────────────────────────────
// ⚠️ ACHU-401 (felia 22) — clienții, vizitele, plățile și cheltuielile (citire ȘI scriere) au
// ieșit în `adminRecordEndpoints.ts`, cu formele publicate la felia 19 și cu răspunsurile de la
// scriere scrise ca UNIUNI: un `success: false` nu are id. ⛔ Plafonul nu se ridică: se extrage.
export * from './adminRecordEndpoints';

// ─── Cleaners ───────────────────────────────────────────────────────
// ⚠️ ACHU-401 (felia 16) — mutate în `cleanerEndpoints.ts`. Modelul `Cleaner` are doar șapte
// coloane scalare, deci forma se poate citi cap-coadă — spre deosebire de vizite sau clienți.
export * from './cleanerEndpoints';

// ⚠️ §8 (Sesiunea 146) — catalogul de servicii NU e re-exportat de aici, deliberat: fișierul e la
// clichetul lui de mărime, iar un `export *` în plus l-ar fi împins peste. Ecranul importă direct
// din `serviceEndpoints.ts` — a douăzeci și una oară când o felie stă în afara catalogului.

// ─── Uneltele transversale ale biroului ─────────────────────────────
// ⚠️ ACHU-401 (felia 23) — căutarea globală, istoricul de audit, setările financiare și
// ștergerea unei înregistrări au ieșit în `officeToolsEndpoints.ts`. Sunt împreună fiindcă
// niciuna nu aparține unui singur ecran. ⛔ Plafonul nu se ridică: se extrage.
export * from './officeToolsEndpoints';

export function getAuditHistory(params: {
  entityType?: string; entityId?: string; action?: string; performedBy?: string;
  startDate?: string; endDate?: string; offset?: number; limit?: number;
}) {
  return apiGet<AuditHistoryResponse>('/audit-history', params);
}

// ─── Conturi, rol, invitații ────────────────────────────────────────
// ⚠️ ACHU-401 (felia 13) — mutate în `accountEndpoints.ts`, cu formele reale în locul lui
// `any`. Re-exportate ca să nu se schimbe niciun import existent.
export * from './accountEndpoints';

// ─── Customer Requests (ACHU-238) ───────────────────────────────────
// ⚠️ ACHU-401 (felia 13) — mutate în `customerRequestEndpoints.ts`, împreună cu cele patru
// liste de clasificare a reclamațiilor, oglindite după `backend/src/lib/complaintPolicy.ts`.
export * from './customerRequestEndpoints';

/** ACHU-528 — exportul de acces al clientului, pentru el însuși. ⛔ Fără niciun parametru,
 *  deliberat: serverul citește cine ești din sesiune, nu din URL (`customerPortal.ts`,
 *  `GET /my-data`). Un id acceptat aici ar fi fișierul complet al altei persoane. */
export function getMyData() {
  return apiGet<{ export: unknown }>('/customer-portal/my-data');
}

// ─── Cererile de ofertă și formularele publice ──────────────────────
// ⚠️ ACHU-401 (felia 23) — mutate în `enquiryEndpoints.ts`, cu răspunsurile de la scriere
// scrise cap-coadă. ⛔ RÂNDUL cererii rămâne `any`: ruta lui împrăștie ~40 de coloane.
export * from './enquiryEndpoints';

// ─── Vizite: asignări și checklist ──────────────────────────────────
// ⚠️ ACHU-401 (felia 14) — mutate în `jobEndpoints.ts`, cu formele reale. ⛔ `getJobs`/`saveJob`/
// `getJob` NU au plecat: rutele lor împrăștie rândul Prisma întreg și rămân `any`, deliberat.
export * from './jobEndpoints';
// ⚠️ §43 (Sesiunea 144) — `taskEndpoints.ts` NU se re-exportă de aici, deliberat: fișierul ăsta e
// pe clichetul de mărime, iar un rând în plus l-ar fi trecut peste. Ecranele importă direct din
// `@/lib/taskEndpoints`, ca `PriceCalculatorPage` din `billingEndpoints`.

// ─── Dashboard / Action Centre / Search ─────────────────────────────

export function getDashboard(params: { period?: string; startDate?: string; endDate?: string }) {
  return apiGet<GetDashboardOutputType>('/dashboard', params);
}

export function getActionCentre(_params: Record<string, never> = {}) {
  return apiGet<GetActionCentreOutputType>('/action-centre');
}

// ─── Customer Portal ────────────────────────────────────────────────

export function getCustomerPortal(params: { jobHistoryOffset?: number; paymentOffset?: number }) {
  return apiGet<GetCustomerPortalOutputType>('/customer-portal', params);
}

// ⚠️ Consimțămintele, nota de confidențialitate și Service Agreement-ul stau în
// `legalEndpoints.ts` — scoase la ACHU-683/725, fiindcă sunt apelurile cu greutate juridică.
export {
  getCustomerConsents, saveCustomerConsents, getPrivacyNotice, getCustomerDocuments, signCustomerDocument,
} from './legalEndpoints';


// Sesiunea 148 — nota și pozele unei vizite au plecat în fișierul lor; vezi antetul de acolo.
export * from './visitPhotoEndpoints';


/**
 * ACHU-513 — "Confirm access". `confirmed: false` withdraws a confirmation, which is a real
 * case rather than an undo button: plans change, and the office needs to hear about that
 * more urgently than about the confirmation itself.
 */
export function confirmJobAccess(params: { jobId: string; confirmed: boolean }) {
  return apiPatch<{ accessConfirmedAt: string | null; accessConfirmedBy: string | null; auditWarning?: string }>(
    `/customer-portal/jobs/${params.jobId}/access-confirmation`,
    { confirmed: params.confirmed },
  );
}

/**
 * ACHU-541 — firul de interacțiuni cu un client: tot ce s-a întâmplat, într-un singur loc.
 *
 * ⚠️ `truncated` nu e decor: fiecare fel de eveniment e plafonat separat, iar un fir tăiat
 * tăcut arată exact ca unul complet — cine îl citește ar trage o concluzie despre un client
 * pe baza unei jumătăți de istoric.
 */
export function getCustomerTimeline(params: { customerId: string }) {
  return apiGet<{
    customerName: string;
    items: {
      at: string;
      /**
       * ⚠️ **Uniunea trebuie să fie a serverului**, nu un colț din ea (`backend/src/lib/customerTimeline.ts`
       * — `TimelineSource`). 🔴 Găsit la Sesiunea 158: `communication` exista pe server din Sesiunea 152
       * și **lipsea de aici**, deci ecranul nu putea nici măcar să-i dea o iconiță — cădea pe cea
       * implicită, iar un telefon se desena cu semnul de „istoric". ⛔ Un tip mai îngust decât
       * răspunsul nu dă o eroare: **taie tăcut** ce nu cunoaște.
       */
      source: 'request' | 'rating' | 'document' | 'consent' | 'visit' | 'money' | 'record' | 'communication' | 'quote';
      title: string;
      detail?: string | null;
      by?: string | null;
    }[];
    truncated: boolean;
    perSourceLimit: number;
  }>(`/customers/${params.customerId}/timeline`, {});
}

/**
 * ACHU-570/574/576 — casele unui client (`Backlog_Functionalitati_Viitoare` §5).
 *
 * ⚠️ **Nici tipurile, nici funcțiile nu mai stau aici.** Cele 11 câmpuri ale Grupului A au împins
 * fișierul acesta peste clichetul lui de mărime (ACHU-571) și tipurile s-au mutat în
 * `propertyTypes.ts`; Grupul B ar fi făcut-o din nou, deci s-au mutat și **funcțiile**, în
 * `propertyEndpoints.ts`. ⛔ Plafonul nu se ridică — se extrage. Re-exportate, deci apelanții
 * existenți nu simt nimic.
 */
export type { PropertyRecord, PropertyInputBody, MyProperty, PropertyChecklistPoint } from './propertyTypes';
// ⚠️ `export *`, nu o listă de nume: o listă ar fi trebuit ținută la zi la fiecare rută nouă de
// proprietăți, iar cea uitată ar fi fost exact cea care „nu există" pentru apelanți (§3.1b).
export * from './propertyEndpoints';
/**
 * §36, Sesiunea 142 — notele unei vizite au plecat în `ratingEndpoints.ts`, pentru **exact**
 * același motiv: desfacerea pe curățător și pe serviciu a adăugat un tip și trei câmpuri, iar
 * fișierul acesta era la clichetul lui. ⛔ Plafonul nu se ridică (`AGENT_RULES` §7) — se extrage,
 * iar cifra nouă devine plafonul de acum înainte.
 */
export * from './ratingEndpoints';
export * from './subscriptionEndpoints';

/**
 * ACHU-556 — serviciile extra la o vizită.
 *
 * ⚠️ **Toate trei întorc ACEEAȘI formă**, nu doar un `success`: fiecare scriere mută
 * `Job.amountCharged`, deci ecranul trebuie să afle suma nouă fără să mai ceară o dată. Un
 * `{ success: true }` l-ar fi lăsat să afișeze vechea sumă până la o reîncărcare — adică
 * exact cifra pe care biroul o citește ca să decidă dacă mai adaugă ceva.
 */
export type JobServiceExtrasResponse = {
  extras: { id: string; description: string; price: number; createdAt: string; createdBy: string | null }[];
  extrasTotal: number;
  amountCharged: number;
  baseAmount: number;
  extrasExceedCharge: boolean;
  editable: boolean;
  /** Prezent doar când `editable` e fals — de ce nu se mai poate atinge lista. */
  reason?: string;
  maxExtras: number;
};

/**
 * ACHU-558 — cum vrea clientul sa fie contactat, scris de EL din portal.
 *
 * ⚠️ Intoarce si `expectation`, propozitia despre ce poate onora aplicatia — calculata pe
 * server (`contactPreferencePolicy.ts`), nu scrisa in componenta: cand firma adauga emailul,
 * se schimba intr-un singur loc.
 */
/**
 * ACHU-561 — pozele trimise odata cu cererea de oferta.
 *
 * ⛔ Rutele traiesc sub `/customer-portal`, si ACEEA e poarta: decizia Archanei a fost `5.b`,
 * doar clientilor cu cont. Identitatea vine din sesiune, niciodata din URL.
 */
export function getQuoteRequestPhotos(params: { quoteRequestId: string }) {
  return apiGet<{
    photos: { id: string; description: string | null; uploadedAt: string; signedUrl: string | null }[];
    canAdd: boolean;
    reason: string | null;
    maxPhotos: number;
  }>(`/customer-portal/quote-requests/${params.quoteRequestId}/photos`, {});
}

export function uploadQuoteRequestPhoto(params: { quoteRequestId: string; imageData: string; description?: string }) {
  const { quoteRequestId, ...body } = params;
  return apiPost<{ success: boolean; photo: { id: string } }>(`/customer-portal/quote-requests/${quoteRequestId}/photos`, body);
}

export function deleteQuoteRequestPhoto(params: { quoteRequestId: string; photoId: string }) {
  return apiDelete<{ success: boolean }>(`/customer-portal/quote-requests/${params.quoteRequestId}/photos/${params.photoId}`);
}

export function updateContactPreferences(params: {
  preferredContactMethod: string | null;
  preferredContactWindow: string | null;
  contactPreferenceNote: string | null;
}) {
  return apiPatch<{
    preferredContactMethod: string | null;
    preferredContactWindow: string | null;
    contactPreferenceNote: string | null;
    expectation: string;
  }>('/customer-portal/contact-preferences', params);
}

export function getJobServiceExtras(params: { jobId: string }) {
  return apiGet<JobServiceExtrasResponse>(`/job-service-extras/${params.jobId}`, {});
}

export function addJobServiceExtra(params: { jobId: string; description: string; price: number }) {
  const { jobId, ...body } = params;
  return apiPost<JobServiceExtrasResponse>(`/job-service-extras/${jobId}`, body);
}

export function removeJobServiceExtra(params: { jobId: string; extraId: string }) {
  return apiDelete<JobServiceExtrasResponse>(`/job-service-extras/${params.jobId}/${params.extraId}`);
}

/**
 * ACHU-540 — raportul de clienți. ⚠️ `summary` se calculează pe TOȚI clienții, nu pe cei
 * filtrați: „arată-mi plecații" nu are voie să schimbe câți clienți are firma.
 *
 * ⛔ `standing` e o MĂSURĂTOARE (din vizitele efectuate), iar `officeStatus` e ce a bifat
 * biroul. Ecranul le arată pe amândouă fiindcă pot să nu fie de acord — și dezacordul e chiar
 * informația.
 */
export function getCustomerReport(params: { standing?: 'new' | 'active' | 'lapsed' | 'never' } = {}) {
  return apiGet<{
    summary: {
      customers: number; withVisits: number; newCustomers: number; active: number;
      lapsed: number; never: number; repeat: number; onceOnly: number;
      /** `null` = nicio măsurătoare. ⛔ Nu-l afișa ca 0%: acela e o afirmație. */
      repeatRatePercent: number | null;
      averageVisits: number | null;
      totalNetPaidPence: number;
    };
    retention: { month: string; gained: number; lost: number; served: number }[];
    records: {
      customerId: string; customerName: string; officeStatus: string | null;
      visits: number; firstVisit: string | null; lastVisit: string | null;
      daysSinceLastVisit: number | null; netPaidPence: number;
      standing: 'new' | 'active' | 'lapsed' | 'never'; repeat: boolean;
    }[];
    thresholds: { lapsedAfterDays: number; newWithinDays: number };
  }>('/reports/customers', params);
}

/**
 * Admin side (Sesiunea 97): the office VIEW of what a customer has agreed to.
 * Read-only, deliberately — see `backend/src/routes/customers.ts` for why an
 * Admin cannot set a consent here.
 */
export function getCustomerConsentsAdmin(params: { customerId: string }) {
  return apiGet<{
    topics: {
      key: string; label: string; granted: boolean | null; answeredAt: string | null;
      source: string | null; wordingChanged: boolean;
    }[];
    history: { topic: string; label: string; granted: boolean; recordedAt: string; recordedBy: string | null; source: string | null }[];
  }>(`/customers/${params.customerId}/consents`, {});
}

/**
 * ⚠️ **ACHU-576: fără `accessInstructions`.** Instrucțiunile de acces s-au mutat pe CASĂ
 * (`updateMyPropertyAccess`) — un singur text pentru toate casele cuiva era greșit pentru cel
 * puțin una. Serverul nu le mai scrie de aici.
 */
/**
 * 🔴 ACHU-401 (felia 23) — `customer` de aici e un SUBSET al clientului din portal, nu clientul
 * întreg, iar asta e chiar defectul ACHU-752: ruta trimite șapte câmpuri, iar ecranul înlocuia
 * cu ele tot obiectul. Tipul spune acum exact ce vine, ca nimeni să nu mai poată face asta
 * fără ca `tsc` să se opună.
 */
export function updateCustomerProfile(data: {
  phone: string; address: string; postcode?: string;
}) {
  return apiPost<{
    success: true;
    customer: Pick<PortalCustomer, 'customerName' | 'email' | 'phone' | 'address' | 'postcode' | 'customerType' | 'status'>;
    auditWarning?: string;
  }>('/customer-profile', data);
}

// ─── Cleaner Jobs / Notes ───────────────────────────────────────────

export function getCleanerJobs(_params: Record<string, never> = {}) {
  return apiGet<GetCleanerJobsOutputType>('/cleaner-jobs');
}

/**
 * ACHU-565 — „am plecat spre client".
 *
 * ⚠️ Nu trimite nimic în corp: **cine** pleacă vine din sesiune, iar **când** e ora
 * serverului. O oră trimisă din telefon ar fi ceasul telefonului, care poate fi orice.
 */
export function cleanerOnTheWay(jobId: string) {
  return apiPost<{ success: boolean; onTheWayAt: string | null; alreadySent: boolean }>(`/cleaner-jobs/${jobId}/on-the-way`, {});
}

/** ⚠️ Nota nemodificată răspunde tot cu succes, dar FĂRĂ avertisment de audit — nu s-a scris nimic. */
export function saveCleanerNotes(data: { jobId: string; cleanerCompletionNotes: string; requestToken?: string }) {
  return apiPost<{ success: true; auditWarning?: string }>('/cleaner-notes', data);
}

// ─── Employee Self-Service (Sesiunea 80, ACHU-314) ──────────────────
// ⚠️ ACHU-401 (felia 33) — `getMyPayroll` a plecat în `selfServiceEndpoints.ts`, tipizată. ⛔ Nu
// se ridică plafonul: se extrage. `balance` e IMPORTAT din `absenceTypes`, nu rescris — e
// obiectul produs de `computeBalance`, același pentru birou și pentru curățător.
export * from './selfServiceEndpoints';
/**
 * ACHU-335 (Sesiunea 80n) — a cleaner's own payslips, for the portal.
 *
 * ⚠️ Separate from `getMyPayroll` on purpose. That call is the page's headline
 * and has to be fast; this one reads up to sixty run lines with their earnings
 * and deductions, and a slow payslip list must not hold up the holiday balance.
 */
// ⚠️ ACHU-401 (felia 27) — fluturașii și formele fiscale ale curățătorului au ieșit în
// `payrollDocumentEndpoints.ts`, tipizate. ⛔ P60 și P45 NU s-au rescris acolo: forma lor
// exista deja pe frontend, în `statutoryFormPdf.ts`, iar a doua copie e chiar greșeala care
// a produs ACHU-741.


// ─── Calculatorul de preț și Facturarea ─────────────────────────────
// ⚠️ ACHU-401 (felia 20) — mutate în `billingEndpoints.ts`, cu formele scrise cap-coadă:
// calculul vine dintr-o funcție PURĂ de pe server, iar cele trei modele sunt mici. ⛔ Plafonul
// nu se ridică: se extrage.
export * from './billingEndpoints';

// ─── Job Checklist ──────────────────────────────────────────────────
// ⚠️ **Tot ce ține de checklist e acum în `jobEndpoints.ts`**, citirea și scrierea. `getJobChecklist`
// plecase la felia 14; actualizarea a rămas aici până la §16 (Sesiunea 144), când câmpul nou a
// împins fișierul peste clichet — iar ieșirea corectă era lângă restul checklistului, nu un plafon
// mai mare (`AGENT_RULES` §7).


// ─── Extract Receipt ────────────────────────────────────────────────

/**
 * ⚠️ **Eșecul NU vine ca eroare, ci ca `success: false` cu 200** — deliberat: extragerea automată
 * e un ajutor, iar când nu reușește omul completează manual. ⛔ Un ecran care tratează asta ca
 * eroare l-ar bloca; `warnings` spune ce a mers prost fără să oprească nimic.
 */
export function extractReceipt(params: { fileUrl: string; isPdf?: boolean }) {
  return apiPost<{
    success: boolean;
    /** Ce s-a citit de pe hârtie. ⚠️ Câmpurile necitite vin **goale**, nu lipsă. */
    data: {
      supplier: string; expenseDate: string; documentType: string; documentNumber: string;
      /** Cât de sigur e numărul de document — el se transcrie greșit cel mai des. */
      documentNumberConfidence: string;
      subtotal: number; vatAmount: number; amount: number;
      currency: string; category: string; paymentMethod: string; description: string;
    };
    confidence: number;
    notes: string;
    warnings: string[];
    error?: string;
  }>('/extract-receipt', params);
}

/**
 * ⛔ **Chatul și notificările NU mai sunt aici** — ACHU-401, felia 11. Au plecat cu totul în
 * `chatEndpoints.ts` și `notificationEndpoints.ts`, cu formele răspunsurilor citite din rutele
 * lor. Fișierul ăsta e peste plafonul de mărime și nu are voie să crească (`AGENT_RULES` §7),
 * deci tipurile nu se adaugă aici: responsabilitatea pleacă întreagă.
 */

// ─── Jurnal de erori (Sesiunea 29) ──────────────────────────────────

export function reportClientError(params: {
  message: string; stack?: string | null; componentStack?: string | null;
  path?: string | null; boundary?: string | null;
}) {
  return apiPost<ErrorReportAck>('/error-log', params);
}

/**
 * ACHU-261 — the error log, finally readable.
 *
 * `message` drills into one distinct error. The group index in the response is
 * always the whole picture regardless, so drilling in does not change what you
 * are looking at the list of.
 */
export function getErrorLog(params?: { message?: string }) {
  return apiGet<ErrorLogResponse>('/error-log', params);
}

// ─── GDPR (Sesiunea 29) ─────────────────────────────────────────────
// ⚠️ ACHU-401 (felia 21) — mutate în `gdprEndpoints.ts`, cu evaluarea ștergerii scrisă
// cap-coadă: e singura acțiune ireversibilă din aplicație, iar ce nu ajunge pe ecran înainte
// de cuvântul de confirmare nu se mai poate afla după. ⛔ Exportul rămâne `unknown`, deliberat.
export * from './gdprEndpoints';

// ─── Backup (Sesiunea 29) ───────────────────────────────────────────
// ⚠️ ACHU-396 — mutate în `endpointsBackup.ts` când felia parolei a spart
// clichetul de mărime al acestui fișier. Re-exportate ca să nu se schimbe
// niciun import existent.
export * from './endpointsBackup';

// ─── Schedule / calendar (Sesiunea 31, backlog 11) ──────────────────
// ⚠️ ACHU-401 (felia 12) — mutate în `scheduleEndpoints.ts`, cu formele reale în locul lui
// `any`. Re-exportate ca să nu se schimbe niciun import existent.
export * from './scheduleEndpoints';

// ─── Recurring services (Sesiunea 32, backlog 18) ───────────────────
// ⚠️ ACHU-401 (felia 12) — mutate în `recurringSeriesEndpoints.ts`. Formele rândurilor stăteau
// deja în `recurringSeriesTypes.ts` și au rămas acolo: un fapt, un singur loc.
export * from './recurringSeriesEndpoints';

// ─── Profitability (Sesiunea 33, backlog 26) ────────────────────────

/**
 * ACHU-288 (Sesiunea 69) — estimated vs actual time.
 *
 * "Does a job I sell as two hours actually take two hours?" The estimate is the
 * minutes the PRICE was built from; the actual is approved timesheet hours.
 */
// ─── Leave, ACHU-289 (Sesiunea 70) ───────────────────────────────────
// Holiday and unpaid leave. The balance is accrual minus APPROVED leave over a
// window you choose — deliberately NOT a statutory annual entitlement, because the
// app has no leave year. See backend/src/lib/leavePolicy.ts.

/**
 * ACHU-290: `from`/`to` are optional. Omitted, the server answers for the current
 * leave year (6 April) — which is why the screen does not work one out itself.
 */
export function getLeave(params: { cleanerId: string; from?: string; to?: string }) {
  return apiGet<LeaveListResponse>('/leave', params);
}

export function createLeaveRequest(data: Record<string, unknown>) {
  return apiPost<LeaveMutation>('/leave', data);
}

export function updateLeaveRequest(id: string, data: Record<string, unknown>) {
  return apiPatch<LeaveMutation>(`/leave/${id}`, data);
}

export function approveLeave(id: string) {
  return apiPost<LeaveMutation>(`/leave/${id}/approve`, {});
}

// ACHU-401 (felia 23): singura din grup rămasă `any`, deși ruta răspunde exact ca surorile ei.
export function declineLeave(id: string, reason: string) {
  return apiPost<LeaveMutation>(`/leave/${id}/decline`, { reason });
}

export function cancelLeave(id: string, reason?: string) {
  return apiPost<LeaveMutation>(`/leave/${id}/cancel`, reason ? { reason } : {});
}

export function deleteLeaveRequest(id: string) {
  return apiDelete<LeaveMutation>(`/leave/${id}`);
}

/**
 * Sesiunea 75 (backlog secțiunea 5) — sickness and SSP. Separate from `/leave`
 * because the tables are separate, and they are separate because sickness spends no
 * holiday entitlement.
 */

/**
 * Sesiunea 76 (backlog secțiunea 6) — family leave. Separate from `/sickness`
 * because the pay is 90% with two rates, measured in weeks, and recovered from HMRC.
 */

// ⚠️ ACHU-401 (felia 26) — `getTimeVariance` a ieșit în `timesheetEndpoints.ts`, lângă
// pontajele din care își ia jumătate din cifre. Reexportat, deci niciun apelant nu s-a atins.

// ⚠️ ACHU-401 (felia 16) — mutat în `reportEndpoints.ts`, cu forma întreagă. E un raport de
// BANI citit câmp cu câmp: acolo o formă greșită nu dă un `undefined` vizibil, ci un număr
// greșit care arată corect.
export * from './reportEndpoints';

// ─── Push notifications (Sesiunea 35, ACHU-235) ─────────────────────
// ⚠️ ACHU-401 (felia 12) — mutate în `pushEndpoints.ts`. ⛔ Altceva decât
// `notificationEndpoints.ts`: acela e clopoțelul din aplicație, ăsta e livrarea pe telefon.
export * from './pushEndpoints';

// ─── Payroll ────────────────────────────────────────────────────────
// ⚠️ Mutate în `payrollEndpoints.ts` la felia 12 — 335 de linii. Re-exportate, deci
// apelanții nu s-au atins. ⛔ Plafonul nu se ridică: se extrage.
export * from './payrollEndpoints';
export * from './timesheetEndpoints';
export * from './payrollDocumentEndpoints';

// ⚠️ ACHU-401 (felia 26) — orele CURĂȚĂTORULUI (`/me/timesheets`) au ieșit tot în
// `timesheetEndpoints.ts`. 🔴 Rândul lui NU e rândul biroului: ruta are propriul `serialise`,
// mai îngust — fără nume, fără vizita legată, fără `isDeleted` și fără avertismentele de
// plauzibilitate, care sunt pentru cine aprobă.

// ⚠️ ACHU-401 (felia 31) — simulatorul și tabelul de rate au ieșit în
// `payrollSimulatorEndpoints.ts`. 🔴 Acolo `isSimulation` e tipizat `true` LITERAL: nu
// există cale prin cod care să-l facă fals, iar un ecran plin de cifre exacte e chiar
// lucrul pe care cineva îl confundă cu un fluturaș.

// ─── Timesheets, ACHU-267 (Sesiunea 62) ──────────────────────────────
// Hours actually worked, per person. Still stage 1: nothing is sent to HMRC.
// Owner, 31/07/2026: „payroll nu calculeaza orele lucrate?" — it did not, and
// there was nowhere to record that somebody worked 31 hours rather than the 25
// in their contract.

// ⚠️ ACHU-401 (felia 27) — istoricul de plată (ACHU-351) și P60/P45 pentru birou
// (ACHU-350) au ieșit tot în `payrollDocumentEndpoints.ts`, lângă capătul angajatului.

/**
 * ⚠️ ACHU-401, felia 26 — PONTAJELE au ieșit ÎNTREGI în `timesheetEndpoints.ts`, tipizate
 * cap-coadă (lista, sumarul, sugestiile, munca de noapte, fereastra de perioadă și cele șase
 * scrieri). Reexportate mai jos, deci **niciun apelant nu s-a atins**. 🔴 Ce spune tipul și nu
 * se vedea: `workedMinutes`, `workedHours` și `approvedByKind` sunt același timp în **trei
 * unități**, iar `approvedByKind` e în MINUTE deși stă lângă câmpuri în ore.
 */


// ⚠️ Incidentele și dovada lor au plecat în `endpointsIncidents.ts` (Sesiunea 147): cele trei
// funcții de poze au spart clichetul de mărime, iar §7.4 cere extragere, nu ridicarea cifrei.
export * from './endpointsIncidents';
// §20 (Sesiunea 152) — registrul discuțiilor cu un client, în fișierul lui.
export * from './communicationEndpoints';
// ACHU-554 — preferințele de curățător, mutate în Sesiunea 152 (clichetul de mărime).
// §4 (Sesiunea 160) — contactele din jurul unei fișe de client, în fișierul lor (§7.4).
export * from './cleanerPreferenceEndpoints'; export * from './customerContactEndpoints';

