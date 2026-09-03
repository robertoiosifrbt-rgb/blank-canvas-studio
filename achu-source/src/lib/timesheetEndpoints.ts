/**
 * ACHU-401, felia a douăzeci și șasea — CEASUL: pontajele biroului (ACHU-267), munca de
 * noapte (ACHU-349) și fereastra de perioadă.
 *
 * ⛔ **Fișier propriu, reexportat din `endpoints.ts`** — acela are 926 de rânduri, e peste
 * plafonul de 500 și **nu are voie să crească** (`AGENT_RULES` §7). Niciun apelant nu se
 * schimbă.
 *
 * ⚠️ **Felie STRUCTURALĂ pe ecrane de pontaj**, nu construcție. Se semnalează ca informare.
 *
 * 🔴 **De ce se scrie cap-coadă:** rândul nu iese niciodată brut. Trece prin `serialise`
 * din `backend/src/lib/timesheetSerialise.ts` — un modul propriu, care numește câmp cu
 * câmp ce pleacă — iar totalurile prin `summariseHours` și avertismentele prin
 * `checkEntry`/`checkDays`, toate **pure** și cu forma deja publicată.
 *
 * 🔴 **CE SPUN TIPURILE ȘI NU SE VEDEA:** aici există **trei unități pentru același
 * lucru** — `workedMinutes` (întreg), `workedHours` (zecimal, deja împărțit) și
 * `approvedByKind` (**minute**, deși stă lângă câmpuri în ore). ⛔ Un ecran care adună
 * `approvedByKind.Travel` la `approvedHours` greșește cu un factor de 60, iar rezultatul
 * arată perfect plauzibil pe un pontaj.
 */
import { apiGet, apiPost, apiPatch, apiDelete } from './apiClient';

/** Ce a fost timpul. ⚠️ Vine de la server (`TIME_ENTRY_KINDS`), nu scris în ecran. */
export type TimeEntryKind = 'Job' | 'Travel' | 'Training' | 'Waiting' | 'Other';
export type TimeEntryStatus = 'Draft' | 'Approved' | 'Disputed';

/**
 * Ce e neobișnuit la o intrare sau la o zi — `timeEntryPlausibility.ts`.
 *
 * ⛔ **Avertisment, nu refuz.** Câte ore poate revendica cineva e o regulă de business,
 * deci a owner-ului; iar de la ACHU-498 curățătorul nu-și mai poate corecta singur orele,
 * deci un refuz nou ar bloca ore **reale** fără nicio ieșire pentru el.
 */
export type TimeEntryWarning = { code: string; message: string };

/** O intrare de pontaj — `serialise`, câmp cu câmp. */
export type TimesheetEntry = {
  id: string;
  /** Numărul citit de om (`timeEntryId`), nu `id`-ul. */
  reference: number;
  cleanerId: string;
  /** `null` când ruta n-a cerut relația — nu „fără nume". */
  cleanerName: string | null;
  jobId: string | null;
  job: { reference: number; service: string; date: string | null } | null;
  workDate: string | null;
  /** `HH:MM`. */
  startTime: string;
  /** `null` cât timp tura e deschisă. */
  finishTime: string | null;
  /**
   * 🔴 ACHU-268 — trimis ca FAPT, nu re-derivat din `finishTime === null` în trei locuri.
   * ⚠️ Pe o tură deschisă orele de mai jos sunt **ZERO**, ceea ce e o **absență de
   * măsurătoare**, nu o măsurătoare de zero.
   */
  isOpen: boolean;
  /**
   * ACHU-498 — rândul a fost șters dar rămâne la vedere (Roberto, 15/08/2026: *„da, să
   * rămână urma"*). ⛔ **Singurul loc care primește rânduri șterse e tabelul biroului**;
   * portalul curățătorului și orice calcul de bani le exclud din interogare.
   */
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  deletionReason: string | null;
  breakMinutes: number;
  /**
   * 🔴 §17 (Sesiunea 151) — CÂND a fost pauza, și DE CE s-a redeschis o oră aprobată.
   * ⚠️ `breakMinutes` de deasupra rămâne singura cifră care scade din plată.
   */
  pauseStart: string | null;
  pauseEnd: string | null;
  correctionReason: string | null;
  /** 🔴 MINUTE. `workedHours` de dedesubt e ACELAȘI timp în ore — nu se adună între ele. */
  workedMinutes: number;
  workedHours: number;
  kind: string;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  disputeReason: string | null;
  notes: string | null;
  /** ⚠️ `[]` când nu e nimic de spus — un semn care apare pe fiecare rând nu se mai citește. */
  warnings: TimeEntryWarning[];
};

