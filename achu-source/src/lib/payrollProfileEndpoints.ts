/**
 * ACHU-401, felia a treizecea — FIȘA DE PAYROLL A UNUI OM (ACHU-259, ACHU-357): codul fiscal,
 * plata, pensia, statutul de angajare și cataloagele din care se aleg.
 *
 * ⛔ **Fișier propriu, reexportat** — niciun apelant nu se schimbă. ⚠️ Felie STRUCTURALĂ;
 * payroll-ul rămâne oprit.
 *
 * 🔴 **CE FACE ZONA ASTA DIFERITĂ DE TOATE FELIILE DE PÂNĂ ACUM: răspunsul se schimbă după
 * CINE ÎNTREABĂ.** Un cont `HROnly` primește aceeași fișă cu **cincisprezece câmpuri scoase** —
 * nu ascunse pe ecran, **scoase din JSON**, fiindcă un câmp ascuns într-o componentă e tot în
 * răspuns, la o filă de devtools distanță.
 *
 * ⛔ **De aceea partea fiscală e OPȚIONALĂ în tip, iar asta e o afirmație despre lume, nu
 * prudență.** Pentru HR chiar lipsește. ⚠️ Un ecran nu are voie să deducă *de ce* lipsește —
 * `fiscalFieldsVisible` de pe răspuns o spune, tocmai fiindcă altfel cineva ar ghici „biroul
 * n-a completat încă" și ar oferi să completeze.
 *
 * ⚠️ **BANII SUNT ÎN LIRE** peste tot aici — ruta a împărțit deja `...Pence` la 100.
 */
import { apiGet, apiPost, apiPatch } from './apiClient';
import type { BankDetailsForDisplay } from './payrollBankEndpoints';

/**
 * Ce metodă de concediu indică **legea** pentru omul ăsta.
 *
 * 🔴 **Refuză, nu ghicește** — fără tip de contract consemnat întoarce `needs-answer`, și ⛔
 * **nu** cade înapoi pe orele contractate, ceea ce făcea vechiul avertisment și de-aia se
 * declanșa pe oamenii greșiți. Un fapt care lipsește produce un refuz, niciodată o valoare
 * implicită.
 */
export type HolidayMethodVerdict =
  | { method: 'settled-week' | 'irregular-12.07'; matchesWhatWeCalculate: boolean; reason: string }
  | { method: 'needs-answer'; matchesWhatWeCalculate: false; reason: string }
  | { method: 'no-entitlement'; matchesWhatWeCalculate: false; reason: string };

/**
 * Partea fișei pe care o vede **oricine** are voie la ecranul ăsta — inclusiv un cont HR.
 * *„Finance = bani, HR = oameni"*, iar ce e mai jos sunt fapte despre **persoană** și despre
 * **angajarea** ei.
 */
export type PayrollProfileCore = {
  /**
   * 🔴 ACHU-380 — id-ul **FIȘEI**, nu al curățătorului. Istoricul de modificări e cheiat pe el.
   *
   * ⚠️ Fără el, panoul de istoric primește `undefined` și **nu se randează deloc** — iar asta
   * e forma periculoasă a defectului: nu o eroare, o **absență**, iar un istoric absent se
   * citește ca *„nu s-a schimbat nimic vreodată"*, nu ca *„ecranul n-a primit cheia"*.
   */
  id: string;
  payFrequency: string;
  contractedHoursPerWeek: number | null;
  dateOfBirth: string | null;
  startDate: string | null;
  endDate: string | null;
  pensionEnrolled: boolean;
  /**
   * ACHU-344 — **DATE, nu bifă**: fiecare termen din înscrierea automată se măsoară dintr-una,
   * iar data retragerii decide dacă trebuie **rambursate** contribuțiile omului.
   */
  autoEnrolDutyDate: string | null;
  pensionEnrolledOn: string | null;
  pensionLetterSentOn: string | null;
  pensionOptedOutOn: string | null;
  niNumber: string | null;
  address: string | null;
  employmentStatus: string | null;
  contractType: string | null;
  /** Eticheta călătorește cu codul — două copii ale catalogului e felul în care se abat. */
  contractTypeLabel: string | null;
  contractTypeWarning: string | null;
  holidayMethod: HolidayMethodVerdict;
  /**
   * ACHU-353. ⚠️ `null` = **neconsemnat**, iar ecranul trebuie să poată deosebi asta de „a
   * ținut funcția tot anul". ⛔ Nu se completează din data de început pe drum: o dată
   * inventată aici ar deveni un fapt.
   */
  directorAppointedOn: string | null;
  department: string | null;
  costCentre: string | null;
  notes: string | null;
};

