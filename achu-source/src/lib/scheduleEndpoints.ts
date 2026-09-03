/**
 * ACHU-401, felia a douăsprezecea — PROGRAMUL: ziua de lucru, calendarul cu toate
 * evenimentele, și foaia de repartizare. Apelurile plus formele răspunsurilor.
 *
 * ⛔ **Fișier propriu, nu tipuri adăugate în `endpoints.ts`:** acela are peste 1200 de rânduri
 * și **nu are voie să crească** (`AGENT_RULES` §7). Același tipar ca `chatEndpoints.ts` și
 * `notificationEndpoints.ts` (felia 11): funcțiile pleacă din orchestrator cu totul, nu rămân
 * acolo cu un tip pus deasupra.
 *
 * 🔴 **Fiecare câmp de aici e citit din `backend/src/routes/schedule.ts` și din
 * `backend/src/lib/scheduleAggregation.ts`** — din obiectul pe care îl construiește chiar ruta,
 * nu ghicit din cum arată ecranul. Un tip inventat e mai rău decât `any`: `any` măcar nu minte.
 *
 * ⚠️ **Datele sunt `string`, nu `Date`:** `ScheduleEntry.accessConfirmedAt` și `onTheWayAt` sunt
 * `Date` în `scheduleAggregation.ts`, dar ce trece prin JSON ajunge text. Tipul de aici descrie
 * **sârma**, nu ce ține serverul în memorie.
 */
import { apiGet, apiDownloadPost } from './apiClient';
/** ⚠️ Forma sarcinii e definită o dată, unde e folosită gruparea pe zile. */
import type { ScheduleTask } from './scheduleGrouping';

/** O vizită pe axa timpului. `scheduleAggregation.ts` → `ScheduleEntry`. */
export type ScheduleEntry = {
  id: string;
  /** Numărul vizibil al vizitei (`Job.jobId`), nu cuid-ul. */
  reference: number;
  date: string;
  customerName: string;
  customerPhone: string | null;
  service: string;
  address: string | null;
  startTime: string | null;
  finishTime: string | null;
  status: string;
  /** Culoarea, decisă pe server, ca ziua/săptămâna/luna să nu se despartă. */
  tone: string;
  /** `null` când orele lipsesc sau nu se pot citi — niciodată 0. */
  durationMinutes: number | null;
  /** Cheia de sortare; `null` intră în coșul „neprogramat". */
  startMinutes: number | null;
  amountCharged: number | null;
  customerInstructions: string | null;
  accessInstructions: string | null;
  /** ACHU-513. `null` = **nu a confirmat**, niciodată „nu se poate intra". */
  accessConfirmedAt: string | null;
  /**
   * ACHU-565 — per curățător, nu per vizită: la o vizită cu doi oameni, „unul a plecat la
   * 09:12, celălalt încă nu" e chiar răspunsul căutat. ⚠️ `onTheWayAt` `null` = **nu a
   * anunțat**, niciodată „nu a plecat".
   */
  cleaners: { id: string; name: string; onTheWayAt: string | null }[];
};

/** Vizite programate pe care nu merge nimeni. `buildUnassignedPanel` alege doar aceste câmpuri. */
export type ScheduleUnassigned = Pick<
  ScheduleEntry,
  'id' | 'reference' | 'date' | 'customerName' | 'service' | 'startTime' | 'status'
>;

/** Două vizite ale ACELUIAȘI curățător, în aceeași zi, peste aceeași oră. */
export type ScheduleConflict = {
  cleanerId: string;
  cleanerName: string;
  date: string;
  jobIdA: string;
  jobIdB: string;
  overlapMinutes: number;
  /** Adevărat când nu se suprapun, dar nu încape nici timpul de drum dintre ele. */
  travelOnly: boolean;
};

/** Un gol în ziua unui curățător. `from`/`to` sunt ore, nu date. */
export type ScheduleGap = {
  cleanerId: string;
  cleanerName: string;
  date: string;
  from: string;
  to: string;
  gapMinutes: number;
};