/**
 * Totalurile, ținute **apart pe status** — `summariseHours`.
 *
 * ⛔ Aprobat, ciornă și contestat nu se adună: doar `approved` e ce se plătește.
 */
export type TimesheetHoursSummary = {
  approvedMinutes: number;
  draftMinutes: number;
  disputedMinutes: number;
  approvedHours: number;
  draftHours: number;
  disputedHours: number;
  entryCount: number;
  /**
   * 🔴 **MINUTE**, deși stă lângă câmpuri în ore — despărțit pe ce a fost timpul, ca
   * deplasarea și instruirea să fie vizibile. ⛔ Adunat la `approvedHours` dă un număr
   * de 60 de ori prea mare, care arată plauzibil.
   */
  approvedByKind: Record<TimeEntryKind, number>;
};

export type TimesheetsResponse = {
  entries: TimesheetEntry[];
  summary: TimesheetHoursSummary;
  /**
   * 🔴 ACHU-498 — ZILELE neobișnuite, verificarea care lipsea cu adevărat. Plafonul de 16
   * ore e **per intrare**, iar trei intrări de câte 6 ore fac 18 ore fără ca vreuna să
   * pară greșită. ⚠️ **Separat de `entries`**, nu lipit pe un rând: avertismentul e despre
   * **ziua** omului, iar pus pe un rând s-ar citi ca o acuzație despre intrarea aceea.
   */
  dayWarnings: TimeEntryWarning[];
  /** Cataloagele, de la server — o listă scrisă în ecran ar oferi ceva ce API-ul refuză. */
  kinds: readonly TimeEntryKind[];
  statuses: readonly TimeEntryStatus[];
};

export function getTimeEntries(params: { cleanerId?: string; from: string; to: string; status?: string }) {
  return apiGet<TimesheetsResponse>('/timesheets', params);
}

/**
 * Orele perioadei, cât valorează și concediul acumulat pe ele.
 *
 * ⚠️ `suggestedGross` se oferă **doar** cuiva plătit la oră. Pentru un salariat, orele nu
 * determină brutul — salariul e același la 30 sau la 40 de ore — deci o cifră derivată din
 * ore ar invita pe cineva să suprascrie un salariu corect cu unul greșit. ⛔ `grossBasis`
 * spune motivul **în cuvinte**, ca ecranul să-l poată rosti, nu doar să dezactiveze un buton.
 */
export type TimesheetSummaryResponse = {
  cleaner: { id: string; name: string; active: boolean };
  period: { from: string; to: string };
  payFrequency: string | null;
  /** În LIRE, sau `null` când persoana nu e plătită la oră. */
  hourlyRate: number | null;
  summary: TimesheetHoursSummary;
  suggestedGross: number | null;
  grossBasis: string;
  /**
   * 🔴 Raportat fie că a întrebat cineva, fie că nu: e o **obligație legală** pentru
   * lucrătorii cu ore neregulate, nu o amabilitate.
   */
  holiday: {
    percent: number;
    hours: number;
    /** `null` când nu există tarif orar din care să iasă o valoare. */
    value: number | null;
    note: string;
  };
};

export function getTimesheetSummary(params: { cleanerId: string; from: string; to: string }) {
  return apiGet<TimesheetSummaryResponse>('/timesheets/summary', params);
}

