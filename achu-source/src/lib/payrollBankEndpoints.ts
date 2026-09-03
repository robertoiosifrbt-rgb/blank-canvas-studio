/**
 * ACHU-401, felia a douăzeci și cincea — UNDE SE DUC BANII UNUI OM: datele bancare,
 * capătul biroului (ACHU-373) și capătul angajatului (ACHU-377).
 *
 * ⛔ **Fișier propriu, reexportat din `payrollEndpoints.ts`** — deci **niciun apelant nu
 * se schimbă**. Aceeași alegere ca la `payrollQueueEndpoints.ts` (felia 24).
 *
 * ⚠️ **Felie STRUCTURALĂ pe ecrane de payroll**, nu construcție — payroll-ul rămâne
 * oprit (Archana, 04/08/2026). Se semnalează ca informare.
 *
 * 🔴 **De ce zona asta se scrie cap-coadă:** nu iese niciun rând Prisma pe aici. Tot ce
 * pleacă trece prin `forDisplay` și `compareForApproval` din
 * `backend/src/lib/bankDetails*Policy.ts` — două funcții **pure**, care își publică deja
 * forma. Ce nu trece prin ele sunt **propoziții** compuse pe rută, numite una câte una.
 *
 * 🔴 **CE APĂRĂ TIPURILE ASTEA, și nu e o formalitate.** Aici există DOUĂ forme aproape
 * identice: una **mascată** (`accountNumberMasked`, `••••5793`) și una **întreagă**
 * (`accountNumber`). ⛔ Un ecran care le confundă fie afișează un număr întreg unde nu
 * are voie, fie trimite `••••5793` la bancă. Numele diferă tocmai ca greșeala să nu
 * compileze — iar până acum ambele erau `any`, deci nimic nu o oprea.
 */
import { apiGet, apiPost } from './apiClient';

/**
 * Ce are voie un ecran să primească despre un cont — `forDisplay`, pe server.
 *
 * ⛔ **Numărul întreg NU e niciodată în obiectul ăsta.** Mascarea se face pe server: un
 * câmp ascuns într-o componentă e tot în JSON, la o filă de devtools distanță.
 */
export type BankDetailsForDisplay = {
  /** Dacă un salariu are unde să se ducă. Întrebarea pe care o pune o rulare de payroll. */
  onFile: boolean;
  accountName: string | null;
  /** Formatat `12-34-56`. */
  sortCode: string | null;
  /** `••••5793`. ⛔ Nu se trimite înapoi la salvare — e o mască, nu un număr. */
  accountNumberMasked: string | null;
  buildingSocietyRef: string | null;
  /**
   * 🔴 Perechea asta e **toată suprafața de detectare a fraudei**, și de aceea NU e
   * redactată niciodată. ⛔ Ascunsă ca să pară grijulie, ar scoate singura apărare.
   */
  updatedAt: string | null;
  updatedBy: string | null;
};

/** Ce se trimite la salvare. ⚠️ `accountNumber` e numărul ÎNTREG, tastat, nu mascat. */
export type BankDetailsInput = {
  accountName: string;
  sortCode: string;
  accountNumber: string;
  /** `null` = nu are număr de carnet la o societate de credit ipotecar. */
  buildingSocietyRef: string | null;
};

/** Cine trebuie anunțat. ⚠️ Răspunsul Archanei a fost **amândoi** — jumătatea „angajat"
 *  e chiar cea care s-ar fi pierdut ca redundantă. */
export type BankChangeAudience = 'office' | 'employee';

