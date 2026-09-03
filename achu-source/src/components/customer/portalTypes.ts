/**
 * ACHU-401 (Sesiunea 119, felia 7) — formele pe care le citește PORTALUL CLIENTULUI,
 * în locul lui `any`.
 *
 * ⛔ **`src/lib/endpoints.ts` rămâne `any` deliberat** și nu e ținta (antetul lui explică de ce).
 * Metoda e cea din feliile 4–6: fiecare ecran primește un tip **îngust**, care numește doar
 * câmpurile pe care le randează, **citit din ruta care îl produce** — nu ghicit din numele
 * câmpului. Aici sursa e una singură pentru toate: `backend/src/lib/customerPortalAggregation.ts`
 * (`enrichJob`, `jobsSections`, `financialSummary`) plus `backend/src/routes/customerPortal.ts`.
 *
 * 🔴 **De ce un fișier comun și nu un tip per componentă:** cele opt ecrane ale portalului
 * primesc **același** obiect, tăiat în bucăți de `CustomerApp`. Opt copii ale aceleiași forme
 * ar fi opt locuri care rămân în urmă în ziua în care ruta adaugă un câmp — exact tiparul pentru
 * care `customerNotifications.ts` ține textele într-un singur loc.
 *
 * ⚠️ **Banii sosesc ca NUMĂR aici, nu ca string.** `enrichJob` trece fiecare sumă prin
 * `fromPence(...)`, deci ce ajunge în JSON e un `number` — spre deosebire de rutele care întorc
 * rânduri Prisma brute, unde un `Decimal` devine string. Verificat în cod, nu presupus: e chiar
 * genul de câmp pe care `tsc` l-ar fi lăsat să treacă greșit tipizat, fiindcă `Number(x)`
 * funcționează pe amândouă.
 */

/**
 * O vizită, așa cum o vede clientul. Ieșirea lui `enrichJob`
 * (`backend/src/lib/customerPortalAggregation.ts:127`).
 *
 * ⚠️ `id` **și** `jobId` sunt amândouă aici, deliberat: `id` e cheia de bază cu care se trimit
 * cererile (fără ea, „cere altă dată" nu a funcționat de la Sesiunea 42 la 95 — ACHU-435), iar
 * `jobId` e numărul pe care îl citește omul, „#41".
 */
export type PortalJob = {
  id: string;
  jobId: number;
  /** `YYYY-MM-DD` — tăiată din `toISOString()` în rută, deci fără oră. */
  jobDate: string;
  service: string;
  address: string | null;
  startTime: string | null;
  finishTime: string | null;
  status: string;
  amountCharged: number | null;
  amountPaid: number;
  outstandingBalance: number;
  /** `'—'` înseamnă „nu sunt bani în discuție", nu „necunoscut". */
  paymentStatus: string;
  customerInstructions: string | null;
  /** ACHU-513: **momentul**, nu un boolean — ecranul spune CÂND a confirmat clientul accesul. */
  accessConfirmedAt: string | null;
  /** ACHU-537: `null` explicit = „n-a notat încă", deosebit de „a notat". */
  rating: { score: number; comment: string | null; updatedAt: string } | null;
  /** Gol = nimeni asignat încă; ecranul spune asta, în loc să lase un spațiu alb. */
  cleaners: string[];
  /**
   * ACHU-556 — ce s-a mai făcut la vizită peste curățenia obișnuită, cu prețul fiecărei
   * linii. Defalcarea sumei de la `amountCharged`, nu o sumă în plus față de ea.
   *
   * ⚠️ **Opționale, deliberat**, spre deosebire de `rating`: un bundle mai vechi decât câmpul
   * trebuie să se citească la fel ca „nu au fost extrase", nu să pice pe `.length`.
   */
  serviceExtras?: { id: string; description: string; price: number }[];
  extrasTotal?: number;
};

/**
 * Contractul recurent — `recurringContractsSection`
 * (`backend/src/lib/customerPortalAggregation.ts:400`).
 *
 * ⛔ **Nu are `generateUntil`**, deliberat, și nu se adaugă: e o cifră internă („cât de departe a
 * generat biroul vizitele"), pe care un client ar citi-o ca „aici mi se termină contractul".
 */
export type PortalContract = {
  id: string;
  /** Propoziția compusă de `describeRule` — aceeași pe care o citește și biroul. */
  description: string;
  service: string;
  startTime: string | null;
  finishTime: string | null;
  amountCharged: number | null;
  status: string;
};

/**
 * Un termen preplătit peste un contract (ACHU-240) — `subscriptionsSection`.
 *
 * ⚠️ **Se identifică prin `reference` („#12"), NU printr-un `id`** — ruta nu trimite cheia de
 * bază, fiindcă nimic din portal nu acționează asupra unui termen. Tipul spune asta explicit,
 * ca următoarea felie să nu scrie `sub.id` și să obțină `undefined` la execuție — exact felul de
 * greșeală care a ținut „cere altă dată" nefuncțională trei sesiuni (ACHU-435).
 */
