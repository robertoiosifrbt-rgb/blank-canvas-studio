/**
 * WHICH ADMIN SCREENS THE TWO NARROW PAYROLL ROLES MAY OPEN (ACHU-357, Sesiunea 83).
 *
 * 🔴 READ THIS BEFORE TRUSTING IT: this file is NOT a security boundary. The
 * authority is `backend/src/middleware/authorise.ts`, which refuses the request
 * itself. This list only decides which navigation rows to draw.
 *
 * ⚠️ That means the two lists CAN drift, and it is worth being explicit about what
 * happens when they do, because the codebase has been bitten by a second copy of a
 * rule before — `src/test/mockAuth.ts` carried its own `requireRole` (ACHU-348) and
 * a viewer able to write would have passed the whole suite.
 *
 * The difference here is the DIRECTION of the failure. That copy was a second
 * *enforcement* point, so a drift meant an unenforced rule. This copy enforces
 * nothing:
 *
 * - This list too NARROW → a nav row is missing. Somebody says "I can't see the
 *   reports" and it is fixed in a line.
 * - This list too WIDE → the row is drawn, the person clicks it, and the SERVER
 *   refuses with the sentence from `NARROW_ROLE_MEANS`. Visibly, immediately, to
 *   the person best placed to report it.
 *
 * Neither drift exposes a wage. That is the property that makes one copy
 * acceptable here and made it unacceptable there — not the fact that this one is
 * "only UI".
 */

export type NarrowRole = 'FinanceOnly' | 'HROnly';

/**
 * Paths each narrow role may open, matched as a prefix against the current route.
 *
 * ⚠️ Ordered as the person will meet them, because the FIRST entry is also where
 * the role lands after logging in. `/admin` itself is the Dashboard, which both
 * roles are refused — so without a landing rule the first thing a new finance
 * account sees would be a permission error on the home page, and the reasonable
 * conclusion is that the account is broken.
 */
export const NARROW_ROLE_SCREENS: Record<NarrowRole, readonly string[]> = {
  FinanceOnly: [
    '/admin/payroll-runs',
    '/admin/payroll-reports',
    '/admin/payroll-simulator',
  ],
  HROnly: [
    '/admin/payroll-people',
    '/admin/timesheets',
    '/admin/leave',
    '/admin/sickness',
    '/admin/family-leave',
  ],
};

/** Human name for the role, for the banner that explains why the menu is short. */
export const NARROW_ROLE_LABELS: Record<NarrowRole, string> = {
  FinanceOnly: 'Finance only',
  HROnly: 'HR only',
};

/**
 * One sentence shown in the sidebar, so a short menu reads as a decision rather
 * than as a half-loaded page.
 *
 * ⚠️ It says what the account IS for, not what it is missing. A list of everything
 * withheld invites the reading that something went wrong with the account.
 */
export const NARROW_ROLE_BANNERS: Record<NarrowRole, string> = {
  FinanceOnly: 'This account covers payroll money: runs, reports and the simulator.',
  HROnly: 'This account covers employee records: details, timesheets, holiday, sickness and family leave.',
};

export function isNarrowRole(role: string | null | undefined): role is NarrowRole {
  return role === 'FinanceOnly' || role === 'HROnly';
}

/**
 * May this role open this path?
 *
 * ⚠️ Prefix matching, so `/admin/payroll-runs/abc123` is admitted by the
 * `/admin/payroll-runs` entry — a run's own page is the same screen. Anchored with
 * the boundary check so `/admin/leave` cannot accidentally admit a future
 * `/admin/leave-policies`, which would be a different screen wearing a similar name.
 */
export function narrowRoleMayOpen(role: NarrowRole, path: string): boolean {
  return NARROW_ROLE_SCREENS[role].some(allowed => path === allowed || path.startsWith(`${allowed}/`));
}

/** Where the role lands: its first screen, never the Dashboard it cannot open. */
export function narrowRoleHome(role: NarrowRole): string {
  return NARROW_ROLE_SCREENS[role][0];
}

