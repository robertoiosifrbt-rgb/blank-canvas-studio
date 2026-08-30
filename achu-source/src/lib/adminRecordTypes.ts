/**
 * ACHU-401, felia a nouăsprezecea — CELE PATRU ÎNREGISTRĂRI DE BAZĂ ale biroului: clientul,
 * vizita, plata și cheltuiala.
 *
 * 🔴 **De ce un fișier, și nu tipuri în ecrane.** Fiecare dintre cele patru e citită de
 * **două** ecrane — pagina de listă și dialogul care o deschide — iar până acum doar pagina
 * avea tip. Dialogul își declara `item: any`, deși pagina îi trimite exact rândul pe care
 * tocmai îl tipizase. ⛔ **Un tip publicat pe care ecranul de alături nu-l folosește nu apără
 * nimic** (lecția feliei 14, repetată aici pe cele patru ecrane cu cel mai mult trafic).
 *
 * ⚠️ **Fiecare câmp de mai jos e verificat în `schema.prisma`, nu presupus din ecran** — asta
 * e toată deosebirea față de greșeala care a produs ACHU-741, unde un tip scris de mână lângă
 * ecran numea un câmp pe care ruta nu-l trimite. Câmpurile care **nu** sunt coloane (le compune
 * ruta) sunt marcate una câte una.
 *
 * ⛔ **Sunt SUBSETURI, deliberat, nu rândul întreg.** Rutele de listă împrăștie rândul Prisma
 * (`{ ...c }`, 25–46 de coloane), iar un tip scris de mână peste tot rândul e chiar greșeala
 * descrisă în antetul lui `endpoints.ts`. Aici stă doar ce **citește** un ecran; un câmp nou
 * intră când îl citește cineva, verificat atunci.
 *
 * ⚠️ **Datele sunt `string`, iar unele sosesc ca timestamp întreg.** O coloană `@db.Date`
 * împrăștiată prin `...rând` ajunge „2026-06-01T00:00:00.000Z". Vezi `toDateInputValue` din
 * `ukDate.ts` — și ACHU-746, care e chiar defectul produs de asta.
 */
import type { CustomerRisk } from '@/components/admin/CustomerRiskSignals';

/**
 * Ce se citește despre un CLIENT — `backend/src/routes/customers.ts`, `GET /`.
 *
 * Ruta împrăștie rândul `Customer` întreg și adaugă `risk`.
 */
export type CustomerRecord = {
  id: string;
  customerId: number;
  customerName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  postcode: string | null;
  customerType: string | null;
  status: string | null;
  notes: string | null;
  /**
   * 🔴 ACHU-549 — cele trei note au trei CITITORI diferiți: `notes` rămâne în birou,
   * `accessibilityNote` ajunge la curățător, `customerVisibleNote` ajunge la client.
   */
  accessibilityNote: string | null;
  customerVisibleNote: string | null;
  preferredContactMethod: string | null;
  preferredContactWindow: string | null;
  contactPreferenceNote: string | null;
  /** §4 (Sesiunea 160) — ziua revenirii (`YYYY-MM-DD` sau ISO) și limba în care e mai ușor pentru om. */
  nextFollowUpDate: string | null;
  languagePreference: string | null;
  /** ACHU-218 — `null` = datele personale NU au fost șterse la cerere. */
  anonymisedAt: string | null;
  anonymisedBy: string | null;
  createdAt: string;
  /**
   * 🔴 LEGACY, și motivul pentru care a existat ACHU-524: rândurile importate din Zite purtau
   * `createdDate`; unul din Postgres nu-l are niciodată. Rămâne opțional, ca în
   * `src/lib/defaultSort.ts:53`.
   */
  createdDate?: string;
  /**
   * ACHU-552 — semnalele de risc, calculate de ruta de listă (`customerRiskSignals.ts`).
   *
   * ⚠️ **Opțional deliberat:** un răspuns dintr-o versiune mai veche de backend nu-l poartă,
   * iar ecranul tratează lipsa lui ca „niciun semnal", nu ca eroare.
   */
  risk?: CustomerRisk;
  /**
   * 🆕 §4 „Last job date" / „Next job date" (Sesiunea 157) — scoase din vizitele pe care ruta de
   * listă le încarcă oricum pentru semnalele de risc, deci **fără nicio interogare în plus**.
   *
   * ⛔ `null` nu înseamnă același lucru în cele două: fără „ultima" = nu a fost nimeni niciodată;
   * fără „următoarea" = **nimic programat**, care e chiar semnalul pentru un abonament golit fără
   * să observe cineva. ⚠️ Ce se numără și ce nu (anulatele nu, `No Access` da) e scris o dată, în
   * `backend/src/lib/customerActivityDates.ts`.
   *
   * ⚠️ Opționale, ca `risk`: un răspuns mai vechi nu le poartă, iar ecranul citește lipsa ca „—".
   */
  lastJobDate?: string | null;
  nextJobDate?: string | null;
  /**
   * 🆕 §4 „Last contact date" (Sesiunea 157) — cel mai recent rând din registrul de discuții (§20),
   * indiferent de canal și de direcție.
   *
   * ⛔ `null` = **nimic consemnat**, nu „nu s-a vorbit niciodată": registrul se completează de mână.
   */
  lastContactAt?: string | null;
  /**
   * 🆕 §4 „Customer lifetime value" (Sesiunea 157) — cât a intrat de la omul ăsta, în lire:
   * încasările active **minus restituirile**, pe toate plățile lui.
   *
   * ⛔ Nu e profit și nu e cât datorează. ⚠️ `0` e un răspuns (n-a plătit încă nimic), nu o lipsă.
   */
  lifetimeReceived?: number;
  /**
   * 🆕 §4 „Average rating" (Sesiunea 157) — media notelor lăsate de client, **și din câte**.
   *
   * 🔴 Cele două nu se despart: „5.0" din una și „4.6" din treizeci nu spun același lucru.
   * ⛔ `ratingCount: 0` înseamnă **nicio notă**, nu nota zero.
   */
  averageRating?: number | null;
  ratingCount?: number;
};