export type SaveBankDetailsResponse = {
  success: true;
  /** Vederea mascată, ca panoul să fie corect fără reîncărcarea paginii. */
  bankDetails: BankDetailsForDisplay;
  /** Gol când schimbarea nu e materială (doar formatare, de pildă). */
  notify: BankChangeAudience[];
  /** Textul înștiințării, sau `null` când nu era nimic material de anunțat. */
  notice: string | null;
  /**
   * 🔴 ACHU-394 — un FAPT, nu o intenție. 📜 Înainte era „schimbarea a fost materială,
   * deci au fost anunțați", ceea ce era adevărat despre intenție și fals despre lume:
   * scrierea notificării e best-effort, iar cine n-are cont de portal nu poate fi
   * anunțat deloc. ⛔ Un ecran care ar tipări propoziția aia ar minți în numele aplicației.
   */
  employeeToldFirst: boolean;
  /**
   * ⚠️ Cazul care NU trebuie să se ascundă în `false`: schimbarea a fost materială și
   * **nu era cui să i se spună**. Permis deliberat, dar biroul trebuie să-l vadă —
   * apărarea pe care se bazează toată lumea nu s-a aplicat schimbării ăsteia.
   */
  nobodyToTell: boolean;
  employeesNotified: number;
  /** Propoziții compuse de rută, randate verbatim. */
  orderingRule: string;
  formatNotice: string;
};

/**
 * 🔴 Numărul ÎNTREG, o singură dată, deliberat.
 *
 * ⛔ Tipul e separat de `BankDetailsForDisplay` tocmai ca cele două să nu se poată
 * confunda: aici `accountNumber` e numărul real, iar `sortCode` e **nebrut-formatat**,
 * exact cum e stocat.
 */
export type RevealedBankDetails = {
  accountName: string | null;
  sortCode: string | null;
  accountNumber: string | null;
  buildingSocietyRef: string | null;
  /** ⚠️ Vine ÎMPREUNĂ cu numărul: citirea om cu om e aranjamentul de lucru, nu cel dorit. */
  notice: string;
  maskingRule: string;
};

/**
 * ⚠️ O SEPARATĂ de `savePayrollProfile`, și nu pentru ordine: salvarea profilului întreg
 * stochează un câmp absent ca `null`, deci retrimiterea profilului fără datele bancare
 * le-ar **ȘTERGE** — fără eroare, iar simptomul e o plată eșuată în ziua de salariu, cu
 * cauza cu trei săptămâni înainte.
 */
export function savePayrollBankDetails(cleanerId: string, data: BankDetailsInput) {
  return apiPost<SaveBankDetailsResponse>(`/payroll/people/${cleanerId}/bank-details`, data);
}

/**
 * 🔴 Un POST fiindcă **SCRIE** — consemnează cine s-a uitat. Un cont „doar citire" are
 * voie la orice GET din aplicația asta, pe temeiul că niciun GET protejat nu schimbă
 * nimic; o dezvăluire prin GET ar fi fost dată exact conturilor menite să privească fără
 * să atingă. ⛔ Nu se „face ordine" transformându-l în GET.
 */
export function revealPayrollBankDetails(cleanerId: string) {
  return apiPost<RevealedBankDetails>(`/payroll/people/${cleanerId}/bank-details/reveal`, {});
}

/* ─── Cererile angajaților, capătul biroului (ACHU-377) ────────────────────── */

/**
 * Un rând din comparație — `compareForApproval`.
 *
 * 🔴 **`before` și `after` sunt AMÂNDOUĂ mascate.** Întrebarea la care răspunde biroul e
 * *chiar persoana asta a cerut asta?*, iar ultimele patru cifre și codul de sortare o
 * lămuresc. Citirea numărului întreg e un act separat și consemnat, și **nu e nevoie**
 * ca să decizi — deci nu e oferită ca parte din decizie.
 */
export type BankRequestComparisonRow = {
  field: 'accountName' | 'sortCode' | 'accountNumber' | 'buildingSocietyRef';
  label: string;
  before: string | null;
  after: string | null;
  /** ⚠️ Calculat pe server. Rândurile NEschimbate se trimit oricum — comparația e întreagă. */
  changed: boolean;
};

export type BankDetailRequest = {
  id: string;
  cleanerId: string;
  name: string;
  submittedAt: string;
  comparison: BankRequestComparisonRow[];
  /**
   * 🔴 ACHU-621 — revizia datelor bancare pe care ecranul ăsta le ARATĂ. Se trimite înapoi la
   * aprobare, ca o aprobare pe un ecran vechi să fie refuzată în loc să scrie datele vechi din
   * cerere peste o schimbare mai nouă a biroului. Motivul: `backend/src/lib/bankDetailsWrite.ts`.
   */
  profileRevision: string;
};

