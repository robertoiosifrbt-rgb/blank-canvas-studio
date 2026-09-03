import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * ACHU-418 (Sesiunea 92) — stop depending on how any browser draws a date field.
 *
 * ─── Why this is the third attempt ───────────────────────────────────────
 * ACHU-415 was a CSS rule aimed at a user-agent behaviour I had guessed at.
 * ACHU-417 kept the native control and layered a placeholder over it, which
 * was better but still rested on one unverified assumption: that iOS draws
 * *nothing* in an empty date field, so my overlay would be the only text there.
 *
 * Both times the honest position was the same — **the only engine that shows
 * the bug is one this sandbox cannot run.** The proxy blocks the WebKit
 * download, so there is no way to look. Asking Archana to check was not a
 * workaround; it was me handing my verification job to the person who reported
 * the bug, three times in a row.
 *
 * ─── So: nothing engine-drawn is on screen any more ──────────────────────
 * The text you SEE is an ordinary `<div>` I render — the formatted date, or
 * `dd/mm/yyyy` when empty. The thing you TAP is the real `<input type="date">`,
 * stretched over the box at `opacity: 0`. Opacity does not affect hit-testing,
 * so the native picker — the iOS wheel, the Chrome calendar — opens exactly as
 * before.
 *
 * ⚠️ What that buys: **every pixel of this control is now something a test here
 * can see.** Whether the date shows, what it says, how wide it is, whether a
 * tap reaches the input — all of it is ordinary DOM, identical on every engine,
 * because no engine is drawing any of it. There is no iOS-shaped hole left in
 * the verification.
 *
 * ⛔ Do not "simplify" this back to a plain styled input. The plain version is
 * what shipped twice and was photographed broken twice.
 */

/** "3 Aug 2026" — matching what the app already shows elsewhere for these. */
function display(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

export default function DateField({
  value,
  onChange,
  id,
  className,
  placeholder = 'dd/mm/yyyy',
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
        type="date"
        value={value}
        onChange={onChange}
        onFocus={e => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={e => { setFocused(false); rest.onBlur?.(e); }}
        // Invisible, but still the real control: it takes the tap, opens the
        // native picker, and is what a screen reader and a form see.
        className={cn(
          'absolute inset-0 z-10 h-full w-full opacity-0',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      />
      <div
        // aria-hidden: this is a picture of the input's value, not a second
        // control. The input above carries the label and the value.
        aria-hidden="true"
        className={cn(
          'flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm',
          focused && 'ring-2 ring-ring ring-offset-2',
          // The real input is invisible, so its disabled look has to be drawn
          // here too — otherwise a locked field is indistinguishable from a
          // live one (SicknessPage disables the end date while "still off").
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        {value
          ? display(value)
          : <span className="text-muted-foreground">{placeholder}</span>}
      </div>
    </div>
  );
}

