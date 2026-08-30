/**
 * ACHU-401, felia a paisprezecea — CE ȚINE DE O VIZITĂ: cine merge la ea (asignările) și ce e
 * de făcut acolo (checklistul).
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `endpoints.ts`** (`AGENT_RULES` §7).
 *
 * ⚠️ **Ce NU e aici, și de ce:** `getJobs`, `saveJob`, `getJob`. Rutele acelea împrăștie rândul
 * Prisma întreg (`{ ...job, … }`), iar un tip scris de mână peste ~40 de coloane e chiar
 * greșeala pe care o descrie antetul lui `endpoints.ts` — și e chiar greșeala care a produs
 * ACHU-741. Cele două de mai jos se pot citi cap-coadă din `res.json`-ul rutei, deci se scriu.
 */
import { apiGet, apiPost, apiDelete } from './apiClient';

/**
 * ACHU-401 (felia 19) — un rând din lista de alegere a vizitei.
 *
 * ⚠️ **Ruta asta e altceva decât `getJobs`**, și de aceea are voie să stea aici: nu împrăștie
 * rândul Prisma, ci compune explicit șase câmpuri (`backend/src/routes/jobs.ts`, `GET
 * /for-select`) — se citește cap-coadă, deci se scrie.
 *
 * 🔴 `customerId` vine odată cu rândul **fiindcă un selector trebuie să poată spune dacă vizita
 * deja aleasă mai aparține clientului pe care tocmai s-a filtrat** (ACHU-200), fără să încarce
 * toată lista în browser.
 */
export type JobForSelect = {
  id: string;
  /** Numărul vizibil al vizitei, nu cuid-ul. */
  jobId: number;
  customerId: string;
  customerName: string;
  /** `''` când nu s-a consemnat — ruta normalizează, deci nu e `null` aici. */
  service: string;
  /** `YYYY-MM-DD`, tăiat de rută. */
  jobDate: string;
};

/**
 * Lista scurtă pentru selectoarele de vizită (Plăți, Cheltuieli, calculatorul de preț).
 *
 * ⚠️ Ruta întoarce cel mult **50** de rânduri și filtrează pe server; un ecran care are nevoie
 * de mai multe trebuie să restrângă căutarea, nu să ceară tot.
 */
export function getJobsForSelect(params: { search?: string; customerId?: string }) {
  return apiGet<{ jobs: JobForSelect[] }>('/jobs/for-select', params);
}

/**
 * Un curățător pus pe o vizită.
 *
 * ⚠️ Ruta împrăștie rândul `JobAssignment` și adaugă cele patru câmpuri despre om
 * (`backend/src/routes/jobAssignments.ts:70`). Modelul are exact câmpurile de mai jos —
 * verificat în `schema.prisma`, nu presupus din ecran.
 */
export type JobAssignment = {
  id: string;
  jobAssignmentId: number;
  jobId: string;
  cleanerId: string;
  assignmentRole: string | null;
  /** `YYYY-MM-DD`. `null` = nu s-a consemnat o dată separată de cea a vizitei. */
  assignedDate: string | null;
  notes: string | null;
  assignmentUniqueKey: string;
  /**
   * ACHU-565 — când a anunțat că a plecat spre client. ⚠️ `null` = **nu a anunțat**, niciodată
   * „nu a plecat": mulți nu apasă nimic.
   */
  onTheWayAt: string | null;
  cleanerName: string;
  /** `''` când lipsește, nu `null` — ruta normalizează. */
  cleanerPhone: string;
  cleanerEmail: string;
  /**
   * 🔴 Vine odată cu asignarea fiindcă un curățător **inactiv** poate fi încă pe o vizită veche,
   * iar ecranul trebuie să o poată spune.
   */
  cleanerActive: boolean;
};

/**
 * Preferințele sunt ale **CLIENTULUI**, nu ale vizitei.
 *
 * ⚠️ Numele vine cu ele, deliberat: panoul are lista curățătorilor **activi**, dar un curățător
 * inactiv poate fi încă preferat sau exclus, iar avertismentul trebuie să-l poată numi.
 */
export type CustomerCleanerPreference = {
  cleanerId: string;
  cleanerName: string;
  /** `preferred` | `excluded` — vezi `backend/src/routes/customerCleanerPreferences.ts`. */
  kind: string;
  reason: string | null;
};

/**
 * 🔴 ACHU-797 — un curățător **plecat în ziua vizitei**: concediu aprobat sau absență de boală.
 *
 * ⚠️ **`message` vine scris întreg de pe server**, cu intervalul în el. ⛔ Nu se recompune în ecran:
 * aceeași propoziție se arată și la asignarea în masă, iar două locuri care o construiesc singure ar
 * ajunge să spună lucruri diferite despre același om și aceeași zi
 * (`backend/src/lib/cleanerAwayPolicy.ts` — `awayMessage`).
 *
 * ⚠️ `reason` e aici doar pentru eticheta scurtă de pe rândul unei asignări existente („On leave" /
 * „Off sick"); motivul întreg rămâne în `message`.
 */
export type AwayCleaner = {
  cleanerId: string;
  reason: 'leave' | 'sickness';
  message: string;
};

