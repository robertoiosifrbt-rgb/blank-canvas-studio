/**
 * ACHU-401, felia a șaisprezecea — RAPORTUL DE PROFITABILITATE: apelul, plus forma răspunsului.
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `endpoints.ts`** (`AGENT_RULES` §7).
 *
 * 🔴 **De ce merita tipizat, deși e mare:** ecranul citește raportul **câmp cu câmp** și scrie
 * cifre de bani pe baza lui. Aici o formă greșită nu produce un `undefined` vizibil, ci un
 * **număr greșit care arată corect** — cel mai scump fel de defect din tot fișierul.
 *
 * ⚠️ Fiecare câmp e citit din `backend/src/routes/profitability.ts` și din tipurile din
 * `backend/src/lib/profitabilityPolicy.ts` (de acolo vin nulabilitățile), nu ghicit din ecran.
 */
// §24 (Sesiunea 153) — `apiDownloadPost` pentru exportul creanțelor: POST, ca rolul „doar citire" să nu-l poată cere.
import { apiGet, apiDownloadPost } from './apiClient';

/** ⚠️ `null` când venitul e 0 — **nu** 0%: nu se poate calcula o marjă fără numitor. */
type MarginPercent = number | null;

/** O linie de grup (pe client, pe serviciu, pe zonă, pe curățător). */
export type ProfitabilityGroup = {
  key: string;
  label: string;
  jobCount: number;
  revenue: number;
  directCost: number;
  labourCost: number;
  contribution: number;
  contributionMarginPercent: MarginPercent;
  /** Câte dintre vizitele grupului au ore înregistrate — restul au costul manoperei LIPSĂ. */
  jobsWithLabourRecorded: number;
};

export type ProfitabilityJob = {
  id: string;
  /** Numărul vizibil al vizitei, nu cuid-ul. */
  reference: number;
  date: string;
  status: string;
  service: string | null;
  customerId: string;
  customerName: string;
  postcode: string | null;
  cleanerNames: string[];
  isRecurring: boolean;
  /** `null` = nu s-a trecut niciun preț. ⛔ Nu e „gratis" — e o problemă de date. */
  charged: number | null;
  netCollected: number;
  revenue: number;
  directCost: number;
  labourCost: number;
  materialsCost: number;
  contribution: number;
  contributionMarginPercent: MarginPercent;
  hasLabourRecorded: boolean;
};

/**
 * 🔴 **Se citește ÎNAINTE de cifre.** E pus primul în răspuns, și numit așa, ca nimeni să nu poată
 * pretinde credibil că nu l-a văzut: dacă manopera lipsește de pe jumătate din vizite, marjele de
 * mai jos sunt optimiste, iar raportul nu are cum să știe cu cât.
 */
export type LabourCoverage = {
  jobsWithLabour: number;
  totalJobs: number;
  percent: number;
  caveat: string;
  /** De unde a venit manopera: pontaj, cheltuieli, sau amândouă. */
  jobsFromTimesheet: number;
  jobsFromExpenses: number;
  jobsWithBothSources: number;
  /** Ore lucrate care nu au un cost în spate — deci nu intră în nicio marjă. */
  jobsWithUncostedHours: number;
  /** Non-null doar când există ceva concret de reparat. */
  dataWarning: string | null;
  /** Timpul plătit care nu ține de o vizită (drum, instruire, așteptare) — necontabilizat nicăieri. */
  excludedFromJobs: string;
};