/**
 * Ore propuse din momentele în care aplicația a ștampilat schimbările de stare ale vizitei.
 *
 * ⛔ **Un punct de plecare, nu o evidență a orelor** — ștampila e când s-a mutat starea, și
 * aparține **vizitei**, nu unei persoane. `note` spune asta și se randează verbatim.
 */
export type TimesheetSuggestion = {
  jobId: string;
  jobReference: number;
  service: string;
  jobDate: string | null;
  actualStartTime: string | null;
  actualFinishTime: string | null;
};

export function getTimesheetSuggestions(params: { cleanerId: string; from: string; to: string }) {
  return apiGet<{ suggestions: TimesheetSuggestion[]; note: string }>('/timesheets/suggestions', params);
}

/**
 * O fereastră de perioadă propusă.
 *
 * ⛔ **Explicit o sugestie, nu un calendar de plată** — în ce zi începe o săptămână și unde
 * se termină o lună sunt decizii de business pe care nu le-a luat nimeni, deci amândouă
 * datele rămân editabile.
 *
 * 🔴 **`start`/`end` AICI, dar `from`/`to` la sumar și la lista de pontaje** — aceeași noțiune,
 * două perechi de nume, în rute vecine. ⚠️ Verificat în `suggestPayPeriod`, nu presupus: prima
 * versiune a tipului ăstuia scria `from`/`to` din reflex și **a picat la compilare pe două
 * ecrane**. Scris aici ca următorul să nu „facă ordine" redenumindu-l.
 */
export type TimesheetPeriodResponse = { start: string; end: string; note: string };
export function getTimesheetPeriod(params: { frequency: string; date?: string }) {
  return apiGet<TimesheetPeriodResponse>('/timesheets/period', params);
}

/* ─── Munca de noapte, Working Time Regulations (ACHU-349) ─────────────────── */

/**
 * O persoană în raportul de noapte. ⚠️ Ruta împrăștie rezultatul lui `nightWorkOver`
 * (`nightWorkPolicy.ts`) și adaugă numele plus cele două conversii în ore — deci câmpurile de
 * mai jos sunt verificate în POLITICĂ, nu presupuse din ecran.
 */
export type NightWorkPerson = {
  cleanerId: string;
  name: string;
  active: boolean;
  /** Zile din fereastră cu **3+ ore** de noapte în tură. */
  nightShifts: number;
  /** 🔴 MINUTE. `nightHours` de dedesubt e același timp în ore. */
  nightMinutes: number;
  totalMinutes: number;
  nightHours: number;
  totalHours: number;
  /**
   * ⚠️ **„LIKELY", și cuvântul e purtător de greutate.** *„As a normal course"* e o judecată
   * despre un tipar de lucru, nu un prag — deci semnalează pe cine să te uiți și ⛔ **nu
   * afirmă niciodată un statut legal**.
   */
  likelyNightWorker: boolean;
  /** Ore pe 24h în perioada de referință. `null` când nu e nimic măsurabil. */
  averageHoursPer24: number | null;
  overCap: boolean;
  /** ⚠️ Ture deschise: lungimea e necunoscută, deci sunt **excluse din toate cifrele de mai sus**. */
  unmeasuredShifts: number;
};

export type NightWorkResponse = {
  referencePeriod: { from: string; to: string; days: number; weeks: number };
  /** ⚠️ Numit ca fereastra să nu fie confundată cu o lună calendaristică sau cu un an fiscal. */
  nightPeriod: { from: string; to: string; note: string };
  capHoursPer24: number;
  people: NightWorkPerson[];
  /** 🔴 Numărate pe server, ca un ecran să nu poată arăta o pagină calmă peste o depășire. */
  likelyNightWorkers: number;
  overCapCount: number;
  overCapNames: string[];
  /**
   * ⚠️ Amândouă notițele călătoresc CU cifrele, la fiecare răspuns. Prima oprește media să
   * fie citită ca definitivă în vreo direcție; a doua oprește raportul să fie citit ca
   * dovadă că obligația de evaluare medicală a fost îndeplinită — ⛔ nu spune nimic despre
   * ea, iar tăcerea pe un ecran de conformitate e luată drept conformitate.
   */
  averageNotice: string;
  healthAssessmentNotice: string;
  /**
   * ⚠️ Numit, nu ascuns: se numără **doar orele APROBATE**, deci o perioadă cu pontaje încă
   * neaprobate se citește MICĂ. Fără propoziția asta, un raport liniștit și un teanc
   * neaprobat arată identic.
   */
  unapprovedNotice: string;
};