export function getJobAssignments(params: { jobId: string }) {
  return apiGet<{
    assignments: JobAssignment[];
    customerPreferences: CustomerCleanerPreference[];
    /**
     * 🆕 ACHU-797 — **toți** cei plecați în ziua vizitei, nu doar cel deja ales: panoul are un
     * dropdown, iar un avertisment care apare abia DUPĂ alegere ajunge prea târziu. ⛔ Gol când
     * vizita nu are dată — „plecat" nu are înțeles fără o zi.
     */
    awayCleaners: AwayCleaner[];
    /**
     * 🆕 §13 „Standard working days" (Sesiunea 158) — cine e pus într-o zi care nu e din programul
     * lui obișnuit. ⛔ **Numai cei despre care se ȘTIE:** fișele fără program scris nu apar deloc,
     * fiindcă „nimeni nu a scris" nu e „nu lucrează".
     */
    outsidePattern: { cleanerId: string; cleanerName: string; note: string }[];
  }>('/job-assignments', params);
}

/**
 * 🆕 §9 „Linked incident" + „Linked complaint" (Sesiunea 158) — ce s-a raportat despre O vizită.
 *
 * ⚠️ Legăturile existau în bază de mult (`Incident.jobId`, `CustomerRequest.jobId`), dar ecranul
 * vizitei nu le atingea: reclamația era pe alt ecran, incidentul pe al treilea, iar cine nu știe că
 * există nu le caută.
 *
 * ⛔ **Numai citire, și numai câmpurile unui rând de listă.** Dosarul întreg se lucrează pe ecranul
 * lui (§29 incidente, §20 cereri) — o a doua copie s-ar învechi față de prima.
 */
export type JobLinkedIncident = {
  id: string;
  /** Numărul citit de om (`incidentId`), cel care se caută pe celălalt ecran. */
  reference: number;
  kind: string;
  severity: string;
  status: string;
  /** `YYYY-MM-DD`. */
  occurredOn: string;
  /**
   * ⛔ **Doar DACĂ numește un curățător, niciodată CINE.** Ecranul vizitei e citit de tot biroul, iar
   * „despre cine" e o întrebare pentru dosarul incidentului, unde există și contextul.
   */
  namesACleaner: boolean;
};

export type JobLinkedRequest = {
  id: string;
  reference: number;
  /** `Problem` (reclamația), `Reschedule`, `Reclean`, … — vezi `CUSTOMER_REQUEST_KINDS` pe server. */
  kind: string;
  status: string;
  /** Moment ISO: la o reclamație, ora contează. */
  createdAt: string;
};

export function getJobLinkedRecords(params: { jobId: string }) {
  return apiGet<{ incidents: JobLinkedIncident[]; requests: JobLinkedRequest[] }>(
    '/job-linked-records', params,
  );
}

export function saveJobAssignment(data: Record<string, unknown>) {
  return apiPost<{ success: true; id: string; auditWarning?: string }>('/job-assignments/save', data);
}

export function deleteJobAssignment(params: { id: string }) {
  return apiDelete<{ success: true; auditWarning?: string }>(`/job-assignments/${params.id}`);
}

/**
 * Un punct din checklistul vizitei.
 *
 * ⚠️ `completed` și `notApplicable` sunt **două câmpuri separate**, nu o stare cu trei valori —
 * așa le ține baza. 🔴 **ACHU-690, reparat 18/08/2026:** puteau fi amândouă adevărate deodată.
 * Acum se exclud — serverul stinge unul când îl aprinde pe celălalt, **în aceeași scriere**, și
 * refuză cererea care le cere pe amândouă. ⛔ Tipul rămâne cu două câmpuri fiindcă asta ține
 * baza; combinația `true`/`true` pur și simplu nu mai poate veni de la server.
 */
export type JobChecklistItem = {
  id: string;
  itemKey: string;
  groupName: string;
  itemLabel: string;
  /** Din ce câmp al vizitei a fost generat punctul. `null` pentru cele adăugate de om. */
  sourceField: string | null;
  itemIndex: number;
  completed: boolean;
  completedBy: string | null;
  completedAt: string | null;
  notes: string | null;
  notApplicable: boolean;
  notApplicableReason: string | null;
  /**
   * §16 (Sesiunea 144) — 🔴 **punctul ăsta oprește încheierea vizitei, sau nu.**
   *
   * ⚠️ `true` pe tot ce exista înainte de coloană și pe tot ce se generează din ofertă: munca
   * comandată e obligatorie. `false` doar acolo unde a spus-o un om — biroul, pe un punct al casei
   * sau pe unul al unei vizite anume.
   */
  required: boolean;
  /**
   * §16 „Photo required per item" (Sesiunea 144) — ⛔ **punctul nu se bifează fără poză.**
   * ⚠️ Serverul refuză bifarea; ecranul arată butonul de cameră **doar** aici, ca să nu se
   * colecteze poze din casa nimănui unde nimeni nu le-a cerut.
   */
  photoRequired: boolean;
  /**
   * ⛔ **Există o poză — NU calea ei.** O cale de bucket nu are ce căuta într-un răspuns; linkul
   * semnat se cere separat, când omul vrea s-o vadă.
   */
  hasPhoto: boolean;
  /** Numele celui care a făcut poza. `null` dacă nu există poză. */
  photoUploadedBy: string | null;
  /** Punct rămas dintr-o versiune veche a vizitei: nu se numără și nu se arată. */
  obsolete: boolean;
};

