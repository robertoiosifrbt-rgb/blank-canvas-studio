/**
 * ACHU-401 (Sesiunea 115) + felia 11 — formele pe care le citește dialogul de contracte
 * recurente, plus starea lui goală de formular.
 *
 * ⛔ **Fișier propriu, nu tipuri în componentă:** `RecurringSeriesDialog.tsx` e la plafonul lui
 * de mărime (`AGENT_RULES` §7) și nu are voie să crească — nici măcar cu un rând de `import`.
 * Reparația de pe 15/08/2026 (câmpul de oră nativ → `TimeField`) cerea exact un rând, deci
 * responsabilitatea asta a ieșit din fișier ca să încapă.
 */

export type EndMode = 'never' | 'date' | 'count';

/**
 * ACHU-401 (Sesiunea 115). The shapes this dialog reads, instead of `any`.
 *
 * `src/lib/endpoints.ts` is `any` by design (see its header). These name only
 * the fields used below, each read off the route that produces it — the list
 * row and the detail record are the SAME object server-side
 * (`backend/src/routes/recurringSeries.ts:223` and `:283`), which is why one
 * type covers both the `item` prop and `getRecurringSeries().record`.
 *
 * ⚠️ `frequency` is a plain `String` column, so it is `string` here and not the
 * form's three-way union. The form casts on the way in, as it already did.
 */
export type RecurringSeriesRecord = {
  id: string;
  /** Numărul vizibil al contractului (`RecurringSeries.recurringSeriesId`), nu cuid-ul. */
  reference: number;
  customerId: string;
  customerName: string;
  frequency: string;
  interval: number;
  weekdays: number[];
  dayOfMonth: number | null;
  startDate: string;
  endDate: string | null;
  occurrenceCount: number | null;
  /** active | paused | cancelled. Un contract anulat nu se mai editează. */
  status: string;
  service: string;
  /** ⚠️ `null` e real: coloana e opțională, iar vizita moștenește atunci adresa clientului. */
  address: string | null;
  startTime: string | null;
  finishTime: string | null;
  amountCharged: number | null;
  customerInstructions: string | null;
  defaultCleanerIds: string[];
  /** Până unde s-au generat vizitele, cerut ultima oară. `null` = nu s-a generat niciodată. */
  generateUntil: string | null;
  priceReviewDate: string | null;
  notes: string | null;
  /** Propoziția compusă pe server, ca fiecare ecran să spună aceeași frază. */
  description?: string;
  visits?: {
    id: string;
    date: string;
    status: string;
    startTime: string | null;
    amountCharged: number | null;
    /** The visit sits on a date the pattern no longer produces — somebody moved it. */
    rescheduled: boolean;
  }[];
  /**
   * Detail only. Dates the pattern WILL produce but that are not booked yet —
   * a forecast, not a promise (`backend/src/routes/recurringSeries.ts:327`).
   */
  upcomingUngenerated?: string[];
};

/**
 * ACHU-401 (felia 12) — un rând din LISTĂ. Aceleași câmpuri ca detaliul, plus cele trei pe care
 * doar ruta de listă le calculează (`backend/src/routes/recurringSeries.ts:242`).
 *
 * ⛔ **Extinde `RecurringSeriesRecord`, nu îl redeclară** — rândul e dat direct dialogului ca
 * `item`, iar un tip scris separat aici a rămas o dată în urmă cu nouă câmpuri (Sesiunea 115).
 */
export type RecurringSeriesListRow = RecurringSeriesRecord & {
  /** Ultima vizită viitoare care EXISTĂ. `null` = nu e nimic programat înainte. */
  bookedUntil: string | null;
  /** Câte zile de vizite mai sunt generate. **0 = agenda a secat**, iar contractul pare sănătos fără cifra asta. */
  daysBooked: number;
  priceReviewDue: boolean;
};

/** Only what the "usual cleaners" toggles read. */
export type CleanerOption = { id: string; cleanerName: string; active?: boolean };

export const emptyForm = {
  customer: '',
  frequency: 'weekly' as 'daily' | 'weekly' | 'monthly',
  interval: 1,
  /** UI only, never sent: whether the "Something else…" fields are showing. */
  customCadence: false,
  weekdays: [] as number[],
  dayOfMonth: '' as string,
  startDate: '',
  endMode: 'never' as EndMode,
  endDate: '',
  occurrenceCount: '',
  service: '',
  address: '',
  startTime: '',
  finishTime: '',
  amountCharged: '',
  customerInstructions: '',
  defaultCleanerIds: [] as string[],
  priceReviewDate: '',
  notes: '',
};

