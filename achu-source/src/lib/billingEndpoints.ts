/**
 * ACHU-401, felia a douăzecea — CE COSTĂ ȘI CE SE FACTUREAZĂ: calculatorul de preț, ofertele,
 * facturile și setările de facturare.
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `endpoints.ts`** (`AGENT_RULES` §7), reexportat de
 * acolo — deci **niciun apelant nu se schimbă**.
 *
 * 🔴 **De ce zona ASTA se poate scrie cap-coadă, deși `endpoints.ts` rămâne `any` prin
 * proiectare:** cele patru rute nu inventează nimic. Calculul vine dintr-o funcție **pură** de
 * pe server (`backend/src/lib/priceCalculator.ts`), care își publică deja forma; ratele vin din
 * `RateRow`; valabilitatea, din `quoteExpiryPolicy.ts`. Iar `PriceQuote`, `Invoice` și
 * `InvoiceSettings` sunt modele **mici** (20–26 de coloane), deci rândul se poate scrie
 * **întreg**, nu ca subset — verificat în `schema.prisma`, nu presupus din ecran.
 *
 * ⚠️ **BANII SOSESC CA ȘIRURI, nu ca numere.** O coloană `Decimal` împrăștiată prin `...rând`
 * se serializează în JSON ca **string** — spre deosebire de vizite, plăți și cheltuieli, unde
 * ruta cheamă explicit `.toNumber()`. Tipurile de mai jos spun asta pe fiecare câmp, tocmai ca
 * `Number(...)` din ecrane să nu mai arate redundant celui care le citește data viitoare.
 * ⛔ Aritmetică directă pe ele ar concatena, nu ar aduna.
 */
import { apiGet, apiPost } from './apiClient';

/** Un rând din calculul unei oferte. Oglindește `LineItem` din `backend/src/lib/priceCalculator.ts`. */
export type PriceQuoteLineItem = {
  field: string;
  group: string;
  label: string;
  quantity: number;
  minutesEach: number;
  totalMinutes: number;
  price: number;
};

/**
 * Rezultatul calculului. ⚠️ Aici banii sunt **numere**: vin dintr-o funcție pură, nu dintr-o
 * coloană `Decimal`.
 */
export type PriceQuoteCalculation = {
  lineItems: PriceQuoteLineItem[];
  /** §6 (Sesiunea 160) — pozițiile de ales, curățate de server de cheile care nu ajung în ofertă. */
  optionalFields?: string[];
  /**
   * §6 (Sesiunea 160) — de la cât pornește și ce poate adăuga clientul, **calculată de server**.
   * ⛔ Pagina nu o compune: portalul, hârtia și biroul trebuie să citească un singur număr.
   */
  split?: { baseTotal: number; extras: { field: string; label: string; price: number }[]; fullTotal: number };

  totalMinutes: number;
  subtotal: number;
  discountAmount: number;
  grandTotal: number;
  /**
   * 🔴 Câmpuri cu o cantitate pozitivă dar **fără tarif configurat**. Trimise separat tocmai ca
   * ecranul să poată avertiza, în loc să le treacă tăcut la 0 £.
   */
  unpriced: string[];
};

/** Ce întoarce calculul, înainte de a fi salvat ceva. */
export type PriceQuoteCalculated = PriceQuoteCalculation & {
  customerId: string | null;
  jobId: string | null;
  quoteNumber: string;
};

/** Ce întoarce salvarea sau editarea: același calcul, plus rândul creat. */
export type PriceQuoteSaved = PriceQuoteCalculation & {
  success: true;
  id: string;
  quoteNumber: string;
  auditWarning?: string;
};

/**
 * Starea unei oferte față de propria valabilitate (7 zile), calculată pe SERVER — ca nicio
 * pagină să nu inventeze altă propoziție. Oglindește `QuoteExpiry` din `quoteExpiryPolicy.ts`.
 *
 * ⛔ **Doar informează:** nicio rută nu refuză o operație pe o ofertă expirată.
 */
export type QuoteExpiry = {
  status: 'answered' | 'expired' | 'expiring' | 'valid';
  /** `YYYY-MM-DD`, ultima zi valabilă inclusiv. */
  expiresOn: string;
  /** `0` = expiră azi; negativ după expirare. */
  daysLeft: number;
  /** ⚠️ Gol când oferta a primit deja un răspuns — atunci nu mai e nimic de spus despre timp. */
  label: string;
};