export function getNightWork(params: { to?: string; weeks?: number } = {}) {
  return apiGet<NightWorkResponse>('/timesheets/night-work', params as Record<string, unknown>);
}

/* ─── Scrierile ────────────────────────────────────────────────────────────── */

/** ⚠️ Ce întorc toate scrierile de pontaj: rândul reserializat, plus avertismentul de audit. */
export type TimesheetWriteResponse = {
  success: true;
  entry: TimesheetEntry;
  /** Absent când auditul a reușit — `undefined` nu supraviețuiește lui `JSON.stringify`. */
  auditWarning?: string;
  /**
   * 🔴 Doar la aprobare, și **nu e o eroare**: cineva a aprobat deja intrarea asta. Ruta
   * întoarce `success: true` cu steagul ăsta, ca ecranul să spună *„era deja aprobată"* în
   * loc să pretindă că el a făcut-o. ⚠️ Pe ramura asta rândul vine **fără** vizita legată.
   */
  alreadyApproved?: true;
};

export function createTimeEntry(data: Record<string, unknown>) {
  return apiPost<TimesheetWriteResponse>('/timesheets', data);
}

export function updateTimeEntry(id: string, data: Record<string, unknown>) {
  return apiPatch<TimesheetWriteResponse>(`/timesheets/${id}`, data);
}

/**
 * 🔴 ACHU-498 — `noteAcknowledged` e **TEXTUL notei pe care biroul chiar l-a citit**, nu un
 * `true`. Serverul refuză aprobarea fără el când există o notă, și o refuză din nou dacă
 * între timp curățătorul a schimbat nota. ⛔ Un boolean ar confirma orice notă s-ar fi
 * întâmplat să fie acolo când s-a încărcat ecranul. Tipul îl ține `string`, nu `boolean`.
 */
export function approveTimeEntry(id: string, noteAcknowledged?: string) {
  return apiPost<TimesheetWriteResponse>(
    `/timesheets/${id}/approve`, noteAcknowledged === undefined ? {} : { noteAcknowledged });
}

export function disputeTimeEntry(id: string, reason: string) {
  return apiPost<TimesheetWriteResponse>(`/timesheets/${id}/dispute`, { reason });
}

/**
 * 🔴 §17 „Correction reason" (Sesiunea 151) — **motivul e obligatoriu pe un rând APROBAT.**
 *
 * ⚠️ Un rând aprobat nu se poate edita în loc; se redeschide întâi. ⛔ Iar redeschiderea nu cerea
 * nimic până azi: o oră agreată cu omul se deblocca dintr-o apăsare, iar auditul spunea „reopened"
 * fără să spună de ce. 🔴 Serverul refuză fără motiv, deci ecranul nu poate sări peste el.
 */
export function reopenTimeEntry(id: string, reason?: string) {
  return apiPost<TimesheetWriteResponse>(`/timesheets/${id}/reopen`, reason ? { reason } : {});
}

/**
 * ⚠️ O ȘTERGERE MOALE (ACHU-498) — rândul rămâne la vedere în tabelul biroului, cu
 * `isDeleted`, cine l-a șters și de ce. ⛔ De aceea răspunsul **nu** poartă un rând: nu e
 * o schimbare de stare pe care ecranul s-o poată desena fără să reîncarce.
 */
export function deleteTimeEntry(id: string, reason?: string) {  // ACHU-498: motiv opțional
  return apiDelete<{ success: true; auditWarning?: string }>(
    `/timesheets/${id}`, reason ? { reason } : undefined);
}