export type ProfitabilityResponse = {
  period: { from: string; to: string; days: number };
  labourCoverage: LabourCoverage;
  totals: {
    jobCount: number;
    revenue: number;
    directCost: number;
    labourCost: number;
    materialsCost: number;
    contribution: number;
    contributionMarginPercent: MarginPercent;
    /** Contribuția minus regia. ⛔ Nu se numește „profit", și deliberat: manopera poate lipsi. */
    afterOverheads: number;
    /**
     * Ce a intrat efectiv PE ACESTE VIZITE. ⚠️ ACHU-711 — banii de pe abonamente **nu** sunt
     * aici, sunt în `subscriptionMoney`. ⛔ Nu-i aduna fără să citești nota de acolo.
     */
    netCollected: number;
  };
  /**
   * 🔴 ACHU-711 — banii pe TERMENE de abonament, care nu atârnă de nicio vizită. ⚠️ Perioada e
   * după **data plății**, nu după data vizitei ca restul raportului. ⛔ NU intră în marje.
   */
  subscriptionMoney: { received: number; refunded: number; net: number; note: string };
  overheads: {
    total: number;
    percentOfRevenue: number;
    byCategory: { category: string; amount: number }[];
    /** ⛔ Nu se împarte pe vizite: ar părea precis rezemându-se pe o presupunere pe care n-a făcut-o nimeni. */
    note: string;
  };
  /**
   * 🆕 §26 „Profit per labour hour" (Sesiunea 154) — cât rămâne dintr-o oră de muncă.
   *
   * 🔴 **Altă întrebare decât marja:** două vizite cu aceeași marjă nu sunt aceeași afacere dacă una
   * ține de două ori mai mult. ⛔ Doar orele **aprobate**; vizitele fără ore stau în afara
   * numitorului și se numără separat.
   */
  perLabourHour: {
    hours: number;
    contribution: number;
    /** ⛔ `null` fără ore: o împărțire la zero nu e „0 £/oră". */
    contributionPerHour: number | null;
    jobsWithHours: number;
    jobsWithoutHours: number;
    byService: Array<{
      service: string;
      jobsWithHours: number;
      hours: number;
      contribution: number;
      contributionPerHour: number | null;
    }>;
    coverageNote: string;
    notes: { whatItIs: string; notARate: string; notPerPerson: string };
  };
  /**
   * 🆕 §26 „Estimated versus actual profit" (Sesiunea 154) — a lăsat cât credeam când am dat prețul?
   * ⚠️ Estimarea vine din minutele OFERTEI FINALE (minute de muncă), nu din fereastra din program
   * (timp scurs); toate refuzurile sunt în `backend/src/lib/estimatedProfitPolicy.ts`.
   */
  estimatedVsActual: {
    jobCount: number;
    estimatedLabourCost: number;
    actualLabourCost: number;
    estimatedContribution: number;
    actualContribution: number;
    /** Negativ = a lăsat mai puțin decât la preț. */
    varianceContribution: number;
    /** ⛔ `null` când contribuția estimată e 0: procentul n-are numitor. */
    variancePercent: number | null;
    estimatedMinutes: number;
    actualMinutes: number;
    varianceMinutes: number;
    coverageNote: string;
    excluded: { noQuote: number; noTimesheetLabour: number; uncostedHours: number };
    byService: Array<{
      service: string;
      jobCount: number;
      estimatedContribution: number;
      actualContribution: number;
      varianceContribution: number;
      varianceMinutes: number;
    }>;
    worst: Array<{
      id: string;
      reference: number;
      date: string;
      service: string | null;
      customerName: string;
      estimatedMinutes: number;
      actualMinutes: number;
      varianceMinutes: number;
      estimatedContribution: number;
      actualContribution: number;
      varianceContribution: number;
    }>;
    notes: { whichEstimate: string; noInventedRate: string; notASaving: string };
  };
  breakdown: {
    byCustomer: ProfitabilityGroup[];
    byService: ProfitabilityGroup[];
    /** Grupat pe codul exterior („SW1A"): un cod poștal întreg ar produce un grup per vizită. */
    byArea: ProfitabilityGroup[];
    /**
     * 🆕 §26 (Sesiunea 154) — pe CASĂ, nu pe client: un client cu trei case poate avea una care nu
     * merită. ⛔ Vizitele fără casă legată apar ca „No property linked" — multe sunt de dinainte de
     * tabelul de case, iar banii lor sunt reali.
     */
    byProperty: ProfitabilityGroup[];
    /**
     * 🆕 §26 (Sesiunea 154) — DE UNDE a venit vizita. Sursa e a **cererii de ofertă** (singurul loc
     * în care aplicația o consemnează); ⛔ vizitele fără cerere legată apar ca
     * „No booking request linked", nu împinse în grupul cel mai mare.
     */
    byBookingSource: ProfitabilityGroup[];
    byRecurring: ProfitabilityGroup[];
    /**
     * 🆕 §26 „Profit by team" A (Sesiunea 154, hotărârea lui Roberto) — CINE A FOST ÎMPREUNĂ.
     *
     * ✅ **Fiecare vizită cade în exact un rând**, spre deosebire de `byCleaner`: deci coloanele
     * astea chiar se adună la totalul perioadei. ⚠️ `note` spune câte formații au prea puține vizite
     * ca marja lor să fie un tipar; `null` când nu e nimic de spus.
     */
    byCrew: { groups: ProfitabilityGroup[]; note: string | null };
    /**
     * 🆕 §26 „Profit by team" B (Sesiunea 154) — ECHIPA FIXĂ de pe fișa fiecărui om.
     *
     * ⚠️ Hotărârea lui Roberto: rapoartele vechi se recitesc pe echipa de **ACUM**, deci mutarea
     * unui om schimbă și luna trecută. 🔴 O vizită făcută de oameni din două echipe intră întreagă
     * la fiecare (ca la `byCleaner`), iar `note` spune asta cu cifra ei.
     */
    byTeam: { groups: ProfitabilityGroup[]; mixedTeamJobs: number; note: string | null };
    byCleaner: {
      groups: ProfitabilityGroup[];
      /**
       * ⚠️ Rândurile astea **nu** se adună la totalul perioadei: o vizită cu doi oameni se
       * numără întreagă la fiecare, fiindcă împărțirea ar inventa o alocare pe care n-a ales-o
       * nimeni. `note` e `null` când nu e cazul.
       */
      doubleCountedJobs: number;
      note: string | null;
    };
  };
  lowMargin: {
    thresholdPercent: number;
    jobs: ProfitabilityJob[];
    /** Numite, nu excluse tăcut — o vizită fără preț e o problemă de date. */
    jobsWithNoPrice: number;
  };
  /** Cea mai proastă marjă prima: lista se citește ca să găsești probleme. */
  jobs: ProfitabilityJob[];
  /** Cinstit despre trunchiere, în loc să întoarcă tăcut o listă parțială. `0` = nimic tăiat. */
  jobsTruncated: number;
};