/**
 * O ofertă salvată — rândul `PriceQuote` ÎNTREG, plus cele trei câmpuri pe care le compune ruta
 * de listă (`backend/src/routes/priceQuotes.ts`).
 */
export type PriceQuoteRecord = {
  id: string;
  /** Numărul intern al rândului; `quoteNumber` e cel văzut de client. */
  priceQuoteId: number;
  quoteNumber: string;
  /** `null` când oferta a fost introdusă de mână, nu pornind de la o vizită. */
  customerId: string | null;
  jobId: string | null;
  /** ⚠️ `Decimal` → **string**. */
  discountPercent: string;
  lineItems: PriceQuoteLineItem[];
  totalMinutes: number;
  subtotal: string;
  discountAmount: string;
  grandTotal: string;
  /**
   * §6 „Optional extras" (Sesiunea 160) — pozițiile pe care clientul le poate lua sau nu, și ce a
   * bifat. ⚠️ `grandTotal` rămâne „tot, dacă le ia pe toate"; `acceptedTotal` e suma la care a spus
   * „da", înghețată atunci — nu se recalculează la fiecare citire.
   */
  optionalFields?: string[];
  acceptedExtras?: string[];
  acceptedTotal?: string | null;
  /**
   * §6 „Multiple quote options" (Sesiunea 160) — variantele aceleiași lucrări, din care omul alege
   * UNA. ⚠️ `null` = ofertă de sine stătătoare, adică toate cele de dinaintea coloanei.
   */
  optionGroupId?: string | null;
  optionLabel?: string | null;
  /**
   * §6 (Sesiunea 160) — de la cât pornește și ce poate adăuga clientul, **calculată de server**.
   * ⛔ Pagina nu o compune: portalul, hârtia și biroul trebuie să citească un singur număr.
   */
  split?: { baseTotal: number; extras: { field: string; label: string; price: number }[]; fullTotal: number };

  /** `Draft` | `Final`. ⛔ O ofertă `Final` nu se mai editează (ACHU-190). */
  status: string;
  /** Ce a răspuns clientul din portal. `null` = nu a răspuns încă. */
  customerResponse: string | null;
  customerResponseNote: string | null;
  customerRespondedAt: string | null;
  /**
   * §6 „Viewed" (Sesiunea 160) — când a deschis clientul oferta în portal, PRIMA dată.
   *
   * ⛔ `null` are DOUĂ înțelesuri, și ecranul nu are voie să le confunde: „nu a deschis-o" pe o
   * ofertă de după Sesiunea 160, dar „nu se știe" pe una de dinainte — atunci nu se scria nimic.
   */
  customerViewedAt?: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  /** Compuse de ruta de LISTĂ, deci opționale pe răspunsul unei singure oferte. */
  customerName?: string | null;
  /** Numărul VIZIBIL al vizitei, rezolvat pe server din `jobId`. */
  jobDisplayId?: number | null;
  /** ACHU-562 — vezi `QuoteExpiry`. Opțional: un backend mai vechi nu-l poartă. */
  expiry?: QuoteExpiry | null;
};

/**
 * Un tarif din calculator — un rând pe fiecare câmp cunoscut, în ordinea din `PRICE_FIELDS`.
 * Oglindește `RateRow` din `backend/src/lib/priceCalculatorRates.ts`.
 *
 * 🔴 **Astea SUNT prețurile:** schimbă minutele sau tariful orar și fiecare ofertă emisă după
 * aceea iese diferită. ⚠️ `0` înseamnă **netarifat**, nu gratis — câmpul apare atunci în
 * `unpriced` la calcul.
 */
export type PriceRateRow = {
  field: string;
  group: string;
  label: string;
  minutesPerUnit: number;
  hourlyRate: number;
};

/**
 * O factură — rândul `Invoice` ÎNTREG, plus cele două numere vizibile compuse de ruta de listă.
 *
 * ⚠️ **Instantaneele (`…Snapshot`) sunt deliberate:** o factură e un DOCUMENT, deci nu are voie
 * să se schimbe când clientul își editează adresa mai târziu.
 */
