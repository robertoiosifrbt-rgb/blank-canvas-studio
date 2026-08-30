/**
 * Sesiunea 85 (ACHU-368) — WHAT COUNTS AS WORKING TIME, said where hours are typed.
 *
 * ─── Why this file exists ───────────────────────────────────────────────────
 * Roberto confirmed on 03/08/2026 that ACHU pays travel time between customers:
 * *"Da, se pontează"*. The arrangement is correct — travel between two places of
 * work IS working time for National Minimum Wage purposes. What was missing is
 * that **nothing in the app said so**, on either screen where hours are recorded.
 *
 * 🔴 And the failure mode is the one that never gets reported. NMW is tested on the
 * AVERAGE over a pay reference period, so travel that nobody logs does not produce
 * an error — it produces an average that looks perfectly ordinary and is too high.
 * The shortfall surfaces if HMRC looks, and not before.
 *
 * ─── Why one module rather than two sentences ───────────────────────────────
 * Because the office screen and the cleaner's own screen both have to say it, and
 * two wordings of one legal point is how they drift apart — the lesson from
 * `formsLoader.ts` (two P60s) and `cadenceWording.ts` (a sentence that existed on
 * the list screen and not on the form). A test compares what the two screens
 * render against these constants, so a reworded copy fails rather than diverges.
 *
 * ⛔ **This is wording, not a calculation.** There is no travel rate and no travel
 * field: ACHU pays one rate for every hour (ACHU-311), so travel hours are simply
 * hours and go through the ordinary timesheet. Adding a field here would be the
 * second route to the same money — the mistake ACHU-363 documented.
 */

/**
 * The rule, for the office, next to the box where hours are typed.
 *
 * ⚠️ Says what does NOT count as well as what does. Told only the first half,
 * somebody reasonably includes the drive from home to the first job — and then the
 * hours are too high, which is a different error in the opposite direction and just
 * as invisible.
 */
export const TRAVEL_IS_WORKING_TIME_OFFICE =
  'Travel between two customers counts as working time — include it in the hours. '
  + 'Ordinary commuting does not: home to the first job, and the last job home.';

/** The same rule in the cleaner's own words, on their own screen. */
export const TRAVEL_IS_WORKING_TIME_CLEANER =
  'Include the time you spend travelling between customers — that counts as work. '
  + 'Getting to your first job and home from your last one does not.';

/**
 * 🔴 A SEPARATE RULE THE APP DOES NOT TRACK, flagged rather than implemented
 * (`CLAUDE.md` §5 — say the obligation at the moment it is touched).
 *
 * The sentences above are about the **minimum wage**. The **Working Time
 * Regulations** — the 48-hour weekly average, rest breaks, the night-work average
 * — draw the line in a different place: for a worker with **no fixed workplace**,
 * European case law (Tyco, C-266/14) treats travel from home to the first
 * assignment and back from the last as working time for those purposes.
 *
 * ⚠️ Which means the same journey can count for the 48-hour limit and not for the
 * minimum wage. That is not an inconsistency in this app — it is two rules with
 * two different purposes, and it is exactly the sort of thing that gets "corrected"
 * by somebody who has read only one of them.
 *
 * ⛔ **Not modelled, and not to be modelled on assumption.** Whether ACHU's
 * cleaners count as having no fixed workplace is a judgement about how the work
 * actually happens, and the answer changes the 48-hour figure for everybody. It
 * belongs with the accountant. Recorded so that the next person to touch the
 * night-work or hours screens finds it here instead of deciding it themselves.
 */
export const COMMUTING_RULE_DIFFERS_FOR_WORKING_TIME_LIMITS =
  'For the 48-hour weekly limit the rule can be wider than this — a worker with no fixed workplace may have '
  + 'the journey to their first job counted too. ACHU does not track that; check it with the accountant '
  + 'before relying on the hours here for anything but pay.';