export function getProfitability(params: { from?: string; to?: string; marginThreshold?: number; jobLimit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.marginThreshold != null) qs.set('marginThreshold', String(params.marginThreshold));
  if (params.jobLimit != null) qs.set('jobLimit', String(params.jobLimit));
  const query = qs.toString();
  return apiGet<ProfitabilityResponse>(`/profitability${query ? `?${query}` : ''}`);
}

/**
 * §24 „Aged receivables" (Sesiunea 153) — CINE NE DATOREAZĂ BANI, ȘI DE CÂT TIMP.
 *
 * ⚠️ Tipuri ÎNGUSTE, citite din `backend/src/routes/invoicesReceivables.ts`. ⛔ Intervalele nu se
 * scriu aici: vin de la server, cu etichetele lor — altfel ecranul ar putea eticheta altfel decât
 * calculează raportul.
 */
export type ReceivableRow = {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerId: string | null;
  jobNumber: number | null;
  dueDate: string;
  daysOverdue: number;
  bucket: string;
  invoiced: number;
  outstanding: number;
};

export type AgedReceivablesResponse = {
  rows: ReceivableRow[];
  buckets: { key: string; label: string; count: number; total: number }[];
  totalOverdue: number;
  /** Neplătit, dar încă în termen — nu e o creanță veche, dar nici zero. */
  notYetDue: { count: number; total: number };
  /** 🔴 Ce NU s-a putut îmbătrâni, cu motivul scris pe server (o hotărâre lipsă, nu un defect). */
  notAged: { count: number; total: number; reason: string };
  /** Ziua de la Londra pe care s-a măsurat raportul. */
  asOf: string;
};

export function getAgedReceivables() {
  return apiGet<AgedReceivablesResponse>('/invoices/aged-receivables', {});
}

/**
 * ⚠️ `POST`, nu `GET`, ca exportul de vizite: un cont „doar citire" nu scoate liste de clienți și de
 * bani din aplicație. Metoda e poarta.
 */
export function exportAgedReceivables() {
  return apiDownloadPost('/invoices/aged-receivables/export', {}, 'ACHU-aged-receivables.csv');
}

