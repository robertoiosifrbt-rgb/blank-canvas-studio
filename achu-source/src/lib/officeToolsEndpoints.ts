/**
 * ACHU-401, felia a douăzeci și treia — UNELTELE CARE TAIE TRANSVERSAL prin birou: căutarea
 * globală, istoricul de audit, setările financiare și ștergerea unei înregistrări.
 *
 * ⛔ **Fișier propriu, reexportat din `endpoints.ts`** (`AGENT_RULES` §7) — niciun apelant nu se
 * schimbă. Sunt împreună fiindcă niciuna nu aparține unui singur ecran: fiecare se cheamă de
 * peste tot, iar asta e chiar deosebirea față de modulele pe domenii de lângă ele.
 */
import { apiGet, apiPost } from './apiClient';

// ─── Căutarea globală ───────────────────────────────────────────────

/**
 * Ce întoarce căutarea din antet — **cinci** liste, fiecare plafonată la 8 rânduri pe server.
 *
 * ⚠️ **SUBSETURI, nu rândurile întregi:** ruta împrăștie rândul Prisma pentru vizite, plăți și
 * cheltuieli (`backend/src/routes/globalSearch.ts`). Aici stă doar ce e nevoie ca să se
 * navigheze la înregistrare și să se citească eticheta.
 *
 * 🔴 **Lista de facturi a fost adăugată la ACHU-285 fiindcă LIPSEA**, și era cel mai des tastat
 * lucru: clientul sună și citește numărul de pe hârtie. ⚠️ Rămâne **opțională** — un backend mai
 * vechi nu o trimite, iar ecranul trebuie să meargă mai departe, nu să cadă pe `undefined.length`.
 */
export type GlobalSearchResults = {
  customers: { id: string; customerName: string }[];
  jobs: { id: string; jobId: number; service: string }[];
  payments: { id: string; paymentId: number }[];
  expenses: { id: string; supplier: string; description: string | null }[];
  invoices?: {
    id: string; invoiceNumber: string; customerNameSnapshot: string;
    /** ⚠️ **Număr**, nu șir: ruta cheamă `.toNumber()` aici, spre deosebire de lista de facturi. */
    grossAmount: number;
    status: string;
    /** Unde se poate VEDEA factura — nu există pagină proprie de facturi. */
    customerId: string; jobId: string | null;
  }[];
  /**
   * ─── §22 (Sesiunea 148) — cele cinci entități noi ─────────────────────────────────────────
   *
   * ⚠️ **Opționale în tip, ca facturile**, și pentru același motiv: un browser care ține un pachet
   * de dinaintea feliei ar citi `undefined` — iar ecranul trebuie să nu se strice pe el, nu să
   * arate un rând gol.
   *
   * 🔴 **Ce NU e în tipul casei: nota de acces și codul porții.** Nu din uitare — ruta nici nu le
   * trimite (`routes/globalSearch.ts`), fiindcă ele cer Admin fără înlocuitori (ACHU-740). Tipul e
   * a doua barieră: cine ar vrea să le afișeze aici n-ar avea de unde.
   */
  cleaners?: { id: string; cleanerId: number; cleanerName: string; active: boolean }[];
  properties?: {
    id: string; propertyId: number; label: string; address: string | null; postcode: string | null;
    customerId: string; customerName: string;
  }[];
  incidents?: {
    id: string; incidentId: number; kind: string; severity: string; status: string;
    occurredOn: string; customerName: string; cleanerName: string;
  }[];
  complaints?: {
    id: string; customerRequestId: number; status: string; complaintCategory: string | null;
    createdAt: string; customerId: string; customerName: string;
  }[];
  documents?: {
    id: string; cleanerDocumentId: number; kind: string; label: string | null; status: string;
    expiryDate: string | null; cleanerId: string; cleanerName: string;
  }[];
};

export function globalSearch(params: { query: string }) {
  return apiGet<GlobalSearchResults>('/global-search', params);
}

// ─── Istoricul de audit ─────────────────────────────────────────────

/**
 * Un rând din istoric.
 *
 * 🔴 **Cele trei câmpuri de dedesubt sunt ȘIRURI, nu obiecte** — coloanele sunt `String?` cu JSON
 * serializat înăuntru (`schema.prisma`, `AuditEvent`), nu `Json`. ⚠️ De aceea ecranul le trece
 * prin `JSON.parse` cu `try/catch`, și de aceea tipul spune `string`: un `unknown` ar fi lăsat pe
 * următorul să creadă că poate citi direct o cheie din ele.
 */