export type BankDetailRequestsResponse = {
  /** Doar cele `Pending`. Ruta nu trimite niciodată una decisă. */
  requests: BankDetailRequest[];
  /**
   * 🔴 Spuse o dată pe ECRAN, nu pe rând — o propoziție repetată la fiecare cerere e una
   * care încetează să fie citită, iar asta e chiar propoziția care împiedică aprobarea să
   * devină un click.
   */
  howToCheck: string;
  recoveryNotice: string;
};

export function getBankDetailRequests() {
  return apiGet<BankDetailRequestsResponse>('/payroll/bank-detail-requests');
}

/**
 * ⚠️ Aprobarea întoarce EXACT ce întoarce o salvare directă — aceleași câmpuri, aceeași
 * `forDisplay`, plus propoziția despre ce **nu** face aprobarea. ⛔ Nu recuperează o
 * plată deja trimisă, iar momentul în care cineva descoperă asta e momentul în care
 * caută un buton care nu există.
 */
export type ApproveBankDetailRequestResponse = {
  success: true;
  bankDetails: BankDetailsForDisplay;
  recoveryNotice: string;
  employeeToldFirst: boolean;
  nobodyToTell: boolean;
  employeesNotified: number;
};

export function approveBankDetailRequest(id: string, note?: string | null, profileRevision?: string) {
  return apiPost<ApproveBankDetailRequestResponse>(
    `/payroll/bank-detail-requests/${id}/approve`, { note: note ?? null, profileRevision });
}

/**
 * ⚠️ `note` e CERUT de server: o refuzare fără motiv e una pe care angajatul o trimite
 * din nou, neschimbată. ⛔ Textul ajunge la el **verbatim** — o parafrază ar fi versiunea
 * pe care o citește el, dar nu cea scrisă de birou.
 */
export function rejectBankDetailRequest(id: string, note: string) {
  return apiPost<{ success: true }>(`/payroll/bank-detail-requests/${id}/reject`, { note });
}

/* ─── Capătul ANGAJATULUI (ACHU-377) ───────────────────────────────────────── */

/**
 * Cererea lui în așteptare, arătată **înapoi lui**, mascată.
 *
 * 🔴 Fără ea, omul care tocmai a cerut o schimbare vede datele VECHI, trage concluzia că
 * nu a mers, și trimite din nou — iar regula „o singură cerere în așteptare" l-ar refuza
 * atunci fără nicio explicație pe care s-o poată folosi.
 */
export type MyPendingBankRequest = {
  submittedAt: string;
  accountName: string;
  sortCode: string;
  accountNumberMasked: string;
  buildingSocietyRef: string | null;
};

export type MyBankDetailsResponse = {
  onFile: boolean;
  /** ⛔ Mascat și pentru el, și **fără** dezvăluire — vezi ruta. */
  current: BankDetailsForDisplay | null;
  pending: MyPendingBankRequest | null;
  /**
   * ⚠️ Propoziția se SCHIMBĂ după cum există sau nu o cerere în așteptare, și amândouă
   * spun același lucru esențial: până când biroul e de acord, plata următoare se duce
   * tot în contul de pe fișă.
   */
  notice: string;
};

export function getMyBankDetails() {
  return apiGet<MyBankDetailsResponse>('/me/bank-details');
}

/**
 * ⚠️ Creează o CERERE. Nu schimbă nimic până când biroul nu e de acord.
 *
 * 🔴 `formatNotice` nu e decor: oprește „aplicația a zis că e valid" să devină „deci
 * contul trebuie să fie bun". Un format corect nu e dovada că un cont există.
 */
export function requestMyBankDetails(data: BankDetailsInput) {
  return apiPost<{
    success: true; requestId: string; notice: string; formatNotice: string;
  }>('/me/bank-details', data);
}