/* ─── §38 „Scheduled versus actual duration" (Sesiunea 154) ──────────────────
 *
 * ⚠️ **Aici, lângă profitabilitate și creanțe, nu în `timesheetEndpoints.ts`.** Acolo stă „estimat
 * vs. real", care compară minute de **muncă** cu orele pontate; asta compară timp **scurs** —
 * fereastra din calendar față de marcajele vizitei. 🔴 Două întrebări diferite; motivul întreg e în
 * `backend/src/lib/scheduleAccuracyPolicy.ts`.
 */

/** Un steag al vizitei, exact cum îl scrie `lib/jobScheduleFlags.ts`. */
export type ScheduleAccuracyFlag = { code: 'late-start' | 'early-finish' | 'overran'; minutes: number; message: string };

export type ScheduleAccuracyRow = {
  id: string;
  reference: number;
  date: string;
  service: string | null;
  customerName: string;
  plannedMinutes: number;
  actualMinutes: number;
  /** Pozitiv = a ținut mai mult decât scria în calendar. */
  varianceMinutes: number;
  /** ⚠️ `null` pe vizitele scurte: un procent pe un sfert de oră e zgomot, nu 0. */
  variancePercent: number | null;
  flags: ScheduleAccuracyFlag[];
};

export type ScheduleAccuracyResponse = {
  period: { from: string; to: string; days: number };
  /** ⚠️ Primul în răspuns, deliberat: cine citește cifrele nu poate spune că nu a văzut ce lipsește. */
  coverage: {
    visits: number;
    comparable: number;
    skipped: { 'no-window': number; 'window-unusable': number; 'no-stamps': number; 'stamped-other-day': number };
    note: string;
  };
  totals: {
    comparableVisits: number;
    plannedMinutes: number;
    actualMinutes: number;
    varianceMinutes: number;
    /** ⛔ `null`, nu 0: fără numitor nu există procent. */
    variancePercent: number | null;
    /** Câte s-au încheiat în fereastră — „cât de des nimerim". */
    withinWindow: number;
  };
  byService: Array<{
    service: string;
    jobCount: number;
    plannedMinutes: number;
    actualMinutes: number;
    varianceMinutes: number;
    variancePercent: number | null;
    jobsBelowThreshold: number;
  }>;
  furthestFromPlan: ScheduleAccuracyRow[];
  notes: { whatThisIs: string; notPay: string; smallVisits: string; onlyCompleted: string };
};

export function getScheduleAccuracy(params: { from?: string; to?: string; jobLimit?: number } = {}) {
  return apiGet<ScheduleAccuracyResponse>('/schedule-accuracy', params);
}

/**
 * ⚠️ `POST`, ca exportul creanțelor de mai sus și pentru exact același motiv: un cont „doar citire"
 * poate face orice GET al Adminului, deci metoda e poarta.
 */
export function exportScheduleAccuracy(params: { from?: string; to?: string } = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiDownloadPost(`/schedule-accuracy/export${qs ? `?${qs}` : ''}`, {}, 'ACHU-scheduled-vs-actual.csv');
}

/* ─── §38 „Quote / Conversion / Source report" (Sesiunea 154) ────────────────
 *
 * ⚠️ **Două pâlnii, două obiecte** — cererile de ofertă și ofertele de preț. ⛔ Nu se adună într-o
 * singură rată: o vizită se poate face fără nicio ofertă scrisă, iar o ofertă se poate scrie fără
 * nicio cerere. Motivul întreg: `backend/src/lib/quoteFunnelPolicy.ts`.
 */
export type QuoteFunnelResponse = {
  period: { from: string; to: string; days: number };
  enquiries: {
    received: number;
    /** ⚠️ Scoase din numitorul ratei, numărate aparte. */
    duplicates: number;
    converted: number;
    rejected: number;
    stillOpen: number;
    conversionErrors: number;
    /** ⛔ `null`, nu 0: fără numitor nu există rată. */
    conversionRate: number | null;
  };
  bySource: Array<{ source: string; received: number; converted: number; conversionRate: number | null }>;
  quotes: {
    written: number;
    sent: number;
    drafts: number;
    accepted: number;
    rejected: number;
    revisionRequested: number;
    noAnswer: number;
    expiredUnanswered: number;
    /** accepted ÷ (accepted + rejected). ⛔ Tăcerea nu e un refuz. */
    acceptanceRate: number | null;
    sentValue: number;
    acceptedValue: number;
  };
  notes: { twoFunnels: string; duplicates: string; silence: string; source: string };
};