/**
 * ⚠️ `hasChecklist: false` **nu** e același lucru cu „checklist gol": înseamnă că vizita nu are
 * deloc unul, iar ecranul spune altceva în cele două cazuri. `groups` e `[]` în amândouă.
 */
export type JobChecklistResponse = {
  groups: { groupName: string; items: JobChecklistItem[] }[];
  /** Numără și punctele marcate „nu se aplică" — sunt tot rezolvate. */
  completed: number;
  total: number;
  hasChecklist: boolean;
  /**
   * §16 (Sesiunea 144) — ⚠️ **cifrele despre OBLIGAȚIE, separat de cele despre acoperire.**
   * `completed`/`total` de sus au rămas exact ce erau (toată munca vizitei); astea trei spun ce
   * **oprește** încheierea. ⛔ Nu se recalculează pe ecran din `groups`: regula stă pe server,
   * lângă poartă, iar două copii ale ei ar început să difere la prima corectură.
   */
  requiredTotal: number;
  requiredCompleted: number;
  /** Puncte opționale rămase deschise. ⚠️ Nu opresc nimic — se arată, ca să se poată vedea. */
  optionalOpen: number;
};

export function getJobChecklist(params: { jobId: string }) {
  return apiGet<JobChecklistResponse>('/job-checklist', params);
}

/**
 * §16 „Photo required per item" (Sesiunea 144) — poza de dovadă de pe un punct.
 *
 * ⚠️ **Trei funcții, nu una cu un steag:** urcarea trimite o imagine base64 (mare), citirea
 * întoarce un link cu termen, ștergerea nu trimite nimic. Formele nu au ce împărți.
 */
export function uploadChecklistItemPhoto(data: { checklistItemId: string; imageData: string }) {
  return apiPost<{ success: true; auditWarning?: string }>('/job-checklist-photo', data);
}

export function getChecklistItemPhoto(params: { checklistItemId: string }) {
  return apiGet<{ signedUrl: string | null; uploadedBy: string | null; uploadedAt: string | null }>(
    `/job-checklist-photo/${params.checklistItemId}`, {});
}

export function deleteChecklistItemPhoto(params: { checklistItemId: string }) {
  return apiDelete<{ success: true; auditWarning?: string }>(`/job-checklist-photo/${params.checklistItemId}`);
}

/**
 * ⚠️ **Aici de la §16 (Sesiunea 144)**, nu în `endpoints.ts`: stătea acolo fiindcă răspunsul ei e
 * rezultatul unei rezervări de token, cu formă proprie. Câmpul nou a împins `endpoints.ts` peste
 * clichetul de mărime, iar locul corect era oricum lângă citirea checklistului.
 */
export function updateJobChecklistItem(data: {
  checklistItemId: string; completed?: boolean; notes?: string;
  notApplicable?: boolean; notApplicableReason?: string;
  /**
   * §16 (Sesiunea 144) — „trebuie făcut" / „e bine dacă se face", pe o vizită anume.
   * ⛔ **Doar biroul.** Serverul refuză câmpul venit de la un curățător: cine e oprit de poartă nu
   * are voie să mute punctul care îl oprește.
   */
  required?: boolean;
  /**
   * §16 (Sesiunea 144) — „punctul ăsta cere o poză". ⛔ **Doar biroul**, ca `required`: cine e
   * oprit de condiție nu are voie să o stingă.
   */
  photoRequired?: boolean;
  requestToken?: string;
}) {
  return apiPost<{ success: true; auditWarning?: string }>('/job-checklist/item', data);
}

/**
 * 🆕 §9 „Duplicate-job warning" (Sesiunea 157) — dublura, spusă **înainte** de salvare.
 *
 * ⚠️ Definiția e cea din §40 (același client, aceeași zi, același serviciu, anulatele nu intră) —
 * serverul cheamă **aceeași funcție** ca raportul de calitate a datelor, ca ecranul și raportul să nu
 * spună lucruri diferite despre același rând.
 *
 * ⛔ **Avertizează, nu refuză:** două vizite într-o zi pot fi cinstite (o casă mare dimineața și
 * seara, sau o reprogramare scrisă înainte ca prima să fie anulată). ⚠️ De asta răspunsul e o
 * propoziție cu **numerele vizitelor în ea**, nu o eroare — iar `message` e `null` când nu e nimic.
 */
export type JobDuplicateCheck = {
  duplicates: { id: string; jobId: number; service: string | null; status: string | null; startTime: string | null }[];
  message: string | null;
};

export function checkJobDuplicate(params: {
  customerId: string; jobDate: string; service?: string; excludeJobId?: string;
}) {
  return apiGet<JobDuplicateCheck>('/jobs-duplicate-check', params);
}