export type ScheduleWorkload = {
  cleanerId: string;
  cleanerName: string;
  date: string;
  jobCount: number;
  committedMinutes: number;
};

/**
 * 🆕 ACHU-797 — un curățător plecat în perioada privită.
 *
 * ⚠️ **`summary` vine scris de pe server** (`lib/cleanerAwayPolicy.ts` — `awaySummary`), cu numele și
 * intervalul în el. ⛔ Ecranul nu lipește bucăți: al doilea ecran le-ar lipi altfel.
 */
export type ScheduleAway = {
  cleanerId: string;
  cleanerName: string;
  reason: 'leave' | 'sickness';
  startDate: string;
  /** `null` = absență de boală încă deschisă („nu știm până când"), nu „o zi". */
  endDate: string | null;
  summary: string;
};

export type ScheduleResponse = {
  range: { from: string; to: string; days: string[] };
  entries: ScheduleEntry[];
  unassigned: ScheduleUnassigned[];
  conflicts: ScheduleConflict[];
  gaps: ScheduleGap[];
  workload: ScheduleWorkload[];
  /**
   * 🔴 §43 „Calendar display" (Sesiunea 150) — sarcinile de birou cu termen în interval.
   * ⚠️ Opțional: ruta le trimite mereu, dar tipul le-a lipsit până la ACHU-797, iar ecranul le citea
   * dintr-o copie locală a formei. ⛔ O a doua definiție a aceluiași răspuns e chiar felul în care
   * un câmp nou ajunge să existe pe server și să nu existe pe ecran.
   */
  tasks?: ScheduleTask[];
  /** 🆕 ACHU-797 — cine nu e în perioadă. */
  away: ScheduleAway[];
  /**
   * 🆕 ACHU-797 — vizitele care au **totuși** pe cineva plecat pus pe ele, pe ziua vizitei.
   * 🔴 Cazul invers celui de la asignare: concediul se aprobă și DUPĂ ce vizita a fost programată.
   */
  awayAssignments: { jobId: string; cleanerId: string; message: string }[];
  /** Ce a folosit efectiv serverul, nu ce s-a cerut: valorile implicite se văd aici. */
  settings: { travelMinutes: number; minGapMinutes: number };
  /**
   * Numărate pe server, ca ecranul să poată scrie „3 suprapuneri" fără să le re-deducă din
   * liste și fără riscul unui alt răspuns decât lista de dedesubt.
   */
  summary: {
    jobCount: number; unassignedCount: number; conflictCount: number; gapCount: number;
    /** 🆕 ACHU-797 — **vizite**, nu oameni: atâtea trebuie mutate. */
    awayAssignedCount: number;
  };
};

export function getSchedule(params: {
  from?: string;
  to?: string;
  cleanerId?: string;
  /**
   * 🆕 §11 „Team view" (Sesiunea 158). ⚠️ **Se compune cu `cleanerId`** — serverul aplică amândouă
   * îngustările, iar un al doilea filtru care l-ar șterge tăcut pe primul e chiar felul în care un
   * ecran arată altceva decât spun controalele lui.
   */
  teamId?: string;
  statuses?: string[];
  travelMinutes?: number;
  minGapMinutes?: number;
} = {}) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.cleanerId) qs.set('cleanerId', params.cleanerId);
  if (params.teamId) qs.set('teamId', params.teamId);
  if (params.statuses?.length) qs.set('statuses', params.statuses.join(','));
  if (params.travelMinutes != null) qs.set('travelMinutes', String(params.travelMinutes));
  if (params.minGapMinutes != null) qs.set('minGapMinutes', String(params.minGapMinutes));
  const query = qs.toString();
  return apiGet<ScheduleResponse>(`/schedule${query ? `?${query}` : ''}`);
}