export function getQuoteFunnel(params: { from?: string; to?: string } = {}) {
  return apiGet<QuoteFunnelResponse>('/quote-funnel', params);
}

/** ⚠️ `POST`, ca celelalte exporturi: metoda e poarta pentru contul „doar citire". */
export function exportQuoteFunnel(params: { from?: string; to?: string } = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiDownloadPost(`/quote-funnel/export${qs ? `?${qs}` : ''}`, {}, 'ACHU-enquiries-and-quotes.csv');
}

/* ─── §38 „Expenses report" (Sesiunea 154) ───────────────────────────────────
 *
 * 🔴 **Aceleași cheltuieli pe care le numără Dashboard-ul** pentru o perioadă (rânduri active, pe
 * data cheltuielii). ⛔ Deci totalul de aici și cel de pe prima pagină trebuie să fie egale — dacă
 * vreodată nu sunt, unul din cele două minte.
 */
export type SpendGroup = {
  key: string;
  count: number;
  total: number;
  withoutReceipt: number;
  withoutReceiptTotal: number;
  /** ⛔ `null`, nu 0%, când nu există numitor. */
  percentOfTotal: number | null;
};

export type ExpenseReportResponse = {
  period: { from: string; to: string; days: number };
  totals: {
    count: number;
    total: number;
    /** 🔴 „Consemnat" pe chitanțe, NU „de recuperat" — depinde de înregistrarea în scopuri de TVA. */
    vatRecorded: number;
    /** Pe câte rânduri s-a citit un TVA: fără cifra asta, „£0" arată ca o firmă fără TVA. */
    vatRowCount: number;
    withoutReceipt: number;
    withoutReceiptTotal: number;
  };
  byCategory: SpendGroup[];
  bySupplier: SpendGroup[];
  largest: Array<{
    id: string; expenseId: number; date: string; supplier: string;
    category: string; amount: number; hasReceiptFile: boolean;
  }>;
  /** Prima propoziție citită de om — și singura care cere ceva de făcut. */
  receiptNote: string;
  notes: { sameAsDashboard: string; vat: string; notProfit: string };
};

export function getExpenseReport(params: { from?: string; to?: string } = {}) {
  return apiGet<ExpenseReportResponse>('/expense-report', params);
}

/** ⚠️ `POST`, ca celelalte exporturi: aici ies furnizorii și sumele firmei, iar metoda e poarta. */
export function exportExpenseReport(params: { from?: string; to?: string } = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiDownloadPost(`/expense-report/export${qs ? `?${qs}` : ''}`, {}, 'ACHU-expenses.csv');
}

/* ─── §38 „Payments / Refund report" (Sesiunea 154) ──────────────────────────
 *
 * 🔴 **Două totaluri, deliberat:** ce s-a **consemnat** în perioadă, și cât din el **contează ca
 * venit** pe Dashboard. ⚠️ Cifra de venit vine din **aceeași regulă** pe care o citește prima pagină
 * (`backend/src/lib/paymentIncomeScope.ts`), deci diferența poate fi numită în loc să fie un al doilea
 * total pe care nimeni nu-l poate reconcilia.
 */
export type MoneyGroup = {
  key: string;
  count: number;
  total: number;
  /** ⛔ `null`, nu 0%, când nu există numitor. */
  percentOfTotal: number | null;
};

export type PaymentReportResponse = {
  period: { from: string; to: string; days: number };
  received: { count: number; total: number; byMethod: MoneyGroup[] };
  refunded: { count: number; total: number; byReason: MoneyGroup[]; byMethod: MoneyGroup[] };
  /** Consemnat: încasat − rambursat. */
  net: number;
  largest: Array<{
    id: string; paymentId: number; date: string | null; customerName: string;
    method: string; amount: number; status: string;
  }>;
  /** Reconcilierea cu prima pagină — prima propoziție citită de om. */
  income: { net: number; excludedCount: number; note: string };
  notes: { twoTotals: string; voided: string; refundReasons: string; notProfit: string };
};