/**
 * 🔴 **Cele cincisprezece câmpuri pe care un cont `HROnly` NU le primește** (Archana,
 * 03/08/2026: Admin și Finance da, HR nu).
 *
 * ⚠️ `bankDetails` e **una** dintre ele, nu șase — ruta le trimite ca un singur obiect
 * imbricat, deliberat: șase chei surori ar fi șase ocazii de a adăuga a șaptea mai târziu și
 * de a uita s-o treacă pe listă.
 */
export type PayrollProfileFiscal = {
  taxCode: string;
  niCategory: string;
  /** ⚠️ Una dintre cele două e mereu `null`: un om e plătit ori la oră, ori cu salariu. */
  hourlyRate: number | null;
  annualSalary: number | null;
  studentLoanPlan: string | null;
  studentLoanPlanLabel: string | null;
  postgraduateLoan: boolean;
  pensionEmployeePercent: number | null;
  pensionEmployerPercent: number | null;
  /** ACHU-328 — eticheta e chiar cuvintele pe care angajatul le-a bifat. */
  starterDeclaration: string | null;
  starterDeclarationLabel: string | null;
  /** Din P45-ul adus. ⛔ Ținute separat de câștigurile la ACHU. */
  p45Pay: number | null;
  p45Tax: number | null;
  p45LeavingDate: string | null;
  bankDetails: BankDetailsForDisplay;
};

/**
 * ⛔ **`Partial` pe jumătatea fiscală nu e prudență — e forma răspunsului.** Pentru un cont
 * HR, câmpurile alea chiar **nu sosesc**. Ce lipsă înseamnă se citește din
 * `fiscalFieldsVisible`, nu se ghicește.
 */
export type PayrollProfile = PayrollProfileCore & Partial<PayrollProfileFiscal>;

export type PayrollPerson = {
  id: string;
  /** Numărul brut. `employeeNumber` de mai jos e **același**, formatat. */
  reference: number;
  /**
   * ACHU-382 — formatat pe SERVER (`ACHU-001`). ⚠️ Același șir ajunge pe fluturaș și la HMRC
   * ca Payroll ID: ⛔ un prefix scris într-o componentă ar fi a doua copie a formatului,
   * liberă să nu fie de acord cu ce primește HMRC.
   */
  employeeNumber: string;
  name: string;
  active: boolean;
  /** `false` = nu are fișă deloc, deci `profile` e `null`. */
  onPayroll: boolean;
  profile: PayrollProfile | null;
};

/** Cataloagele statutare — ⚠️ **absente** pentru un cont HR, ca și câmpurile pe care le umplu. */
export type PayrollProfileCatalogues = {
  niCategories: Array<{ letter: string; description: string }>;
  studentLoanPlans: Array<{ plan: string; label: string }>;
};

export type PayrollPeopleResponse = {
  people: PayrollPerson[];
  /**
   * 🔴 ACHU-357 — spus cu voce tare, nu dedus din ce câmpuri au venit. Un ecran pus să
   * ghicească de ce lipsește o valoare va ghici până la urmă *„biroul n-a completat încă"* și
   * va oferi să completeze.
   */
  fiscalFieldsVisible: boolean;
  /**
   * ACHU-380 — are voie apelantul ăsta la istoricul de modificări?
   *
   * ⛔ **Un câmp SEPARAT, nu `fiscalFieldsVisible` reciclat**, și diferența a fost plătită de
   * două ori: istoricul e închis **amândurora** rolurilor înguste, iar un cont `FinanceOnly`
   * ar trece de steagul fiscal și abia apoi ar fi refuzat de gardă — cu o eroare de permisiune
   * fulgerând pe ecran ca răsplată pentru deschiderea unei pagini.
   */
  auditHistoryVisible: boolean;
  frequencies: string[];
  employmentStatuses: Array<{ status: string; note: string }>;
  contractTypes: Array<{ code: string; label: string; hint: string; warning: string | null }>;
  contractTypeNote: string;
  /**
   * ACHU-343 — etichetele **deja folosite**, ca formularul să le ofere în loc să ceară cuiva
   * să le retasteze. 🔴 Asta e toată apărarea împotriva greșelilor de tastare, și motivul
   * pentru care niciunul din cele două câmpuri nu are nevoie de un tabel în spate.
   */
  departmentsInUse: string[];
  costCentresInUse: string[];
} & Partial<PayrollProfileCatalogues>;