export type AuditEventRow = {
  id: string;
  auditEventId: number;
  entityType: string;
  entityId: string;
  action: string;
  performedBy: string | null;
  timestamp: string;
  summary: string | null;
  previousValues: string | null;
  newValues: string | null;
  /** De ce s-a corectat ceva. Cerut la stingerea unei plăți sau a unei cheltuieli. */
  correctionNotes: string | null;
  metadata: string | null;
  /**
   * 🔴 §39 „Source" (Sesiunea 150) — cum a ajuns rândul aici: `ui` | `api` | `system`.
   *
   * ⛔ **Nu e o dovadă**, ci un indiciu de triaj: antetele pe care se sprijină clasificarea pot fi
   * scrise de mână de oricine are un token (motivul întreg: `backend/src/lib/auditSource.ts`).
   * ⚠️ `null` pe rândurile scrise înainte de 22/08/2026 — „nu se știe", nu ghicit.
   */
  source: string | null;
};

/**
 * ⚠️ `entityTypes` și `actions` sunt **listele de filtrare**, trimise odată cu rezultatele ca
 * ecranul să nu-și scrie a doua copie a lor — aceeași idee ca la listele de politică din GDPR.
 */
export type AuditHistoryResponse = {
  events: AuditEventRow[];
  hasMore: boolean;
  total: number;
  entityTypes: string[];
  actions: string[];
};

// ─── Setările financiare ────────────────────────────────────────────

/**
 * Rezervele pe care firma le pune deoparte, plus anul fiscal.
 *
 * 🔴 **Procentele sunt FRACȚII (0–1), nu procente** — `0.225` înseamnă 22.5%. ⚠️ Coloanele
 * `Decimal` sosesc ca **șiruri** prin `...rând`, iar ruta adaugă pe lângă ele câte un câmp
 * **numeric** cu alt nume (`taxReserve` etc.). Ambele sunt în răspuns; ecranul îl citește pe cel
 * numeric. ⛔ Nu le amesteca: unul e text, celălalt e număr.
 */
export type FinancialSettingsRecord = {
  id: string;
  financialSettingsId: number;
  /** Fracție, `null` cât timp nu s-a completat. Perechea „…Percent" e aceeași valoare, ca șir. */
  taxReserve: number | null;
  nationalInsuranceReserve: number | null;
  emergencyReserve: number | null;
  taxReservePercent: string | null;
  nationalInsuranceReservePercent: string | null;
  emergencyReservePercent: string | null;
  /** `YYYY-MM-DD`, tăiate de rută. */
  taxYearStart: string | null;
  taxYearEnd: string | null;
  /** `Manual` sau automat — decide dacă cele două date de mai sus se mai citesc. */
  taxYearMode: string | null;
  notes: string | null;
  active: boolean;
  settingsKey: string | null;
  createdAt: string;
};

export function getFinancialSettings(_params: Record<string, never> = {}) {
  return apiGet<{
    /** `null` când nu s-a salvat niciodată nimic — ecranul arată atunci formularul gol. */
    settings: FinancialSettingsRecord | null;
    /** Rândurile istorice, cel mult 100. ⚠️ Pot conține `null`, ca `settings`. */
    all: (FinancialSettingsRecord | null)[];
    /** Anul fiscal rezolvat din mod + date. Lipsește când nu există niciun rând salvat. */
    resolvedTaxYear?: { start: string; end: string };
  }>('/financial-settings');
}

/**
 * ⚠️ **Două forme ale aceluiași avertisment, și amândouă sunt reale:** salvarea poate atinge mai
 * multe rânduri, deci `auditWarnings` e lista, iar `auditWarning` e aceeași listă lipită într-o
 * propoziție pentru ecranele care arată una singură.
 */
export function saveFinancialSettings(data: Record<string, unknown>) {
  return apiPost<{ success: true; id: string; auditWarning?: string; auditWarnings?: string[] }>(
    '/financial-settings/save', data,
  );
}

// ─── Ștergerea unei înregistrări ────────────────────────────────────

/**
 * ⛔ **Doar patru tabele**, și asta e toată garda: ruta refuză orice altceva. ⚠️ Ștergerea e
 * REALĂ — plățile și cheltuielile se **sting** din ecranele lor, nu se șterg de aici.
 */
export function deleteRecord(params: { table: 'customers' | 'jobs' | 'payments' | 'expenses'; id: string }) {
  return apiPost<{ success: true; auditWarning?: string }>('/delete-record', params);
}