export type PortalSubscription = {
  reference: string;
  service: string;
  status: string;
  startDate: string;
  endDate: string;
  termMonths: number;
  visitsIncluded: number;
  pricePerVisit: number;
  fullPricePerVisit: number;
  discountPercent: number;
  paidTotal: number;
  paidOn: string | null;
  /** Doar pe un termen anulat; suma, fără motivul intern tastat de birou. */
  refundAmount: number | null;
  refundExplanation: string | null;
};

/**
 * Fișa clientului, exact cât trimite ruta (`customerPortal.ts:77`).
 *
 * ⛔ **Fără `id`** — ruta nu îl trimite, fiindcă fiecare cerere e re-limitată pe server la
 * clientul autentificat. ⛔ **Fără `propertyNotes`**: acelea sunt pe VIZITĂ, nu pe client
 * (`getJobPropertyInfo`), iar confuzia dintre cele două e chiar distincția pe care o face
 * ACHU-239 în comentariul din rută.
 */
export type PortalCustomer = {
  customerName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postcode: string | null;
  customerType: string | null;
  status: string;
  /**
   * 🔴 **ACHU-576: instrucțiunile de acces NU mai sunt aici.** S-au mutat pe CASĂ — un singur
   * text pentru toate casele cuiva era greșit pentru cel puțin una. Se citesc și se scriu prin
   * `getMyProperties` / `updateMyPropertyAccess` (`PropertyAccess.tsx`).
   */
  /**
   * ACHU-549 — nota scrisă de BIROU pentru acest client. ⛔ **Nu** e `notes`: acela e
   * câmpul intern al biroului și nu părăsește serverul (ACHU-222).
   */
  customerVisibleNote: string | null;
  /**
   * ACHU-558 — cum vrea să fie contactat, plus listele și propozitia despre ce poate onora
   * aplicația. ⚠️ **Opțional**: un backend mai vechi decât câmpul nu-l trimite, iar ecranul
   * trebuie doar să nu randeze secțiunea, nu să cadă.
   */
  contactPreference?: {
    preferredContactMethod: string | null;
    preferredContactWindow: string | null;
    contactPreferenceNote: string | null;
    expectation: string;
    methods: { value: string; label: string }[];
    windows: { value: string; label: string }[];
    noteMax: number;
  };
};

/** Totalurile din `financialSummary` — toate `number`, toate trecute prin `fromPence`. */
export type PortalFinancialSummary = {
  totalJobValue: number;
  totalPaymentsReceived: number;
  totalRefunds: number;
  netAmountPaid: number;
  outstandingBalance: number;
};

/**
 * O factură, așa cum o vede clientul — `invoicesSection`
 * (`backend/src/lib/customerPortalAggregation.ts:274`).
 *
 * ⚠️ **Câmpurile `…Snapshot` sunt înghețate la emitere**, deliberat: ele descriu ce s-a VÂNDUT
 * și nu au voie să se schimbe după. `paymentStatus` e opusul — se calculează **live** din plăți,
 * fiindcă „dacă s-a plătit între timp" e chiar felul de fapt care trebuie să se schimbe.
 *
 * ⚠️ **Facturile anulate SUNT în listă**, marcate ca atare: ascunse, un client care a păstrat
 * emailul ar ține în mână un document pe care portalul îl neagă.
 */
export type PortalInvoice = {
  invoiceNumber: string;
  issuedAt: string;
  dueDate: string | null;
  description: string | null;
  netAmount: number;
  vatRatePercent: number | null;
  vatAmount: number;
  grossAmount: number;
  status: string;
  customerNameSnapshot: string | null;
  customerAddressSnapshot: string | null;
  businessNameSnapshot: string | null;
  /** §51 — numele comercial din clipa emiterii; `null` pe facturile de dinainte. */
  tradingNameSnapshot: string | null;
  businessAddressSnapshot: string | null;
  companyRegNumberSnapshot: string | null;
  vatNumberSnapshot: string | null;
  /** `null` pe o factură anulată sau fără bani în discuție — vezi ACHU-424. */
  paymentStatus: string | null;
};

/** O linie dintr-o ofertă. `lineItems` e o coloană JSON, deci fiecare câmp poate lipsi. */
export type PortalQuoteLine = {
  label?: string | null;
  field?: string | null;
  quantity?: number | null;
  price?: number | null;
};

/**
 * O ofertă — `quotesSection`. Doar cele `Final` ajung aici: un `Draft` e o cifră pe care biroul
 * încă o ajustează, iar un preț care apoi se schimbă e mai rău decât niciun preț.
 */