export function getPaymentReport(params: { from?: string; to?: string } = {}) {
  return apiGet<PaymentReportResponse>('/payment-report', params);
}

/** ⚠️ `POST`, ca celelalte exporturi (ACHU-779): aici ies clienți și sume, iar metoda e poarta. */
export function exportPaymentReport(params: { from?: string; to?: string } = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiDownloadPost(`/payment-report/export${qs ? `?${qs}` : ''}`, {}, 'ACHU-payments-and-refunds.csv');
}

/* ─── §26 „Monthly financial summary" / „Cash received versus invoiced" (Sesiunea 154) ──────────
 *
 * 🔴 **Două baze, amândouă adevărate:** cât s-a **facturat** în lună (munca e făcută, hârtia e emisă)
 * și câți bani au **intrat** în lună. ⛔ Un singur total ar fi ales tăcut o bază de contabilitate în
 * locul owner-ului — care bază se aplică firmei e o întrebare pentru contabil.
 *
 * ⚠️ Diferența dintre ele **nu e o eroare**, iar `reconcileNote` spune de ce există. 🔴 Ecranul nu
 * răspunde la „cât din facturile lunii a fost plătit": o plată e legată de o **vizită**, nu de o
 * factură (§23, hotărâre nedată), deci răspunsul ar fi fost o ghiceală care arată exactă.
 */
export type MonthlySummaryResponse = {
  period: { from: string; to: string; days: number };
  invoiced: {
    count: number;
    net: number;
    /** 🔴 „Consemnat" pe facturi, NU „de plată" sau „de recuperat". */
    vat: number;
    gross: number;
    /** Facturi de termen de abonament — cele care nu pot fi legate de o singură plată. */
    forSubscriptionTerms: number;
  };
  cash: {
    receivedCount: number;
    received: number;
    refundedCount: number;
    refunded: number;
    /** Încasat − restituit. */
    net: number;
    /** Bani intrați fără nicio factură în spate — cauza măsurabilă a diferenței. */
    withNoInvoiceCount: number;
    withNoInvoice: number;
  };
  spend: { count: number; total: number; vat: number };
  /** casă − facturat. ⚠️ O cifră, nu o eroare. */
  difference: number;
  reconcileNote: string;
  /** ⛔ NU e profit: e mișcarea de casă a perioadei (intrat − ieșit). */
  netCash: number;
  byMonth: Array<{
    month: string;
    invoicedGross: number;
    invoiceCount: number;
    cashNet: number;
    paymentCount: number;
    spend: number;
    netCash: number;
  }>;
  notes: { twoBases: string; noAllocation: string; voided: string; vat: string };
};

export function getMonthlySummary(params: { from?: string; to?: string } = {}) {
  return apiGet<MonthlySummaryResponse>('/monthly-summary', params);
}

/** ⚠️ `POST`, ca celelalte trei exporturi (ACHU-779). 🔴 Fișierul ăsta pleacă din firmă: se auditează. */
export function exportMonthlySummary(params: { from?: string; to?: string } = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiDownloadPost(`/monthly-summary/export${qs ? `?${qs}` : ''}`, {}, 'ACHU-monthly-summary.csv');
}

/**
 * §40 „Duplicate detection" (Sesiunea 154) — raportul care întreabă, nu care repară.
 *
 * ⚠️ `certainty` e „certain" sau „likely", și rămân **despărțite**: „certain" înseamnă că rândurile
 * împart ceva care prin definiție aparține unui singur om (e-mail, telefon); „likely" înseamnă ceva
 * care se poate repeta cinstit (numele). ⛔ Ecranul nu le adună într-un scor — un procent nu spune
 * omului ce să verifice.
 */
export type DuplicateReport = {
  sections: Array<{
    entity: 'customers' | 'cleaners' | 'jobs';
    label: string;
    affected: number;
    groups: Array<{
      kind: string;
      certainty: 'certain' | 'likely';
      reason: string;
      ids: string[];
      rows: Array<{ id: string; ref: string; label: string }>;
    }>;
  }>;
  totalAffected: number;
  scannedAt: string;
  /** Câte rânduri s-au scanat. ⚠️ „0 din 0" și „0 din 4000" sunt două vești foarte diferite. */
  counts: { customers: number; cleaners: number; jobs: number };
};

