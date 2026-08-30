import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * ACHU-422 (Sesiunea 93) — `<input type="time">`, drawn by us instead of by the
 * browser. The time twin of `DateField`, and deliberately built the same way.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────
 * Archana photographed the Edit Job dialog on an iPhone: "Scheduled Start" and
 * "Scheduled Finish" sit in a two-column grid, both empty, and the Finish box
 * runs off the right edge of the screen. That is not a new bug — it is
 * **ACHU-415 again, one control over**. A native time input carries a
 * user-agent MIN-width that beats `width: 100%`, so in a narrow grid cell it
 * refuses to shrink and pushes out of its column. Empty, it also draws nothing
 * at all on iOS, which is why both boxes read as blank grey rectangles.
 *
 * ⛔ The fix is NOT `appearance: none` and NOT a CSS width rule. Both were tried
 * on the date field (ACHU-415, ACHU-417) and both shipped broken, twice, because
 * they were guesses about an engine this sandbox cannot run — the proxy blocks
 * the WebKit download. See DateField.tsx's header for that whole story.
 *
 * ─── So nothing engine-drawn is on screen ────────────────────────────────
 * The text you SEE is a `<div>` we render — "09:00", or `hh:mm` when empty. The
 * thing you TAP is the real `<input type="time">`, stretched over the box at
 * `opacity: 0`. Opacity does not affect hit-testing, so the native picker (the
 * iOS wheel, the Chrome spinner) opens exactly as before, and the input remains
 * what a form and a screen reader see.
 *
 * ⚠️ What that buys: every pixel is ordinary DOM, so a test running here can
 * check it on the engine that actually has the bug. There is no iOS-shaped hole
 * left in the verification.
 *
 * ⛔ Do not "simplify" this back to a plain styled input.
 */

export default function TimeField({
  value,
  onChange,
  id,
  className,
  placeholder = 'hh:mm',
  ...rest
}: React.ComponentProps<'input'> & { value: string }) {
  const [focused, setFocused] = useState(false);
  const disabled = Boolean(rest.disabled);

  return (
    // overflow-hidden: an engine that insists on a minimum width for the native
    // control cannot then widen the page, because the control is absolutely
    // positioned inside a box that clips it. That was ACHU-415's whole bug.
    <div className="relative overflow-hidden rounded-md">
      <input
        {...rest}
        id={id}
        type="time"
        value={value}
        onChange={onChange}
        onFocus={e => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={e => { setFocused(false); rest.onBlur?.(e); }}
        className={cn(
          'absolute inset-0 z-10 h-full w-full opacity-0',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      />
      <div
        // aria-hidden: a picture of the input's value, not a second control.
        aria-hidden="true"
        className={cn(
          'flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm',
          focused && 'ring-2 ring-ring ring-offset-2',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        {/* Shown verbatim: the value is already "HH:MM" 24-hour, which is how
            the rest of the app displays a scheduled time (jobs, timesheets,
            the schedule grid). Reformatting to 12-hour here would make one
            control disagree with every list that reads from the same column. */}
        {value
          ? value
          : <span className="text-muted-foreground">{placeholder}</span>}
      </div>
    </div>
  );
}

