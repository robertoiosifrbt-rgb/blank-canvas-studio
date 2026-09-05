// Keeping the focus inside a dialog.
//
// `aria-modal="true"` promises that the rest of the page is inert. Nothing in
// a plain div makes that true, so the promise has to be kept by hand — and a
// promise the code does not support is one the plan forbids.

/** What can be tabbed to. Disabled controls and hidden ones are not. */
export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Where Tab should land, or null to let the browser handle it.
 *
 * Only the two ends need catching: from the last one forwards, back to the
 * first; from the first one backwards, round to the last. Anything with the
 * focus adrift outside the dialog is pulled back in, which is the case that
 * matters after clicking the backdrop or coming back to the tab.
 */
export function nextFocus<T>(
  order: readonly T[],
  active: T | null,
  back: boolean,
): T | null {
  const first = order[0]
  const last = order[order.length - 1]
  if (first === undefined || last === undefined) return null

  const at = active === null ? -1 : order.indexOf(active)
  if (at === -1) return back ? last : first
  if (back && at === 0) return last
  if (!back && at === order.length - 1) return first
  return null
}
