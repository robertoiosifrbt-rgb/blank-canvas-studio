/**
 * Sesiunea 49 — how a recurring pattern is described in words.
 *
 * Pulled out of RecurringSeriesDialog so it can be tested without dragging in the
 * API client and, through it, the Supabase client and its environment variables.
 * A pure function about wording should not need a configured backend to prove it
 * works.
 *
 * ─── Why this exists at all ─────────────────────────────────────────────
 * The owner could not read the form. Verbatim: "Nu inteleg how often is every".
 * It asked for "Repeats: Weekly" and "Every (weeks): 1" — the same fact stated
 * twice, with the composition left to the reader. Worse, the dialog's own header
 * already claimed the cadence was "spelled out as a sentence… so nobody has to
 * work out what 'frequency: weekly, interval: 2' means". That sentence existed,
 * but only on the LIST screen, not on the form where the choice is made.
 */

export const WEEKDAYS: Array<{ value: number; short: string; full: string }> = [
  { value: 1, short: 'M', full: 'Monday' },
  { value: 2, short: 'T', full: 'Tuesday' },
  { value: 3, short: 'W', full: 'Wednesday' },
  { value: 4, short: 'T', full: 'Thursday' },
  { value: 5, short: 'F', full: 'Friday' },
  { value: 6, short: 'S', full: 'Saturday' },
  { value: 7, short: 'S', full: 'Sunday' },
];


/**
 * Sesiunea 49 — the owner could not read this form. Verbatim: "Nu inteleg how
 * often is every".
 *
 * He was right, and the file's own header was already wrong about it: it claimed
 * "the cadence is spelled out as a sentence… so nobody has to work out what
 * 'frequency: weekly, interval: 2' means". That sentence exists, but only on the
 * LIST screen. On the form — the one place you are actually choosing — it asked
 * for "Repeats: Weekly" and "Every (weeks): 1" and left you to compose the two in
 * your head. Weekly AND every 1 week reads as the same fact stated twice.
 *
 * So the pattern is now picked in words. The frequency/interval pair still exists
 * underneath, because that is what the server takes, but it is not what anybody
 * is asked for.
 */
export const CADENCE_PRESETS: Array<{ label: string; frequency: 'daily' | 'weekly' | 'monthly'; interval: number }> = [
  { label: 'Every week', frequency: 'weekly', interval: 1 },
  { label: 'Every 2 weeks (fortnightly)', frequency: 'weekly', interval: 2 },
  { label: 'Every 3 weeks', frequency: 'weekly', interval: 3 },
  { label: 'Every 4 weeks', frequency: 'weekly', interval: 4 },
  { label: 'Every month', frequency: 'monthly', interval: 1 },
  { label: 'Every 2 months', frequency: 'monthly', interval: 2 },
  { label: 'Every 3 months (quarterly)', frequency: 'monthly', interval: 3 },
  { label: 'Every day', frequency: 'daily', interval: 1 },
];

/** Which preset a saved series matches, or 'custom' for anything else. */
export function presetKeyFor(frequency: string, interval: number): string {
  const i = CADENCE_PRESETS.findIndex(p => p.frequency === frequency && p.interval === interval);
  return i === -1 ? 'custom' : String(i);
}

/**
 * The cadence in one plain sentence, shown live while it is being chosen.
 *
 * Deliberately built here rather than fetched: it has to update as the form
 * changes, and a round trip per keystroke to render a label nobody asked the
 * server for would be absurd. It mirrors the server's `describeRule`, which is
 * what the list and the customer portal show — worth knowing that these are two
 * implementations of one sentence, so a change to the wording belongs in both.
 */
export function describeCadence(form: {
  frequency: string; interval: number; weekdays: number[]; dayOfMonth: string;
}): string {
  const every = Number(form.interval) || 1;

  if (form.frequency === 'daily') {
    return every === 1 ? 'Once a day' : `Once every ${every} days`;
  }

  if (form.frequency === 'monthly') {
    const day = form.dayOfMonth ? `on day ${form.dayOfMonth}` : 'on the day of the start date';
    return every === 1 ? `Once a month, ${day}` : `Once every ${every} months, ${day}`;
  }

  const names = form.weekdays.length
    ? WEEKDAYS.filter(d => form.weekdays.includes(d.value)).map(d => d.full).join(', ')
    : null;
  const days = names ?? 'on the day of the start date';
  const when = names ? `on ${names}` : days;

  if (every === 1) return `Every week, ${when}`;
  if (every === 2) return `Every other week (fortnightly), ${when}`;
  return `Every ${every} weeks, ${when}`;
}