export type PortalQuote = {
  id: string;
  quoteNumber: string;
  createdAt: string;
  status: string;
  /** Coloană JSON în bază — de aici `unknown` la citire și verificarea `Array.isArray`. */
  lineItems: PortalQuoteLine[] | unknown;
  totalMinutes: number | null;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  grandTotal: number;
  /**
   * §6 „Optional extras" (Sesiunea 160) — de la cât pornește oferta și ce poate adăuga clientul.
   * ⚠️ Împărțirea o face SERVERUL (`lib/quoteOptionalExtras.ts`); pagina nu calculează niciun preț.
   * ⛔ Opțional: un pachet vechi, dinaintea coloanei, nu are voie să strice ecranul.
   */
  split?: { baseTotal: number; extras: { field: string; label: string; price: number }[]; fullTotal: number };
  acceptedExtras?: string[];
  acceptedTotal?: number | null;
  /**
   * §6 „Multiple quote options" (Sesiunea 160) — oferta e o variantă dintr-un set din care se alege
   * UNA. ⚠️ `optionChosen` = numărul variantei deja luate, oricare ar fi ea; `null` = niciuna.
   */
  optionGroupId?: string | null;
  optionLabel?: string | null;
  optionChosen?: string | null;
  /** Răspunsul CLIENTULUI: `null` = încă nu a ales, deci ecranul arată butoanele. */
  customerResponse: string | null;
  customerRespondedAt: string | null;
  /**
   * ACHU-562 — până când ține prețul. **7 zile de la emitere** (decizia lui Roberto, 13/08/2026).
   *
   * 🔴 **`label` vine de la SERVER și se afișează ca atare.** Ecranul nu compune nicio
   * propoziție despre expirare — aceeași ofertă e citită în portal, pe PDF și în birou, iar
   * trei texte scrise separat ar ajunge să spună trei lucruri.
   *
   * ⛔ **`expired` NU ascunde butoanele de răspuns**: expirarea avertizează, nu refuză
   * (`backend/src/lib/quoteExpiryPolicy.ts`). Un client care vrea să cumpere în ziua a opta
   * trebuie să poată apăsa, iar biroul decide.
   *
   * ⚠️ Opțional în tip: un portal deschis pe o filă veche poate încă să nu-l aibă.
   */
  expiry?: {
    status: 'answered' | 'expired' | 'expiring' | 'valid';
    expiresOn: string;
    daysLeft: number;
    label: string;
  } | null;
};

/**
 * Nota de confidențialitate — `GET /customer-portal/privacy` (ACHU-545).
 *
 * ⛔ **Tot textul vine de la server**, inclusiv titlurile. Ecranul nu compune nicio
 * propoziție: partea de retenție e **derivată** din politica de ștergere care rulează
 * (`backend/src/lib/privacyNoticeContent.ts` peste `gdprAnonymisePolicy.ts`), deci o
 * categorie nouă de date ajunge pe ecran fără ca cineva să editeze componenta — și nu
 * poate ajunge pe jumătate descrisă, fiindcă testul de acoperire pică înainte.
 *
 * ⚠️ Câmpurile lui `controller` sunt `null` cât timp Invoice Settings nu e completat
 * (§5.1 — acțiunea lui Roberto). Ecranul **sare rândul**; nu inventează un text.
 */
export type PortalPrivacySection = {
  key: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type PortalRetentionGroup = {
  /** `erased` · `deleted` · `kept` · `reviewed` — vine din politică, nu din ecran. */
  outcome: string;
  heading: string;
  intro: string;
  /** `model` e cheia din politică; se folosește ca `key` de randare, nu se afișează. */
  items: { model: string; text: string }[];
};

export type PortalPrivacyNotice = {
  controller: {
    legalName: string | null;
    address: string | null;
    companyRegistrationNumber: string | null;
    phone: string | null;
    /** Singurul care nu vine din setări, deci singurul garantat prezent. */
    email: string;
  };
  sections: PortalPrivacySection[];
  retention: {
    heading: string;
    summary: string[];
    groups: PortalRetentionGroup[];
  };
};

/**
 * O cerere trimisă de client, cu răspunsul biroului — `requestsSection`.
 *
 * ⚠️ **Rămâne în listă și după închidere**, deliberat: un client care a cerut mutarea unei vizite
 * și a fost refuzat trebuie să vadă că a fost **răspuns**, altfel cere din nou sau presupune că a
 * fost ignorat.
 */
export type PortalRequest = {
  customerRequestId: number;
  kind: string;
  status: string;
  message: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  adminResponse: string | null;
  createdAt: string;
  resolvedAt: string | null;
  /** Cheia vizitei la care se referă, sau `null` pentru o cerere generală. */
  jobId: string | null;
};