/* ─── Timpul vândut față de timpul lucrat (ACHU-424) ────────────────────────
 *
 * ⚠️ Un raport de PREȚ, nu de plată: răspunde la *„am vândut destul timp?"*.
 *
 * 🔴 **Aici totul e în ORE**, spre deosebire de pontajele de mai sus — ruta convertește
 * fiecare câmp cu `toHours(...)` înainte să-l trimită. Politica lucrează în minute, ecranul
 * primește ore, iar numele câmpurilor o spun. ⛔ Nu se amestecă cu `workedMinutes`.
 */

/**
 * 🔴 **Cel mai important lucru din răspuns, și de aceea e primul.** O abatere calculată pe
 * trei vizite din nouăzeci nu e un fapt despre firmă, e un fapt despre cele trei — iar
 * diferența e invizibilă dacă n-o spune cineva cu voce tare. `caveat` e compus pe server ca
 * să existe **o singură** formulare.
 */
export type TimeVarianceCoverage = {
  totalJobs: number;
  comparableJobs: number;
  /** ⚠️ Vizite fără ofertă Final — nu vizite fără preț. */
  missingEstimate: number;
  /** ⛔ Vizite fără ore APROBATE. Nu înseamnă „a durat zero", ci „nimeni n-a aprobat încă". */
  missingActual: number;
  percent: number | null;
  caveat: string;
};

export type TimeVarianceService = {
  service: string;
  jobCount: number;
  estimatedHours: number;
  actualHours: number;
  /** Pozitiv = a durat mai mult decât s-a vândut. */
  varianceHours: number;
  variancePercent: number;
  /** ⚠️ Vizite din grup cu estimarea prea mică pentru ca un procent să însemne ceva. */
  jobsBelowThreshold: number;
};

export type TimeVarianceJob = {
  id: string;
  reference: number;
  date: string;
  service: string | null;
  customerName: string;
  /** ⚠️ Câți oameni au ore aprobate pe ea — o vizită în doi nu e o vizită mai lungă. */
  peopleCount: number;
  estimatedHours: number;
  actualHours: number;
  varianceHours: number;
  variancePercent: number;
};

export type TimeVarianceResponse = {
  period: { from: string; to: string; days: number };
  coverage: TimeVarianceCoverage;
  totals: {
    comparableJobs: number;
    estimatedHours: number;
    actualHours: number;
    varianceHours: number;
    /** `null` când nu e nimic de împărțit — ⛔ nu `0`, care ar afirma „exact cât s-a vândut". */
    variancePercent: number | null;
  };
  byService: TimeVarianceService[];
  worstJobs: TimeVarianceJob[];
  /**
   * ⚠️ Spuse, nu lăsate să fie deduse. Amândouă sunt limite reale ale cifrelor de mai sus,
   * și niciuna nu se vede din numere.
   */
  notes: { estimateSource: string; smallJobs: string };
};

export function getTimeVariance(params: { from?: string; to?: string; jobLimit?: number } = {}) {
  return apiGet<TimeVarianceResponse>('/time-variance', params);
}

/* ─── Capătul CURĂȚĂTORULUI (ACHU-268, ACHU-498) ────────────────────────────
 *
 * 🔴 **NU e același rând ca la birou, și e important că nu e.** `/me/timesheets` are
 * **propriul** `serialise`, mai îngust: fără numele persoanei (îl știe), fără vizita legată,
 * fără `isDeleted`, fără `approvedBy` și **fără avertismentele de plauzibilitate** — alea sunt
 * pentru cine aprobă. ⛔ Un tip comun cu `TimesheetEntry` ar afirma câmpuri care nu sosesc
 * aici.
 */