/**
 * 🆕 §11 „Calendar export" (Sesiunea 158) — perioada de pe ecran, ca fișier CSV.
 *
 * 🔴 **`POST`, ca celelalte exporturi, și metoda e poarta:** un cont „doar citire" poate face orice
 * GET al Adminului, deci un export pe GET ar scoate o listă de clienți și adrese din aplicație pentru
 * cineva căruia i s-a dat doar dreptul să se uite (`backend/src/routes/csvExportGuard.test.ts`).
 *
 * ⛔ **Nu e un fișier de calendar (`.ics`)** — vezi motivul scris în rută: un `.ics` corect cere ora
 * cu fus, iar orele noastre sunt text local pe zi. Legătura cu Google/Outlook e un rând propriu.
 * ⚠️ Instrucțiunile de acces NU intră în fișier, deliberat.
 */
export function exportSchedule(params: {
  from?: string;
  to?: string;
  cleanerId?: string;
  teamId?: string;
  statuses?: string[];
} = {}) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.cleanerId) qs.set('cleanerId', params.cleanerId);
  if (params.teamId) qs.set('teamId', params.teamId);
  if (params.statuses?.length) qs.set('statuses', params.statuses.join(','));
  const query = qs.toString();
  return apiDownloadPost(`/schedule/export${query ? `?${query}` : ''}`, {}, 'ACHU-schedule.csv');
}

/** ACHU-255. Cele cinci feluri de eveniment, și nimic altceva — lista e închisă pe server. */
export type CalendarEventKind = 'job' | 'payment' | 'invoice-due' | 'expense' | 'term-ends';

/**
 * Un rând de calendar, indiferent de fel. ⚠️ Forma e **aceeași pentru toate cinci** — o plată
 * nu are oră și nici oameni, dar câmpurile există și sunt `null`/goale, fiindcă
 * `buildCalendarEvents` le compune așa. Ecranul nu trebuie să știe ce fel de rând citește.
 */
export type CalendarEvent = {
  kind: CalendarEventKind;
  id: string;
  date: string;
  time: string | null;
  endTime: string | null;
  title: string;
  subtitle: string;
  reference: string;
  /**
   * ACHU-258 — **cu semn**: o rambursare vine negativă, ca să nu poată fi confundată cu o
   * încasare. `null` când rândul nu are bani (o vizită fără preț trecut).
   */
  amount: number | null;
  /** `null` pe cheltuieli: o cheltuială nu are stare. */
  status: string | null;
  /** Numele curățătorilor. Gol pe orice fel care nu e vizită. */
  people: string[];
  link: string;
};

export type CalendarEventsResponse = {
  range: { from: string; to: string; days: string[] };
  /** Felurile CERUTE, nu toate cele existente. */
  kinds: CalendarEventKind[];
  events: CalendarEvent[];
  summary: { total: number } & Record<CalendarEventKind, number>;
};

/**
 * ACHU-255 — orice se întâmplă pe o dată, nu doar curățenia.
 * `kinds` omis înseamnă toate; un vector gol **nu** e același lucru, iar serverul îl refuză,
 * deci nu se trimite niciodată.
 */
export function getCalendarEvents(params: { from?: string; to?: string; kinds?: string[] } = {}) {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.kinds?.length) qs.set('kinds', params.kinds.join(','));
  const query = qs.toString();
  return apiGet<CalendarEventsResponse>(`/schedule/events${query ? `?${query}` : ''}`);
}

/**
 * O vizită pe foaia tipărită. ⛔ `adminNotes` lipsește deliberat de pe server: foaia se lasă
 * prin bucătării și dube, iar acelea sunt notele interne ale biroului.
 */
export type DispatchJob = {
  id: string;
  reference: number;
  startTime: string | null;
  finishTime: string | null;
  customerName: string;
  customerPhone: string | null;
  address: string | null;
  service: string;
  status: string;
  customerInstructions: string | null;
  accessInstructions: string | null;
};

export type DispatchResponse = {
  date: string;
  cleaners: { cleanerId: string; cleanerName: string; jobs: DispatchJob[] }[];
  unassigned: DispatchJob[];
};

export function getDispatchList(params: { date?: string } = {}) {
  return apiGet<DispatchResponse>(`/schedule/dispatch${params.date ? `?date=${params.date}` : ''}`);
}