/**
 * Ce se citește despre o VIZITĂ — `backend/src/routes/jobs.ts`, `GET /` și `GET /:id`.
 *
 * ⚠️ **Banii sunt `number`, nu `string`:** ruta cheamă explicit `.toNumber()` pe Decimal,
 * spre deosebire de Abonamente, care împrăștie Decimal-ul ca atare.
 */
export type JobRecord = {
  id: string;
  jobId: number;
  /**
   * ⚠️ `GET /` îl împrăștie ca **timestamp întreg**; `GET /:id` îl taie la `YYYY-MM-DD`.
   * De aceea ecranul trece prin `toDateInputValue` (ACHU-228).
   */
  jobDate: string;
  customerId: string;
  /** Compus de rută din relația `customer`, nu o coloană a vizitei. */
  customerName: string;
  service: string;
  address: string | null;
  /** ⛔ `Job.address` rămâne INSTANTANEU (`AGENT_RULES` §15); casa completează doar golul. */
  propertyId: string | null;
  startTime: string | null;
  finishTime: string | null;
  /** ⚠️ Ce a fost consemnat că s-a întâmplat, nu ce s-a programat. */
  actualStartTime: string | null;
  actualFinishTime: string | null;
  status: string;
  notes: string | null;
  customerInstructions: string | null;
  adminNotes: string | null;
  cleanerCompletionNotes: string | null;
  quoteNumber: string | null;
  recurringSeriesId: string | null;
  amountCharged: number;
  /** Cele trei de mai jos le calculează ruta din plățile vizitei (`computeJobPaymentSummary`). */
  amountReceived: number;
  outstandingBalance: number;
  paymentStatus: string;
  /** ACHU-421: prezent doar cât timp vizita nu are preț propriu. Compus de rută. */
  pendingQuote: { id: string; quoteNumber: string; grandTotal: number } | null;
  /**
   * 🆕 §17 (Sesiunea 154) — cât s-a abătut vizita de la fereastra ei: pornire târzie, terminare
   * devreme, depășire. Compus de `lib/jobScheduleFlags.ts`.
   *
   * ⚠️ **OPȚIONAL fiindcă doar lista îl trimite** (`buildJobListRows`), ca `cancellationWarning`
   * mai jos, doar în oglindă: acela vine numai de la `GET /:id`. ⛔ Ecranul citește `?? []`, deci un
   * răspuns fără el nu arată steaguri false.
   */
  scheduleFlags?: { code: 'late-start' | 'early-finish' | 'overran'; minutes: number; message: string }[];
  /**
   * 🔴 §9 „Cleaner count" (Sesiunea 160) — câți trebuie la vizita asta, și câți sunt.
   *
   * ⚠️ `label` vine ÎNTREAGĂ de la server (`lib/jobCleanerCount.ts`), ca propoziția de expirare a
   * unei oferte: ecranul nu compune nicio frază și nu adună nimic. ⛔ `label: null` = nimeni n-a
   * spus câți trebuie, deci **nu se arată nimic** — un rând pe fiecare vizită veche ar fi zgomot
   * pe tot orarul.
   */
  cleanersNeeded?: number | null;
  coverage?: { needed: number | null; covered: number; short: number; over: number; label: string | null };
  /** Id-urile cererilor de ofertă legate, nu obiectele. Compus de rută în amândouă. */
  quoteRequests: string[];
  /**
   * 🔴 ACHU-507 — avertismentul de fereastră de anulare. **OPȚIONAL fiindcă doar `GET /:id`
   * îl trimite**, nu și lista: o vizită deschisă din pagina Jobs nu îl are. Vezi ACHU-747.
   */
  cancellationWarning?: string | null;
  /**
   * Revizia calculată pe SERVER din rândul brut. ⚠️ Fără ea, fiecare salvare a unei vizite
   * create dintr-o cerere de ofertă era respinsă ca CONFLICT (Sesiunea 28). Opțional: ecranul
   * păstrează o cale de rezervă pentru răspunsuri mai vechi.
   */
  _revision?: string;
};

