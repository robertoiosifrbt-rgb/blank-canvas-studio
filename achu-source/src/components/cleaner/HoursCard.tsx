/**
 * A cleaner records their own hours (ACHU-268, Sesiunea 81).
 *
 * ─── Why it lives on the Today tab, and not in a sixth tab ────────────────
 * `CleanerTabs` already carries five, and its own header explains that five
 * icons is the comfortable maximum on a phone. More to the point, this is the
 * one thing somebody does DURING a shift — the same reason Today is first and
 * Pay is last. Clocking in belongs where the day's work is, not two taps away.
 *
 * ─── The four rules this screen has to hold, without lecturing ────────────
 * 1. 🔴 **REPLACED 09/08/2026 (ACHU-498).** Hours are no longer the cleaner's to
 *    change or delete at all — the server sends `canEdit: false` on every entry
 *    and the screen obeys it rather than deciding for itself. In its place they
 *    may leave a NOTE, on any entry whatever its status, and the office cannot
 *    approve an entry carrying one until it confirms having read it.
 *    📜 Was: "editable until the office approves".
 * 2. A forgotten clock-out leaves the shift OPEN. The card says so plainly and
 *    offers no way to make it disappear: the office completes it.
 * 4. Hours are a DRAFT until approved, and only approved hours are paid. Said
 *    once, calmly, where somebody will read it — not buried in a tooltip.
 * 3 is the absence of a location check; there is nothing on screen for it, and
 * that is the point.
 *
 * ⚠️ Nothing here computes hours. The server returns `workedHours` already
 * calculated by the same policy the office and the payslip use. A second
 * calculation in the browser would drift, and the one on the phone is the one
 * somebody would believe.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  getMyTimesheets, clockIn, clockOut, pauseShift, resumeShift, deleteMyTimesheet, editMyTimesheet,
  type MyTimesheetsResponse, type MyTimesheetEntry,
} from '@/lib/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, Info, Loader2, MessageSquarePlus, Pause, Play, Square, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
// ACHU-368. One source for the sentence, shared with the office screen.
import { TRAVEL_IS_WORKING_TIME_CLEANER } from '@/lib/workingTimeWording';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';

/**
 * 🔴 ACHU-401, felia 26 — forma vine acum de la RUTĂ, nu scrisă lângă ecran. Copia de dinainte
 * era corectă, dar era o copie: exact tiparul care a produs ACHU-741, unde un tip scris de mână
 * numea un câmp pe care ruta nu-l trimite.
 */
type Entry = MyTimesheetEntry;

const STATUS_STYLE: Record<string, string> = {
  Draft: 'text-muted-foreground',
  Approved: 'text-green-700 dark:text-green-500',
  Disputed: 'text-amber-700 dark:text-amber-500',
};

