import { CLOSED_STATUSES } from './jobOperationalPolicy';

/**
 * ACHU-429 (Sesiunea 93) — giving the Jobs list a shape.
 *
 * ─── What the owner was looking at ───────────────────────────────────────
 * *„Nu inteleg nimic din joburi… organizeaza pagina."* The screenshot shows
 * three consecutive cards reading, in full:
 *
 *     Regukar cleaning · Cancelled · robertoiosif@gmail.com · #15 · 10/09/2026 · 5 Hazel Grove · No price set
 *     Regukar cleaning · Cancelled · robertoiosif@gmail.com · #14 · 03/09/2026 · 5 Hazel Grove · No price set
 *     Regukar cleaning · Cancelled · robertoiosif@gmail.com · #13 · 27/08/2026 · 5 Hazel Grove · No price set
 *
 * 🔴 **Every card is legible; the LIST is not.** ACHU-426 fixed the card — it
 * now leads with the service instead of hiding it — and that was the right fix
 * for the wrong altitude. Thirteen jobs arrive as thirteen equal blocks in one
 * flat run, sorted by date, with no answer to "which of these needs me?".
 *
 * ⚠️ Four of the thirteen are cancelled, and because they are the furthest-future
 * dates they sit **at the top**. The first screenful of the page is entirely
 * jobs that will never happen.
 *
 * ─── Why grouping and not just filtering ─────────────────────────────────
 * A filter answers "show me X" and requires knowing what to ask for. Grouping
 * answers "what is there", which is the actual question when you open a list
 * you do not understand. Both are provided; the grouping is what is on by
 * default.
 *
 * ⛔ Built on `CLOSED_STATUSES` from `jobOperationalPolicy.ts` rather than a
 * fresh list of strings. A second, independently-maintained opinion about which
 * statuses are finished is exactly the kind of duplicate that goes stale — and
 * this file would be the copy nobody remembers to update.
 */

export type JobGroupKey = 'enquiries' | 'scheduled' | 'review' | 'completed' | 'closed';

export interface JobGroupDef {
  key: JobGroupKey;
  /** Heading shown above the section, and the label on its filter chip. */
  label: string;
  /** Sections that are noise until asked for start folded. */
  collapsedByDefault: boolean;
}

/**
 * Display order, top to bottom. Deliberately lifecycle order rather than
 * alphabetical or by size: it reads as the path a job takes, so the sections
 * a person needs to act on are the ones they meet first.
 */
export const JOB_GROUPS: readonly JobGroupDef[] = [
  { key: 'enquiries', label: 'Enquiries', collapsedByDefault: false },
  { key: 'scheduled', label: 'Scheduled', collapsedByDefault: false },
  { key: 'review', label: 'Awaiting review', collapsedByDefault: false },
  { key: 'completed', label: 'Completed', collapsedByDefault: false },
  // 🔴 The one that made the page unreadable. Cancelled work is worth keeping
  // and worth finding, but it is not worth the top of the screen.
  { key: 'closed', label: 'Cancelled & no access', collapsedByDefault: true },
];

/**
 * Which section a job belongs to.
 *
 * ⚠️ Total by construction: an unrecognised status falls to `scheduled` rather
 * than vanishing. A job that renders nowhere is worse than one filed oddly —
 * the count says thirteen and the eye finds twelve, with nothing to explain it.
 */
export function jobGroupOf(status: string | undefined | null): JobGroupKey {
  const s = status ?? '';
  if (s === 'Enquiry') return 'enquiries';
  if (s === 'Completion Review') return 'review';
  if (s === 'Completed') return 'completed';
  // Cancelled / No Access. Read from the shared set so this cannot drift.
  if (CLOSED_STATUSES.has(s)) return 'closed';
  return 'scheduled';
}

export interface GroupedJobs<T> {
  key: JobGroupKey;
  label: string;
  collapsedByDefault: boolean;
  jobs: T[];
}

/**
 * Split an already-sorted list into sections, preserving the caller's order
 * within each one — the sort control stays in charge of ordering.
 *
 * Empty sections are dropped: a heading reading "Awaiting review · 0" is a
 * question nobody asked taking up a line on a phone.
 */
export function groupJobs<T extends { status?: string | null }>(jobs: T[]): GroupedJobs<T>[] {
  const buckets = new Map<JobGroupKey, T[]>();
  for (const job of jobs) {
    const key = jobGroupOf(job.status);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(job);
    else buckets.set(key, [job]);
  }

  return JOB_GROUPS
    .filter(g => (buckets.get(g.key)?.length ?? 0) > 0)
    .map(g => ({ ...g, jobs: buckets.get(g.key)! }));
}

/**
 * Does this job still want a price?
 *
 * ⛔ Closed work does not. ACHU-426 introduced a "No price set" line, and on
 * the owner's screen it appeared under every one of the three CANCELLED jobs —
 * turning a useful prompt into three lines of false suggestion that something
 * was outstanding. A cancelled visit has no price because it does not need one.
 */
export function jobWantsAPrice(job: { status?: string | null; amountCharged?: number | null }): boolean {
  if (CLOSED_STATUSES.has(job.status ?? '')) return false;
  return (job.amountCharged ?? 0) === 0;
}

/**
 * 🆕 §47 (Sesiunea 154) — CÂTE VIZITE ARE FIECARE SECȚIUNE, DIN NUMĂRĂTORILE SERVERULUI.
 *
 * ⚠️ De când lista vine **paginată**, secțiunile nu se mai pot număra din rândurile primite: ar
 * spune „câte sunt pe pagina asta", nu „câte sunt". 🔴 Serverul trimite un **fapt** — câte vizite au
 * fiecare stare în setul filtrat — iar adunarea pe grupuri rămâne **aici**, unde a fost mereu.
 *
 * ⛔ Alternativa ar fi fost ca serverul să numere pe grupuri, adică să cunoască împărțirea de mai
 * sus: un al doilea adevăr despre aceeași regulă, despărțit de primul la prima stare adăugată.
 *
 * ⚠️ Secțiunile goale ies din listă, ca la `groupJobs`: un titlu „Awaiting review · 0" e o întrebare
 * pe care n-a pus-o nimeni, ocupând un rând pe telefon.
 */
export function groupCountsFromStatuses(
  statusCounts: Record<string, number>,
): Array<JobGroupDef & { count: number }> {
  const totals = new Map<JobGroupKey, number>();
  for (const [status, count] of Object.entries(statusCounts)) {
    const key = jobGroupOf(status);
    totals.set(key, (totals.get(key) ?? 0) + count);
  }

  return JOB_GROUPS
    .filter(g => (totals.get(g.key) ?? 0) > 0)
    .map(g => ({ ...g, count: totals.get(g.key)! }));
}