/**
 * Ce se citește despre o PLATĂ — `backend/src/routes/payments.ts`, `GET /`.
 *
 * Ruta împrăștie rândul `Payment`, convertește `amount` cu `.toNumber()` și adaugă două
 * etichete compuse.
 */
export type PaymentRecord = {
  id: string;
  paymentId: number;
  /** ⚠️ Timestamp întreg, ca la vizite — coloana e `@db.Date`. Vezi ACHU-746. */
  paymentDate: string | null;
  amount: number;
  jobId: string | null;
  /**
   * ⛔ **Se citește, nu se trimite:** la salvare clientul îl derivă SERVERUL din vizita aleasă
   * (`payments.ts`), iar un al doilea izvor de adevăr în formular e chiar ce a produs ACHU-200.
   * Aici e folosit doar ca să se știe dacă un filtru nou de răsfoire ar ascunde vizita aleasă.
   */
  customerId: string | null;
  paymentMethod: string | null;
  paymentProvider: string | null;
  paymentStatus: string | null;
  externalReference: string | null;
  notes: string | null;
  voidStatus: string;
  createdBy: string | null;
  updatedBy: string | null;
  /** §23 (Sesiunea 153) — dovada că banii au intrat: calea în bucket-ul privat `receipts`. */
  proofFileUrl: string | null;
  proofUploadedAt: string | null;
  proofUploadedBy: string | null;
  /** §23 — de ce s-au întors banii. Vezi `backend/src/lib/paymentEvidencePolicy.ts`. */
  refundReason: string | null;
  /** Compuse de rută; `''` când plata nu are client, respectiv vizită. */
  customerName: string;
  jobLabel: string;
};

/**
 * Ce se citește despre o CHELTUIALĂ — `backend/src/routes/expenses.ts`, `GET /`.
 *
 * Ruta împrăștie rândul `Expense` și convertește cele trei coloane de bani cu `.toNumber()`.
 */
export type ExpenseRecord = {
  id: string;
  expenseId: number;
  /** ⚠️ Timestamp întreg — vezi ACHU-746. */
  expenseDate: string;
  supplier: string;
  category: string | null;
  description: string | null;
  amount: number;
  paymentMethod: string | null;
  paidBy: string | null;
  notes: string | null;
  receiptAvailable: boolean;
  voidStatus: string;
  linkedJobId: string | null;
  /** Compusă de rută; `''` când cheltuiala nu e legată de o vizită. */
  linkedJobLabel: string;
  /**
   * ⚠️ Calea din bucket, nu o adresă semnată — ecranul cere una proaspătă la deschidere.
   * ⛔ **Nu `receiptFile[0].url`**: forma aceea nu a existat niciodată în răspuns (ACHU-197).
   */
  receiptFileUrl: string | null;
  documentType: string | null;
  documentNumber: string | null;
  /** `null` când nu s-au consemnat — nu `0`, care ar afirma o sumă. */
  subtotal: number | null;
  vatAmount: number | null;
  currency: string | null;
  manuallyReviewed: boolean;
  /** Ce a citit extragerea automată din bon (ACHU-201). `null` = nu a rulat. */
  extractionStatus: string | null;
  extractionConfidence: number | null;
  extractionNotes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
};

