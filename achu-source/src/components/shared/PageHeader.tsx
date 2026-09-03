import type { ReactNode } from 'react';

/**
 * ACHU-414 (Sesiunea 92) — the admin page header, on a phone.
 *
 * Archana photographed five screens on an iPhone. Every one of them was the
 * same header written two slightly different ways, and both ways broke:
 *
 *   1. `flex flex-wrap items-center gap-2` with a leading icon and a
 *      `mr-auto` title block — Sold time vs worked time, Timesheets, Holiday
 *      and leave. The title block is wide, so it wraps, and it takes the
 *      whole line with it: the icon is left **stranded on a line of its own**
 *      above the heading, and the buttons land on a third line. The icon
 *      reads as a stray artefact rather than as part of the title.
 *
 *   2. `flex items-center justify-between gap-4` with no wrap at all — User
 *      Accounts, Audit History. Nothing can move to a second line, so the
 *      heading is squeezed into two lines *and* the last button is
 *      **clipped off the right edge of the screen**. Reproduced in Chromium
 *      at 390px: 413px of content in a 354px box, and the document itself
 *      scrolls sideways.
 *
 * ─── Why one component and not `flex-wrap` sprinkled on each page ────────
 * Adding `flex-wrap` to (2) fixes the clipping and turns it into (1) — the
 * same stranded-icon layout, discovered again later on a different screen.
 * The two shapes are one thing written twice, so the fix is one thing.
 *
 * ─── What the layout guarantees ──────────────────────────────────────────
 * The icon and the title live in the **same** flex item, so no wrap can ever
 * separate them. That item is `basis-full` below `sm`, which means the
 * actions are pushed onto their own line deliberately rather than by
 * accident — a wrap that is chosen is a layout, a wrap that happens is a
 * bug. From `sm` up, `basis-auto` puts everything back on one row, which is
 * what these screens already looked like on a desktop.
 *
 * The actions group wraps internally too. Three buttons that fit a 390px
 * phone in one row is luck; four will not, and this is what stops the fourth
 * disappearing off the edge instead of dropping below.
 *
 * ⚠️ `min-w-0` on the title column is load-bearing. A flex item's default
 * `min-width: auto` refuses to shrink below its content, which is how a long
 * unbroken word (a customer name, an email) pushes a header wider than the
 * screen even when everything is allowed to wrap.
 */
export default function PageHeader({
  title,
  description,
  icon,
  actions,
  as: Heading = 'h1',
  titleClassName = 'text-xl font-semibold',
}: {
  title: ReactNode;
  /** The sentence under the title. Optional — several screens carry none. */
  description?: ReactNode;
  /** Rendered to the left of the title, and never separated from it. */
  icon?: ReactNode;
  /** Buttons. They wrap among themselves rather than overflowing. */
  actions?: ReactNode;
  /** Kept per page so existing heading levels and tests are unchanged. */
  as?: 'h1' | 'h2';
  /** Kept per page so the two title sizes already in use are unchanged. */
  titleClassName?: string;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
      <div className="flex min-w-0 basis-full items-start gap-2 sm:flex-1 sm:basis-auto">
        {icon && <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>}
        <div className="min-w-0">
          <Heading className={titleClassName}>{title}</Heading>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