export default function HoursCard({ onChanged }: { onChanged?: () => void }) {
  const [d, setD] = useState<MyTimesheetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * ACHU-498. The entry whose note is being written, and the text being written.
   * Held here rather than inside the row so the dialog survives the list
   * refreshing underneath it — a note half-typed when the poll lands is exactly
   * the one somebody would not type twice.
   */
  const [noteFor, setNoteFor] = useState<Entry | null>(null);
  const [noteText, setNoteText] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await getMyTimesheets();
      setD(r);
      setError(null);
    } catch (e) {
      setError(errMsg(e) ?? 'Could not load your hours.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /**
   * One guard for every action. Two taps on Clock in would otherwise race, and
   * the second would come back as "you are already clocked in" — a refusal that
   * is correct and reads like a fault.
   */
  async function run(action: () => Promise<unknown>, done: string) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      toast.success(done);
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(errMsg(e) ?? 'That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">Loading your hours…</CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-destructive">{error}</CardContent>
      </Card>
    );
  }

  const open: Entry | null = d.openShift;
  /**
   * §15 (Sesiunea 160) — un început fără sfârșit **este** starea de pauză, ca pe server
   * (`lib/cleanerBreak.ts`). ⛔ Nu se ghicește din altceva.
   */
  const onBreak = !!open?.pauseStart && !open?.pauseEnd;
  const entries: Entry[] = d.entries ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" /> My hours
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {d.week.start} – {d.week.end}
        </span>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* ── The one button that matters ───────────────────────────── */}
        {open ? (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <p className="text-sm font-medium">
              Clocked in since {open.startTime}
              {open.workDate !== d.period.to && <> on {open.workDate}</>}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {/* Rule 2, said where it applies rather than as a general warning. */}
              This shift stays open until you clock out. If you forget, the office can complete it — nothing is lost.
            </p>
            {/*
              🔴 §15 „Pause job" + „Resume job" (Sesiunea 160), hotărârea lui Roberto din 29/08.
              ⛔ **Propoziția spune că minutele scad din plată** — e o hotărâre despre bani, iar un
              buton fără explicație ar fi lăsat pe cineva să apese fără să știe ce pierde.
              ⚠️ Până azi omul scria un număr din memorie la ieșirea din tură, iar nimeni nu-l putea
              verifica.
            */}
            {onBreak ? (
              <>
                <p className="text-xs font-medium mt-2">On a break since {open.pauseStart}.</p>
                <Button className="mt-1 w-full min-h-[44px]" disabled={busy}
                  onClick={() => run(() => resumeShift(), 'Back at it.')}>
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Back from break
                </Button>
              </>
            ) : (
              <Button variant="outline" className="mt-2 w-full min-h-[44px]" disabled={busy}
                onClick={() => run(() => pauseShift(), 'Break started.')}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pause className="h-4 w-4 mr-2" />}
                Start a break
              </Button>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Break time is taken off the hours you are paid for.
            </p>
            <Button className="mt-2 w-full min-h-[44px]" disabled={busy}
              onClick={() => run(() => clockOut({}), 'Clocked out.')}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Square className="h-4 w-4 mr-2" />}
              Clock out
            </Button>
          </div>
        ) : (
          <Button className="w-full" disabled={busy}
            onClick={() => run(() => clockIn({}), 'Clocked in.')}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Clock in
          </Button>
        )}

        {/* ── This week ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">This week</span>
          <span>
            <strong>{d.totals.approvedHours}h</strong> approved
            {d.totals.draftHours > 0 && (
              <span className="text-muted-foreground"> · {d.totals.draftHours}h waiting</span>
            )}
          </span>
        </div>

        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing recorded this week yet.</p>
        )}

        {entries.length > 0 && (
          <ul className="divide-y text-sm">
            {entries.map(e => (
              <li key={e.id} className="flex items-start justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div>
                    {e.workDate} · {e.startTime}–{e.finishTime ?? '…'}
                  </div>
                  <div className={`text-xs ${STATUS_STYLE[e.status] ?? 'text-muted-foreground'}`}>
                    {/* An open shift is not "0h" — it has not been measured yet. */}
                    {e.isOpen ? 'Still open' : `${e.workedHours}h · ${e.status}`}
                  </div>
                  {/* The office said the figure looks wrong. The person who can
                      fix it is the one who was there, so the reason is shown. */}
                  {e.disputeReason && (
                    <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                      Office: {e.disputeReason}
                    </p>
                  )}
                  {/* Shown back to them so a note is a thing that exists, not a
                      message shouted into nowhere. The office sees the same text. */}
                  {e.notes && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-medium">Your note:</span> {e.notes}
                    </p>
                  )}
                </div>
                {/* ACHU-498: `canEdit` is false on every entry now, so this never
                    renders. Kept rather than deleted because the flag is the server's
                    to decide — if the rule is ever relaxed, the button comes back with
                    it, and nothing here has to be remembered. */}
                {e.canEdit && (
                  <Button variant="ghost" size="sm" className="shrink-0" disabled={busy}
                    aria-label={`Delete ${e.workDate} ${e.startTime}`} title={`Delete ${e.workDate} ${e.startTime}`}
                    onClick={() => run(() => deleteMyTimesheet({ id: e.id }), 'Entry deleted.')}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {/* ACHU-498 — the replacement for editing. Offered on EVERY entry,
                    whatever its status: the note changes no figure and no money, and
                    an approved entry is exactly the one somebody needs to say
                    something about. */}
                <Button variant="ghost" size="sm" className="shrink-0" disabled={busy}
                  aria-label={`${e.notes ? 'Edit' : 'Add'} note for ${e.workDate} ${e.startTime}`} title={`${e.notes ? 'Edit' : 'Add'} note for ${e.workDate} ${e.startTime}`}
                  onClick={() => { setNoteFor(e); setNoteText(e.notes ?? ''); }}>
                  <MessageSquarePlus className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* ─── What counts as working time (ACHU-368, Sesiunea 85) ──────────
            🔴 The person doing the travelling is the one who has to know, and this
            is the screen they clock in on. Travel between two customers IS working
            time for the minimum wage; Roberto confirmed ACHU pays it. Said here
            because the alternative is that it depends on somebody remembering, and
            unlogged travel does not produce an error — NMW is tested on the
            AVERAGE, so it produces an ordinary-looking average that is too high.
            Wording shared with the office screen via `lib/workingTimeWording.ts`,
            because two versions of a legal sentence is how they drift apart. */}
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{TRAVEL_IS_WORKING_TIME_CLEANER}</span>
        </p>

        {/* Rule 4. Once, plainly, at the bottom — the protection only works if
            the person knows it is there. */}
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{d.notice}</span>
        </p>

        {/* Shown only when it is true, so it stays worth reading. */}
        {entries.some(e => e.status === 'Disputed') && (
          <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {/* 📜 ACHU-498: said "Correcting it sends it back for another look" —
                true until the cleaner could still correct it. Now the office does,
                and telling somebody to do a thing the app refuses is worse than
                saying nothing. */}
            <span>The office has queried one of your entries. Add a note explaining what happened — they see it before approving.</span>
          </p>
        )}
      </CardContent>

      {/* ─── ACHU-498 — writing the note ────────────────────────────────── */}
      <Dialog open={noteFor !== null} onOpenChange={o => { if (!o) setNoteFor(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Note for the office</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {noteFor?.workDate} · {noteFor?.startTime}
            {noteFor?.finishTime ? `–${noteFor.finishTime}` : ''}
          </p>
          <p className="text-xs text-muted-foreground">
            You cannot change the times yourself. Write what happened and the office will see this
            before they approve the hours.
          </p>
          <Textarea
            aria-label="Note for the office"
            rows={4}
            maxLength={1000}
            value={noteText}
            onChange={ev => setNoteText(ev.target.value)}
            placeholder="I started at 09:00 — I typed 19:00 by mistake."
          />
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setNoteFor(null)}>Cancel</Button>
            <Button
              disabled={busy || noteText.trim() === (noteFor?.notes ?? '')}
              onClick={() => {
                const id = noteFor!.id;
                run(() => editMyTimesheet({ id, notes: noteText.trim() }), 'Note sent to the office.')
                  .then(() => setNoteFor(null));
              }}
            >Send to the office</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