export type InvoiceRecord = {
  id: string;
  invoiceRecordId: number;
  /** Numărul de pe document. ⛔ Rezervat pe veci: o factură anulată **nu** își eliberează numărul. */
  invoiceNumber: string;
  jobId: string | null;
  /** ACHU-251 — un termen de abonament se facturează ca UN document, nu unul pe vizită. */
  subscriptionId: string | null;
  customerId: string;
  customerNameSnapshot: string;
  customerAddressSnapshot: string | null;
  businessNameSnapshot: string | null;
  /** §51 — numele comercial din clipa emiterii. `null` pe facturile de dinaintea Sesiunii 160, și pe orice firmă care lucrează sub numele ei înregistrat. */
  tradingNameSnapshot: string | null;
  businessAddressSnapshot: string | null;
  companyRegNumberSnapshot: string | null;
  vatNumberSnapshot: string | null;
  description: string;
  /** ⚠️ Toate patru: `Decimal` → **string**. Citite prin `Number(...)`. */
  netAmount: string;
  vatRatePercent: string | null;
  vatAmount: string;
  grossAmount: string;
  /** `Issued` | `Void`. ⛔ **„Paid" nu se stochează niciodată aici** — se citește din plățile reale ale vizitei. */
  status: string;
  issuedAt: string;
  dueDate: string | null;
  issuedBy: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  /** Compuse de ruta de LISTĂ, deci opționale pe răspunsul unei singure facturi. */
  jobDisplayId?: number | null;
  /** ⚠️ Câmp propriu, nu `jobDisplayId` reutilizat: „#1" fără să știi dacă e vizită sau termen e mai rău decât gol. */
  subscriptionDisplayId?: number | null;
};

/**
 * Identitatea firmei și termenele scrise pe documente.
 *
 * ⚠️ **Ruta întoarce sau rândul salvat, sau un set de valori implicite** când nimeni n-a
 * completat nimic încă — de aceea `updatedAt` poate fi `null` aici, deși coloana nu e opțională.
 * ⛔ Câmpurile de la ACHU-420 sunt toate opționale deliberat: un document generat cu unul gol
 * trebuie **să spună** asta, nu să tipărească un gol tăcut acolo unde ar trebui asigurătorul.
 */