export function getDuplicateReport() {
  return apiGet<DuplicateReport>('/data-quality/duplicates');
}

/**
 * §40 „Invalid-status / Missing-link / Invalid-date detection" (Sesiunea 154).
 *
 * ⚠️ `notChecked` nu e decor: spune **ce nu s-a verificat**. O listă goală care ascunde o verificare
 * nefăcută e mai rea decât una lipsă — pare o veste bună.
 */
export type IntegrityReport = {
  findings: Array<{
    kind: 'status' | 'link' | 'date';
    reason: string;
    ids: string[];
    rows: Array<{ id: string; ref: string }>;
  }>;
  totalAffected: number;
  scannedAt: string;
  counts: { jobs: number; payments: number; customers: number; quoteRequests: number; invoices: number };
  notChecked: string[];
};

export function getIntegrityReport() {
  return apiGet<IntegrityReport>('/data-quality/integrity');
}

/* ─── §38 „Complaint / Incident / Re-clean report" (Sesiunea 155) ─────────────
 *
 * 🔴 **Trei numărători care NU se adună** — o canapea pătată poate fi toate trei (reclamație ·
 * incident · re-curățenie), o cheie pierdută pe drum e doar incident. ⛔ De asta tipul are trei
 * ramuri, nu un total: un câmp „total" ar fi fost citit de primul ecran ca „câte lucruri au mers
 * prost", iar numărul acela nu există.
 *
 * ⚠️ Fiecare câmp e citit din `backend/src/lib/problemReportPolicy.ts`, `complaintPolicy.ts` și
 * `incidentPolicy.ts` — de acolo vin și nulabilitățile (`null`, nu `0`, când nu există numitor).
 */
export type ProblemCountGroup = { value: string; label: string; count: number };

export type ProblemReportResponse = {
  period: { from: string; to: string; days: number };
  complaints: {
    total: number;
    open: number;
    byCategory: ProblemCountGroup[];
    byCause: ProblemCountGroup[];
    bySeverity: ProblemCountGroup[];
    byOutcome: ProblemCountGroup[];
    /** Măsura registrului: închise fără cauza/rezultatul care se scriu la închidere. */
    closedWithoutCause: number;
    closedWithoutOutcome: number;
    closedCount: number;
    /** ⛔ `null` când nu s-a închis nimic — `0` ar arăta ca „instant". */
    medianDaysToClose: number | null;
    oldestOpenDays: number | null;
    /** ACHU-563 — față de promisiunea de 2 zile lucrătoare. */
    overdueOpen: number;
    answeredLate: number;
    ledToReClean: number;
  };
  incidents: {
    total: number;
    open: number;
    openReportable: number;
    byKind: ProblemCountGroup[];
    bySeverity: ProblemCountGroup[];
    closedReportableWithoutRecord: number;
    closedCount: number;
    medianDaysToClose: number | null;
    reportedExternally: number;
    /** 🔴 Cifră de registru, nu bani mișcați — vezi nota `incidentCost`. */
    cost: { recordedOn: number; total: number };
  };
  reCleans: {
    total: number;
    bySource: ProblemCountGroup[];
    byOutcome: ProblemCountGroup[];
    /** ⛔ `percent` e `null` la zero re-curățenii, nu `0%`. */
    caughtByUs: { count: number; percent: number | null };
    approvedWithoutJob: number;
    fromComplaint: number;
  };
  trend: Array<{ month: string; complaints: number; incidents: number; reCleans: number }>;
  notes: {
    recordedOnly: string; threeStreams: string; dates: string; closureFields: string;
    noPerCleaner: string; incidentCost: string; reCleanCost: string; reportedExternally: string;
  };
};

export function getProblemReport(params: { from?: string; to?: string } = {}) {
  return apiGet<ProblemReportResponse>('/problem-report', params);
}

/** ⚠️ `POST`, ca celelalte exporturi (ACHU-779): metoda e poarta pentru contul „doar citire". */
export function exportProblemReport(params: { from?: string; to?: string } = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return apiDownloadPost(`/problem-report/export${qs ? `?${qs}` : ''}`, {}, 'ACHU-what-went-wrong.csv');
}

