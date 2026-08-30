/**
 * Sesiunea 55 (ACHU-252) — the in-app user manual.
 *
 * Owner asked for one after a night in which he pressed a one-tap, irreversible
 * button without knowing what it did, and separately asked how invoicing worked
 * for a feature that had none. Both are the same problem: the app knows things
 * about itself that the people running the business do not.
 *
 * ─── Why the text lives here and not in a document ────────────────────────
 * Offered a Word/PDF manual or in-app help, the owner chose in-app. That is the
 * right answer for a two-person business: a separate document goes stale the
 * first time a screen changes, and nobody reopens it. Help attached to the screen
 * is read at the moment it is needed, and it sits in the same repository as the
 * code, so a change that makes it wrong is a change someone is editing anyway.
 *
 * ─── What goes in a topic, and what does not ──────────────────────────────
 * Not a description of the buttons. Anybody can see the buttons. What they cannot
 * see is:
 *
 *   - which actions CANNOT be undone;
 *   - which figures come from somewhere else and are therefore only as right as
 *     that other place;
 *   - the business rule behind a number, when the office has to quote it aloud.
 *
 * Every `warnings` entry below is a real consequence, most of them learned the
 * hard way and traceable to a session in docs/JURNAL.md. None is a
 * generic caution — a warning that is usually irrelevant stops being read, which
 * is the same lesson the payroll screen already had to learn.
 *
 * Written in English, matching the rest of the app since ACHU-248 (the owner's
 * decision on 30/07/2026), and in the plainest words that stay accurate: neither
 * of the two people using it is a developer.
 */

/**
 * Keyed by route path, so the panel can find the right topic without every screen
 * having to pass its own key in. Adding a screen without adding a topic simply
 * hides the button — a missing entry must never break a page.
 */
import type { HelpTopic } from './helpTopic';
export type { HelpTopic } from './helpTopic';
import { HELPTOPICSWORK } from './helpTopicsWork';
import { HELPTOPICSMONEY } from './helpTopicsMoney';
import { HELPTOPICSCLIENTS } from './helpTopicsClients';
import { HELPTOPICSTEAM } from './helpTopicsTeam';
import { HELPTOPICSSETUP } from './helpTopicsSetup';

/**
 * 🔴 **TEXTUL A IEȘIT DE AICI** (Sesiunea 146) — în cinci fișiere, pe secțiunile din meniu. Fișierul
 * ăsta ținea și mecanismul, și toate subiectele, și ajunsese la 485 de rânduri: cele 12 ecrane rămase
 * fără ajutor nu încăpeau sub pragul de 500 (`AGENT_RULES` §7.2).
 *
 * ⚠️ Aici rămâne doar **unde se caută** un subiect. Ce se scrie într-unul, mai sus.
 */
export const HELP_TOPICS: Record<string, HelpTopic> = {
  ...HELPTOPICSWORK,
  ...HELPTOPICSMONEY,
  ...HELPTOPICSCLIENTS,
  ...HELPTOPICSTEAM,
  ...HELPTOPICSSETUP,
};
/**
 * Longest-prefix match, so a screen with a sub-path still finds its topic.
 * Returns undefined for a screen with no topic yet — the button then does not
 * appear at all, which is better than an empty panel that looks broken.
 */
export function helpFor(pathname: string): HelpTopic | undefined {
  if (HELP_TOPICS[pathname]) return HELP_TOPICS[pathname];
  const match = Object.keys(HELP_TOPICS)
    .filter(k => k !== '/admin' && pathname.startsWith(`${k}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? HELP_TOPICS[match] : undefined;
}