export type InvoiceSettingsRecord = {
  id: string;
  businessLegalName: string | null;
  /** §51 — numele sub care firma LUCREAZĂ, când e altul decât cel înregistrat. ⛔ Îl însoțește pe cel legal, nu îl înlocuiește. */
  tradingName: string | null;
  businessAddress: string | null;
  companyRegistrationNumber: string | null;
  vatRegistered: boolean;
  vatNumber: string | null;
  /** ⚠️ `Decimal` → **string** pe rândul salvat; `null` cât timp nu s-a completat. */
  vatRatePercent: string | null;
  invoiceNumberPrefix: string;
  /** 🔴 Contorul critic pentru conformitate: se incrementează în tranzacție, nu se reutilizează, nu se resetează. */
  nextInvoiceNumber: number;
  /** Zile de la emitere până la scadență, fotografiate pe fiecare factură la emitere. */
  paymentTermsDays: number;
  businessPhone: string | null;
  insurerName: string | null;
  insurancePolicyNumber: string | null;
  insuranceCoverAmount: string | null;
  /** Ore, nu zile — „24 de ore" și „o zi" coincid doar dacă nimeni nu anulează seara pentru dimineață. */
  cancellationNoticeHours: number | null;
  lateCancellationCharge: string | null;
  /** ⚠️ Alt eveniment decât o anulare, și cu alt preț: drumul și slotul pierdut s-au întâmplat deja. */
  noAccessCharge: string | null;
  complaintWindowDays: number | null;
  googleReviewUrl: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

// ─── Calculatorul de preț ───────────────────────────────────────────

export function calculatePriceQuote(data: Record<string, unknown>) {
  return apiPost<PriceQuoteCalculated>('/price-quotes/calculate', data);
}

export function savePriceQuote(data: Record<string, unknown>) {
  return apiPost<PriceQuoteSaved>('/price-quotes', data);
}

export function getPriceQuotes(params: { customerId?: string; jobId?: string } = {}) {
  return apiGet<{ records: PriceQuoteRecord[] }>('/price-quotes', params);
}

/** ⚠️ `quote: null` când nu există — un 200, nu o eroare. */
export function getPriceQuote(params: { id: string }) {
  return apiGet<{
    quote: PriceQuoteRecord | null;
    customer: { customerName: string; address: string | null; email: string | null; phone: string | null } | null;
  }>(`/price-quotes/${params.id}`);
}

export function getPriceCalculatorRates() {
  // 🔴 ACHU-717 — o revizie peste TOT setul de rate: ecranul postează fiecare rată la fiecare Save.
  return apiGet<{ rates: PriceRateRow[]; _revision: string }>('/price-calculator-rates');
}

export function savePriceCalculatorRates(data: {
  rates: Array<{ field: string; minutesPerUnit: number; hourlyRate: number }>;
  _revision: string;
}) {
  return apiPost<{ success: true; rates: PriceRateRow[]; _revision: string; auditWarning?: string }>('/price-calculator-rates/save', data);
}

export function editPriceQuote(id: string, data: Record<string, unknown>) {
  return apiPost<PriceQuoteSaved>(`/price-quotes/${id}/edit`, data);
}

/**
 * ⚠️ `Final` e ce mută banii pe vizită: serverul scrie într-o singură tranzacție `amountCharged`
 * și `quoteNumber`, și duce `Enquiry` → `Confirmed`. De aceea răspunsul spune și dacă vizita a
 * fost atinsă, plus **două** avertismente de audit separate.
 */
/**
 * §6 „Multiple quote options" (Sesiunea 160) — leagă câteva oferte într-o alegere.
 *
 * ⛔ Nu creează nimic: ofertele există deja, fiecare cu numărul ei. Se scrie doar legătura.
 */
export function groupQuotesAsOptions(quoteIds: string[], labels?: string[]) {
  return apiPost<{ success: true; optionGroupId: string; auditWarning?: string }>(
    '/price-quotes/option-set', { quoteIds, ...(labels ? { labels } : {}) },
  );
}

/** Desface setul. ⚠️ Rută separată: „leagă" și „dezleagă" nu au aceleași reguli. */
export function ungroupQuoteOptions(optionGroupId: string) {
  return apiPost<{ success: true; count: number; auditWarning?: string }>(
    '/price-quotes/option-set/clear', { optionGroupId },
  );
}

export function setPriceQuoteStatus(id: string, status: 'Draft' | 'Final') {
  return apiPost<{
    success: true; status: string; jobUpdated: boolean;
    auditWarning?: string; jobAuditWarning?: string;
  }>(`/price-quotes/${id}/status`, { status });
}

// ─── Facturare ──────────────────────────────────────────────────────

/**
 * ACHU-251 — exact una dintre `jobId` și `subscriptionId`. Un termen se facturează ca un singur
 * document pentru tot termenul, nu o factură pe vizită.
 */
export function issueInvoice(data: { jobId?: string; subscriptionId?: string; description?: string }) {
  return apiPost<{ success: true; invoice: InvoiceRecord; auditWarning?: string }>('/invoices', data);
}

/**
 * 🔴 ACHU-591 — `total` și `listNote` vin de la server: lista e plafonată la `LIST_CAP`, iar cifra
 * de lângă ea se numără în Postgres, nu din pagina încărcată (`backend/src/lib/listCap.ts`).
 */
export function getInvoices(params: { jobId?: string; subscriptionId?: string; customerId?: string } = {}) {
  return apiGet<{ records: InvoiceRecord[]; total: number; listNote: string | null }>('/invoices', params);
}

/** ⚠️ `invoice: null` când nu există — un 200, nu o eroare. */
export function getInvoice(params: { id: string }) {
  return apiGet<{ invoice: InvoiceRecord | null }>(`/invoices/${params.id}`);
}

export function voidInvoice(id: string) {
  return apiPost<{ success: true; invoice: InvoiceRecord; auditWarning?: string }>(`/invoices/${id}/void`, {});
}

export function getInvoiceSettings() {
  // 🔴 ACHU-716 — revizia vine cu setările și se întoarce cu salvarea; fără ea ruta refuză.
  return apiGet<{ settings: InvoiceSettingsRecord; _revision: string }>('/invoice-settings');
}

export function saveInvoiceSettings(data: Record<string, unknown>) {
  return apiPost<{ success: true; settings: InvoiceSettingsRecord; _revision: string; auditWarning?: string }>('/invoice-settings/save', data);
}

