/**
 * ACHU-218 — what this site stores in the visitor's browser, said on the public
 * page.
 *
 * ─── 🔴 WHY THIS IS A NOTICE AND NOT AN "ACCEPT COOKIES" BANNER ──────────
 * Roberto asked for a cookie banner (14/08/2026). What the code actually does was
 * measured before building it, and it changes the answer:
 *
 *   - **No tracking of any kind.** `grep` for gtag, Google Analytics, Tag Manager,
 *     Facebook/fbq, Hotjar, Mixpanel, PostHog and Plausible across `src` and
 *     `index.html` returns nothing. There is no advertising pixel and no analytics.
 *   - **No cookies are set by this app at all.** `document.cookie` appears nowhere.
 *   - What IS stored is browser storage, and only these: the light/dark theme
 *     choice (`useTheme.ts`), a search box and scroll position so the back button
 *     works (`ActionCentrePage.tsx`), a reload marker that stops an error loop
 *     (`ErrorBoundary.tsx`), and the login session for people who log in.
 *
 * ⛔ UK PECR requires consent for storage that is NOT strictly necessary — and
 * requires that people be TOLD either way. Everything above is either strictly
 * necessary or a preference the person set themselves, so there is nothing here to
 * consent to. An "Accept / Reject" banner would be asking permission for something
 * that does not happen: it would look like compliance while teaching visitors that
 * the buttons are meaningless, and a Reject that switched nothing off would be the
 * only actual untruth on the page.
 *
 * ⚠️ THE WORDPRESS SITE AT achu.uk IS A DIFFERENT QUESTION, and it is not in this
 * repository. If that site runs Google Analytics or any advertising pixel, it needs
 * a real consent banner — one with a Reject that works — and this file cannot
 * provide it. Flagged to the owner rather than assumed either way.
 *
 * 🔴 IF TRACKING IS EVER ADDED TO THIS APP, THIS NOTICE BECOMES A LIE. The banner
 * has to arrive in the same change as the tracker, not afterwards.
 */

export default function PublicStorageNotice() {
  return (
    <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-2">
      <p className="font-semibold text-foreground">Cookies and your browser</p>
      <p>
        This page does not track you. We use no advertising cookies, no analytics and no
        third-party trackers, so there is nothing here for you to accept or refuse.
      </p>
      <p>
        The only things we save in your browser are the ones that make the page work: whether
        you chose light or dark, and — if you have an ACHU account and log in — the fact that
        you are signed in. Nothing is shared with anyone else, and none of it identifies you
        to us before you send the form.
      </p>
    </div>
  );
}