export type MyTimesheetEntry = {
  id: string;
  reference: number;
  workDate: string | null;
  startTime: string;
  finishTime: string | null;
  /** ⚠️ Pe o tură deschisă `workedHours` e ZERO, iar zeroul ăla nu e o măsurătoare. */
  isOpen: boolean;
  breakMinutes: number;
  /**
   * §15 (Sesiunea 160) — fereastra ULTIMEI pauze. ⚠️ Starea „e în pauză acum" = început fără
   * sfârșit, exact ca pe server. ⛔ Totalul minutelor stă în `breakMinutes`, nu aici.
   */
  pauseStart: string | null;
  pauseEnd: string | null;
  workedMinutes: number;
  workedHours: number;
  kind: string;
  status: string;
  disputeReason: string | null;
  /**
   * 🔴 ACHU-498 — singurul lucru pe care un curățător mai poate să-l spună despre propriile
   * ore. Owner-ul a scos editarea și ștergerea pe 09/08/2026 și a pus nota în locul lor:
   * *„Maxim sa scrie o nota care sa apara la birou cand aproba orele."*
   */
  notes: string | null;
  jobId: string | null;
  /**
   * ⛔ **Decis de SERVER, ca ecranul să nu poată fi de altă părere** — și de la ACHU-498 e
   * `false` pe fiecare intrare. Rămâne un câmp, nu o constantă: regula e a owner-ului și se
   * poate schimba fără să se rescrie ecranul.
   */
  canEdit: boolean;
};

export type MyTimesheetsResponse = {
  cleaner: { id: string; name: string };
  /** `isThisWeek` e `true` când nu s-a cerut un interval anume. */
  period: { from: string; to: string; isThisWeek: boolean };
  week: { start: string; end: string; payDate: string };
  entries: MyTimesheetEntry[];
  /** Tura în curs, dacă există — ⚠️ apare **și** în `entries`, nu în locul lor. */
  openShift: MyTimesheetEntry | null;
  totals: { approvedHours: number; draftHours: number; entries: number };
  /**
   * 🔴 Spus pe pagină, nu lăsat să se descopere în ziua de salariu: orele sunt o ciornă până
   * le aprobă biroul. Apărarea funcționează doar dacă omul știe că există.
   */
  notice: string;
  taxYear: { start: string; end: string };
};

/** ⚠️ Toate scrierile curățătorului întorc rândul lui îngust, nu pe cel al biroului. */
export type MyTimesheetWriteResponse = {
  success: true; entry: MyTimesheetEntry; auditWarning?: string;
};

export function getMyTimesheets(params: { from?: string; to?: string } = {}) {
  return apiGet<MyTimesheetsResponse>('/me/timesheets', params);
}

export function clockIn(data: { jobId?: string; kind?: string; startTime?: string; notes?: string } = {}) {
  return apiPost<MyTimesheetWriteResponse>('/me/timesheets/clock-in', data);
}

/**
 * §15 „Pause job" + „Resume job" (Sesiunea 160) — hotărârea lui Roberto, 29/08: butoane, iar
 * minutele TAIE din orele plătite.
 *
 * ⛔ **Ecranul NU trimite `breakMinutes` la ieșirea din tură** de când există astea: un număr lăsat
 * acolo ar fi șters tăcut apăsările omului. Serverul adună singur.
 */
export function pauseShift() {
  return apiPost<{ success: true; pauseStart: string }>('/my-timesheets/pause', {});
}

export function resumeShift() {
  return apiPost<{ success: true; pauseEnd: string; breakMinutes: number }>('/my-timesheets/resume', {});
}

export function clockOut(data: { finishTime?: string; breakMinutes?: number; notes?: string } = {}) {
  return apiPost<MyTimesheetWriteResponse>('/me/timesheets/clock-out', data);
}

export function editMyTimesheet(params: { id: string; [key: string]: unknown }) {
  const { id, ...body } = params;
  return apiPatch<MyTimesheetWriteResponse>(`/me/timesheets/${id}`, body);
}

export function deleteMyTimesheet(params: { id: string }) {
  return apiDelete<{ success: true; auditWarning?: string }>(`/me/timesheets/${params.id}`);
}

