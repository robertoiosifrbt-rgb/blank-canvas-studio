import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCalendarEvents, type CalendarEventsResponse, type CalendarEvent } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, CalendarDays, AlertCircle } from 'lucide-react';
import { ukToday, addDays, monthStart, monthEnd } from '@/lib/ukDate';
import { fmt } from '@/lib/format';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';

/**
 * Sesiunea 56 (ACHU-255) — the business calendar.
 *
 * Owner, 31/07/2026: *"fa un calendar care sa includa toate evenimentele... plati
 * joburi etc... si ar fi misto daca am putea sa il folosim gen ca google
 * calendar"*.
 *
 * ─── Why this is not the Schedule page ───────────────────────────────────
 * Schedule answers a WORKFORCE question: who is working when, who is
 * double-booked, who has idle stretches. Every part of it — the per-cleaner
 * columns, the clash arithmetic, the gap detection — needs hours and a person.
 *
 * A payment has neither. Nor does an expense, an invoice due date, or a
 * subscription term running out. Folding them into Schedule would have meant
 * making every field the conflict logic depends on optional, which is how a
 * working calculation quietly starts producing nonsense.
 *
 * So: two screens, one question each, over the same data. The nav says which is
 * which, and the "?" panel on each says it again. The alternative — one screen
 * that does both — was rejected deliberately, not overlooked.
 *
 * ─── The layers ──────────────────────────────────────────────────────────
 * "Like Google Calendar" is, in practice, layers you can switch off. Turning off
 * expenses to see a clean week of work is the whole point, so the toggles are
 * the most prominent control on the screen rather than tucked into a menu.
 *
 * ─── One event kind is not like the others ───────────────────────────────
 * `term-ends` is the only one that has never had a home anywhere in the app. A
 * prepaid 12-month subscription simply stops, and the first sign of a missed
 * renewal is the customer asking why nobody came. That is why it is on by
 * default and coloured as a warning rather than as information.
 */

type Kind = 'job' | 'payment' | 'invoice-due' | 'expense' | 'term-ends';