export function getPayrollPeople() {
  return apiGet<PayrollPeopleResponse>('/payroll/people');
}

/** Ce întorc amândouă salvările: fișa reserializată, decupată după rolul apelantului. */
export type SavePayrollProfileResponse = {
  success: true;
  profile: PayrollProfile;
  auditWarning?: string;
};

export function savePayrollProfile(cleanerId: string, data: Record<string, unknown>) {
  return apiPost<SavePayrollProfileResponse>(`/payroll/people/${cleanerId}`, data);
}

/**
 * ACHU-357 — jumătatea **PERSOANĂ** a unei fișe, și nimic altceva.
 *
 * 🔴 Folosită de un cont `HROnly` în locul lui `savePayrollProfile`, iar separarea nu e
 * ordine. Salvarea întreagă poartă codul fiscal și tariful orar în același corp; unui cont HR
 * i se servește o fișă cu alea **scoase**, deci retrimițând-o le-ar trimite înapoi **ABSENTE**
 * — iar absent se stochează ca `null`. ⛔ Tariful s-ar șterge **în tăcere**, iar simptomul ar
 * fi o cifră greșită pe fluturașul următor.
 *
 * ⚠️ Serverul **refuză** un corp care poartă un câmp fiscal, în loc să-l filtreze: un ecran
 * care trimite unul cade zgomotos aici, în loc să salveze pe jumătate.
 */
export function savePayrollProfilePerson(cleanerId: string, data: Record<string, unknown>) {
  return apiPatch<SavePayrollProfileResponse>(`/payroll/people/${cleanerId}/person`, data);
}

/* ─── Firma ca ANGAJATOR (ACHU-317) ────────────────────────────────────────── */

/**
 * ⚠️ **Nu același rând cu setările de facturare**, care sunt firma ca **VÂNZĂTOR**. Sunt două
 * înregistrări diferite, ale căror referințe se schimbă independent.
 */
export type EmployerPayrollSettings = {
  /** `123/AB456`. Emis de HMRC când se deschide schema PAYE. */
  payeReference: string | null;
  /** `123PA00012345`. ⛔ Altă referință, alt scop — **nu** sunt interschimbabile. */
  accountsOfficeReference: string | null;
  /** Numele de pe schema PAYE, care nu trebuie să fie numele comercial. */
  employerName: string | null;
  /** În LIRE. Decide dacă firma are dreptul la Employment Allowance. */
  previousYearClass1Ni: number | null;
  /** ⚠️ `null` = **nu s-a răspuns**, nu „nu". */
  claimEmploymentAllowance: boolean | null;
  /**
   * ACHU-344. ⛔ `null` = nimeni n-a consemnat-o — ceea ce pentru o firmă fără angajați e
   * **corect**. O dată inventată aici ar pune un termen fals peste trei ani și l-ar **ascunde**
   * pe cel real.
   */
  lastEnrolmentExerciseDate: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  /**
   * 🔴 **Cum se deosebește „niciodată completat" de „completat cu goluri"** — două stări care
   * arată identic într-un obiect cu toate câmpurile `null`. ⛔ Fără el, un ecran nu poate ști
   * dacă tăcerea e o stare de pornire sau o omisiune.
   */
  everSaved: boolean;
};

/**
 * ⚠️ **Împachetat în `{ employer }`, nu întors direct** — verificat în rută, nu presupus:
 * prima versiune a tipului ăstuia l-a scris ca obiectul gol-goluț și avea trei câmpuri din opt.
 */
export function getEmployerPayrollSettings() {
  return apiGet<{ employer: EmployerPayrollSettings }>('/payroll/employer');
}

export function saveEmployerPayrollSettings(data: Record<string, unknown>) {
  return apiPost<{ success: true; employer: EmployerPayrollSettings; auditWarning?: string }>(
    '/payroll/employer', data);
}