const LAYERS: { kind: Kind; label: string; dot: string; chip: string }[] = [
  { kind: 'job', label: 'Jobs', dot: 'bg-sky-500', chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30' },
  { kind: 'payment', label: 'Payments', dot: 'bg-emerald-500', chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  { kind: 'invoice-due', label: 'Invoices due', dot: 'bg-violet-500', chip: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30' },
  { kind: 'expense', label: 'Expenses', dot: 'bg-slate-500', chip: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30' },
  { kind: 'term-ends', label: 'Terms ending', dot: 'bg-amber-500', chip: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/40' },
];

const CHIP = Object.fromEntries(LAYERS.map(l => [l.kind, l.chip])) as Record<Kind, string>;

/**
 * ACHU-258 — money out has to look like money out.
 *
 * A refund arrives with a negative amount. Rendered in the same green as a
 * receipt it read as income, on the same day, with nothing to tell them apart —
 * which on a calendar of a business's money is the worst kind of wrong, because
 * it is quietly plausible.
 *
 * £0 is shown as nothing rather than "£0.00": a job charged nothing has no money
 * to report, and "£0.00" is noise on a cell that is already tight.
 */
function moneyLabel(amount: number | null | undefined): string | null {
  if (amount == null || amount === 0) return null;
  return amount < 0 ? `−${fmt(Math.abs(amount))}` : fmt(amount);
}

function moneyTone(amount: number | null | undefined): string {
  return amount != null && amount < 0 ? 'text-destructive' : '';
}

/** Monday-start, matching Schedule and `schedulePolicy.startOfWeekIso` on the server. */
function startOfWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return addDays(iso, -back);
}

function monthGridRange(iso: string): { from: string; to: string } {
  // Whole weeks, so the grid has no ragged first and last row — the leading and
  // trailing days belong to neighbouring months and are drawn faded.
  const from = startOfWeek(monthStart(iso));
  const lastRowStart = startOfWeek(monthEnd(iso));
  return { from, to: addDays(lastRowStart, 6) };
}

function monthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Beyond this a single day stretches its row and pushes the month off screen. */
const MAX_PER_CELL = 3;

const DOT = Object.fromEntries(LAYERS.map(l => [l.kind, l.dot])) as Record<Kind, string>;

/** "Wed 29 July" — the agenda has room for it, and a bare number does not help in a list. */
function longDayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

/**
 * ACHU-416 (Sesiunea 92) — the phone had no calendar on it.
 *
 * Archana, 05/08/2026: **„Si la calendar. Vreau un calendar afisat."**
 *
 * She was right, and the screen was doing it on purpose. ACHU-257 replaced the
 * seven-column grid below `md` with an agenda list, because at ~50px a day a
 * customer called "Denisa" rendered as "deni…" and the owner sent two
 * screenshots and the word "???". The list fixed the legibility. It also
 * removed the calendar — and then dropped every day with nothing on it, so on a
 * business with no jobs booked yet the Calendar screen is **completely blank**.
 *
 * ─── What was actually illegible ─────────────────────────────────────────
 * Not the grid. The EVENT TEXT inside the grid. A day number and a few coloured
 * dots fit 46px comfortably; "10:00 Denisa Ionescu · £100.00" never will.
 *
 * So the phone gets a real month grid that carries **only** what fits — the
 * number, and one dot per kind of thing happening — and tapping a day opens
 * that day in the agenda underneath, where the full name and the full amount
 * already live untruncated. The two halves answer the two different questions:
 * *what does this month look like* and *what exactly is on this day*.
 *
 * ⚠️ No event title, time or amount may ever be drawn inside a phone cell.
 * That is the whole of ACHU-257 and a test asserts it.
 */
const MAX_DOTS_PER_CELL = 3;

/** The distinct kinds on a day, in layer order — one dot each, not one per event. */
function kindsOn(events: { kind: string }[]): Kind[] {
  return LAYERS.map(l => l.kind).filter(k => events.some(e => e.kind === k));
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(ukToday());
  const [view, setView] = useState<'month' | 'week'>('month');
  const [off, setOff] = useState<Set<Kind>>(new Set());
  /** Phone only: which day the agenda underneath the grid is showing. */
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const req = useTrackedRequest<CalendarEventsResponse>();
  const data = req.data;

  const range = useMemo(() => (view === 'month'
    ? monthGridRange(anchor)
    : { from: startOfWeek(anchor), to: addDays(startOfWeek(anchor), 6) }), [anchor, view]);

  const load = useCallback(() => {
    // Every layer is always fetched; switching one off hides it locally. A
    // request per toggle would make the calendar flicker on a phone for no gain,
    // and the whole range is one bounded query either way.
    req.fire(() => getCalendarEvents({ from: range.from, to: range.to }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => (data?.events ?? []).filter(e => !off.has(e.kind as Kind)),
    [data, off],
  );

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of visible) {
      const list = m.get(e.date) ?? [];
      list.push(e);
      m.set(e.date, list);
    }
    return m;
  }, [visible]);

  const days: string[] = data?.range?.days ?? [];
  const today = ukToday();

  /**
   * ⚠️ DERIVED, not cleared in an effect. Stepping to another month must not
   * leave the agenda filtered to a day that is no longer drawn above it — the
   * selection would be invisible and impossible to unclick. Clearing it in an
   * effect would work, but it costs a second render and the linter is right to
   * object; asking whether the picked day is still on screen answers the same
   * question without storing the answer. It also means stepping away and back
   * returns you to where you were, which storing-and-clearing would have lost.
   */
  const selectedDay = pickedDay && days.includes(pickedDay) ? pickedDay : null;
  const currentMonth = monthStart(anchor).slice(0, 7);

  function step(direction: 1 | -1) {
    setAnchor(a => (view === 'month'
      // Via the 1st, so stepping from the 31st does not skip a short month.
      ? addDays(direction === 1 ? monthEnd(a) : addDays(monthStart(a), -1), direction === 1 ? 1 : 0)
      : addDays(a, direction * 7)));
  }

  function toggle(kind: Kind) {
    setOff(prev => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind); else next.add(kind);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<CalendarDays className="h-5 w-5" />}
        title="Calendar"
        actions={<RefreshButton onRefresh={load} />}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous" title="Previous" onClick={() => step(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAnchor(ukToday())}>Today</Button>
        <Button variant="outline" size="icon" aria-label="Next" title="Next" onClick={() => step(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="font-medium px-2">{monthLabel(anchor)}</span>
        <div className="ml-auto flex gap-1">
          <Button variant={view === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setView('month')}>Month</Button>
          <Button variant={view === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setView('week')}>Week</Button>
        </div>
      </div>

      {/* The layer switches. Deliberately the loudest control on the screen:
          turning expenses off to see a clean week of work is the main reason
          somebody comes here twice. */}
      <div className="flex flex-wrap gap-2">
        {LAYERS.map(l => {
          const on = !off.has(l.kind);
          const count = data?.summary?.[l.kind] ?? 0;
          return (
            <button
              key={l.kind}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(l.kind)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
                on ? 'border-border bg-card' : 'border-dashed border-border bg-muted/40 text-muted-foreground line-through'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${on ? l.dot : 'bg-muted-foreground/40'}`} />
              {l.label}
              <span className="text-muted-foreground">{count}</span>
            </button>
          );
        })}
      </div>

      {req.error && (
        <Card className="border-destructive/60">
          <CardContent className="pt-5 text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
            <span>{req.error}</span>
          </CardContent>
        </Card>
      )}

      {req.loading && !data && <Skeleton className="h-96 w-full" />}

      {/*
        ACHU-257. Two layouts, and the phone one is not a fallback.

        The first version was a seven-column grid at every width. On a phone that
        is roughly fifty pixels per day, so a customer called "Denisa" rendered as
        "deni…" and an amount as "£10…". The owner sent two screenshots and the
        word "???" — the calendar was legible only to whoever built it on a laptop.

        A grid cannot be fixed by shrinking type: seven columns simply do not fit
        a hand. So below md the same events are drawn as a LIST — one day per
        block, full names, full amounts — and the grid returns from md up, where
        it is genuinely the better shape for spotting a busy week at a glance.

        Days with nothing on them are left out of the list on purpose. In the
        grid an empty cell shows the shape of the month, which is the point of a
        grid; in a list it is a blank row you scroll past to reach the work.

        ⚠️ The list runs NEWEST DAY FIRST (owner, 01/08/2026: "Calendarul trebuie
        intors. Sa afiseze ultimele data primele"). Only the list is reversed — the
        grid from md up keeps calendar order, because a month laid out backwards
        is not a month. The two are the same data in two shapes, and only one of
        them is a sequence you scroll.
      */}
      {data && (
        <>
          {/* ── Phone: the grid, then the agenda ───────────────────────── */}
          {/* ACHU-416. The calendar Archana asked for. Only a number and dots
              go in a cell — see the note on MAX_DOTS_PER_CELL for why any event
              text here would re-open ACHU-257. */}
          <div className="md:hidden rounded-lg border border-border overflow-hidden" data-testid="calendar-grid-phone">
            <div className="grid grid-cols-7 bg-muted/50 text-[10px] font-medium">
              {WEEKDAYS.map(d => (
                // One letter is all that fits, and the position in the row is
                // what actually tells you which day it is.
                <div key={d} className="px-0 py-1 text-center">{d.slice(0, 1)}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map(day => {
                const events = byDay.get(day) ?? [];
                const kinds = kindsOn(events);
                const isToday = day === today;
                const isSelected = day === selectedDay;
                const otherMonth = view === 'month' && day.slice(0, 7) !== currentMonth;
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${longDayLabel(day)} — ${events.length} event${events.length === 1 ? '' : 's'}`}
                    onClick={() => setPickedDay(d => (d === day ? null : day))}
                    className={`flex min-h-12 flex-col items-center gap-1 border-t border-r border-border py-1.5 ${
                      otherMonth ? 'bg-muted/30' : ''
                    } ${isSelected ? 'bg-primary/10 ring-2 ring-inset ring-primary' : ''} ${
                      isToday && !isSelected ? 'ring-2 ring-inset ring-primary/50' : ''
                    }`}
                  >
                    <span className={`text-xs leading-none ${otherMonth ? 'text-muted-foreground' : ''} ${
                      isToday ? 'font-semibold' : ''
                    }`}>
                      {Number(day.slice(8, 10))}
                    </span>
                    {/* Fixed height whether or not there are dots, so the rows
                        do not jump about as you step through the months. */}
                    <span className="flex h-1.5 items-center gap-0.5">
                      {kinds.slice(0, MAX_DOTS_PER_CELL).map(k => (
                        <span key={k} className={`h-1.5 w-1.5 rounded-full ${DOT[k]}`} />
                      ))}
                      {kinds.length > MAX_DOTS_PER_CELL && (
                        <span className="text-[8px] leading-none text-muted-foreground">+</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDay && (
            <div className="md:hidden flex items-center gap-2 text-xs">
              <span className="font-medium">{longDayLabel(selectedDay)}</span>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setPickedDay(null)}>
                Show the whole period
              </Button>
            </div>
          )}

          <div className="md:hidden space-y-3" data-testid="calendar-agenda">
            {/* A tapped day is answered even when the answer is "nothing". Falling
                back to the full list would look like the tap had not registered. */}
            {selectedDay && (byDay.get(selectedDay) ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing on this day.</p>
            )}
            {/* `.slice()` first: `days` is a memo shared with the grid below, and
                reversing it in place would silently flip the month as well. */}
            {days.slice().reverse()
              .filter(d => (selectedDay ? d === selectedDay : true))
              .filter(d => (byDay.get(d) ?? []).length > 0).map(day => (
              <div key={day} className="rounded-lg border border-border overflow-hidden">
                <div className={`px-3 py-1.5 text-xs font-medium ${
                  day === today ? 'bg-primary text-primary-foreground' : 'bg-muted/60'
                }`}>
                  {longDayLabel(day)}{day === today ? ' · Today' : ''}
                </div>
                <div className="divide-y divide-border">
                  {(byDay.get(day) ?? []).map(e => (
                    <button
                      key={`${e.kind}-${e.id}`}
                      type="button"
                      onClick={() => navigate(e.link)}
                      className="w-full text-left px-3 py-2 flex items-start gap-2.5 hover:bg-muted/50"
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[e.kind as Kind]}`} />
                      <span className="min-w-0 flex-1">
                        {/* No truncation here at all. The whole reason this
                            layout exists is that a name has to be readable. */}
                        <span className="block text-sm font-medium">
                          {e.time ? `${e.time} · ` : ''}{e.title}
                        </span>
                        {e.subtitle && (
                          <span className="block text-xs text-muted-foreground">{e.subtitle}</span>
                        )}
                      </span>
                      {moneyLabel(e.amount) && (
                        <span className={`shrink-0 text-sm tabular-nums ${moneyTone(e.amount)}`}>
                          {moneyLabel(e.amount)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ── Laptop and up: the grid ────────────────────────────────── */}
          <div className="hidden md:block rounded-lg border border-border overflow-hidden" data-testid="calendar-grid">
            <div className="grid grid-cols-7 bg-muted/50 text-xs font-medium">
              {WEEKDAYS.map(d => <div key={d} className="px-2 py-1.5 text-center">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {days.map(day => {
                const events = byDay.get(day) ?? [];
                const isToday = day === today;
                const otherMonth = view === 'month' && day.slice(0, 7) !== currentMonth;
                // Capped, because one busy day used to stretch its row and push
                // the rest of the month off the screen — the 29th in the owner's
                // screenshot carried eight events and swallowed the whole grid.
                const shown = events.slice(0, MAX_PER_CELL);
                const hidden = events.length - shown.length;
                return (
                  <div
                    key={day}
                    className={`min-h-24 border-t border-r border-border p-1 space-y-1 ${
                      otherMonth ? 'bg-muted/30' : ''
                    } ${isToday ? 'ring-2 ring-inset ring-primary/50' : ''}`}
                  >
                    <div className={`text-xs px-1 ${otherMonth ? 'text-muted-foreground' : ''} ${isToday ? 'font-semibold' : ''}`}>
                      {Number(day.slice(8, 10))}
                    </div>
                    {shown.map(e => (
                      <button
                        key={`${e.kind}-${e.id}`}
                        type="button"
                        onClick={() => navigate(e.link)}
                        title={`${e.title}${e.subtitle ? ` — ${e.subtitle}` : ''}`}
                        className={`w-full text-left rounded border px-1.5 py-1 text-[11px] leading-tight ${CHIP[e.kind as Kind]}`}
                      >
                        <span className="block truncate font-medium">
                          {e.time ? `${e.time} ` : ''}{e.title}
                        </span>
                        {moneyLabel(e.amount) && (
                          <span className={`block truncate ${moneyTone(e.amount)}`}>{moneyLabel(e.amount)}</span>
                        )}
                      </button>
                    ))}
                    {hidden > 0 && (
                      // Switches that day to the week view rather than opening a
                      // popover: the week has room to show them all, and it is a
                      // place the user already knows how to get back from.
                      <button
                        type="button"
                        onClick={() => { setAnchor(day); setView('week'); }}
                        className="w-full text-left px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        +{hidden} more
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {data && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing on the calendar for this period
          {off.size > 0 ? ' with the layers you have switched on.' : '.'}
        </p>
      )}
    </div>
  );
}

