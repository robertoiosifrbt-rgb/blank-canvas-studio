import { useEffect, useState, useCallback } from 'react';
import {
  getPayrollPeople, getTimeEntries, getTimesheetSummary, getTimesheetSuggestions,
  getTimesheetPeriod, createTimeEntry, updateTimeEntry, approveTimeEntry,
  disputeTimeEntry, reopenTimeEntry, deleteTimeEntry,
  type TimesheetsResponse, type TimesheetSummaryResponse, type TimesheetSuggestion, type PayrollPerson,
} from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import DateField from '@/components/shared/DateField';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, AlertCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';
import NightWorkNotice from './NightWorkNotice';
import TimesheetsSummaryCard from './TimesheetsSummaryCard';
import TimesheetsSuggestionsCard from './TimesheetsSuggestionsCard';
import TimesheetsEntriesTable from './TimesheetsEntriesTable';
import TimesheetsFormDialog from './TimesheetsFormDialog';
import TimesheetsDisputeDialog from './TimesheetsDisputeDialog';
// 🔴 §17 (Sesiunea 151) — redeschiderea unei ore aprobate cere de acum un motiv.
import TimesheetsReopenDialog from './TimesheetsReopenDialog';
import TimesheetsDeleteDialog from './TimesheetsDeleteDialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type Entry, type FormState } from '@/lib/timesheetsFormat';
import { errMsg } from '@/lib/errorMessage';

/**
 * Sesiunea 62 (ACHU-267) — the hours the app could not record.
 *
 * Owner, 31/07/2026: **„payroll nu calculeaza orele lucrate?"** It did not. The
 * simulator took gross as a figure you typed, pre-filled from CONTRACTED hours.
 * For someone on a salary that is right; for an hourly cleaner whose hours vary
 * it was an assumption wearing the clothes of a measurement, and there was
 * nowhere in the database to correct it.
 *
 * ─── Three things this screen refuses to do ─────────────────────────────
 * 1. It never approves on entry. Recording hours and agreeing them are separate
 *    acts, and only the second lets a wage be paid — so the second has a name and
 *    a timestamp against it.
 * 2. It never inserts the job-derived suggestions by itself. Those come from the
 *    times the app stamps when a job's status moves, which is evidence of when
 *    somebody tapped a screen, per JOB rather than per person. Offered for
 *    confirmation, they save typing; inserted silently, they would quietly pay two
 *    cleaners for one job's span each.
 * 3. It never hides unapproved hours. A week showing 6 approved hours and 34
 *    waiting is a completely different situation from one showing 6 and nothing
 *    else, and a screen that only totalled the approved figure would make the two
 *    look identical.
 */

const todayIso = () => new Date().toISOString().slice(0, 10);

const blankForm = (): FormState => ({
  workDate: todayIso(), startTime: '09:00', finishTime: '17:00',
  breakMinutes: '30', pauseStart: '', pauseEnd: '', kind: 'Job', jobId: null, notes: '',
});

export default function TimesheetsPage() {
  const [people, setPeople] = useState<PayrollPerson[]>([]);
  const [cleanerId, setCleanerId] = useState<string>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  const [data, setData] = useState<TimesheetsResponse | null>(null);
  const [summary, setSummary] = useState<TimesheetSummaryResponse | null>(null);
  const [suggestions, setSuggestions] = useState<TimesheetSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<FormState | null>(null);
  const [disputing, setDisputing] = useState<Entry | null>(null);
  /**
   * 🔴 ACHU-498 — ștergerea trece printr-o confirmare (Roberto: „Fara buton de
   * confirmare? Serios?"). Rândul e ținut întreg, nu doar id-ul: dialogul arată
   * ziua și orele, ca omul să vadă dacă a apăsat pe rândul greșit.
   */
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [disputeReason, setDisputeReason] = useState('');

  // People first: nothing on this screen means anything without a person, and
  // the period default depends on how that person is paid.
  useEffect(() => {
    getPayrollPeople()
      .then(r => {
        const list = r?.people ?? [];
        setPeople(list);
        if (list.length && !cleanerId) setCleanerId(list[0].id);
      })
      .catch(e => setError(e?.message ?? 'Could not load the list of people.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const person = people.find(p => p.id === cleanerId);

  /**
   * Ask the server for a sensible window rather than working one out here. It is
   * explicitly a SUGGESTION — this app has no pay calendar, because which weekday
   * a week starts on is a business decision nobody has made. Both dates stay
   * editable for exactly that reason.
   */
  const suggestPeriod = useCallback(() => {
    const frequency = person?.profile?.payFrequency ?? 'weekly';
    getTimesheetPeriod({ frequency, date: todayIso() })
      .then(r => { setFrom(r.start); setTo(r.end); })
      .catch(() => { /* leaving the dates as they are is a fine failure here */ });
  }, [person]);

  useEffect(() => { if (person && !from && !to) suggestPeriod(); }, [person, from, to, suggestPeriod]);

  const load = useCallback(() => {
    if (!cleanerId || !from || !to) return;
    setError(null);
    Promise.all([
      getTimeEntries({ cleanerId, from, to }),
      getTimesheetSummary({ cleanerId, from, to }),
      getTimesheetSuggestions({ cleanerId, from, to }),
    ])
      .then(([entries, sum, sug]) => {
        setData(entries);
        setSummary(sum);
        setSuggestions(sug?.suggestions ?? []);
      })
      .catch(e => setError(e?.message ?? 'Could not load the timesheet.'));
  }, [cleanerId, from, to]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      load();
    } catch (e) {
      // The server's sentence, not a rephrasing — it explains WHY a refusal
      // happened (reopen before editing, break longer than the shift) and a
      // generic "could not save" would throw that away.
      toast.error(errMsg(e) ?? 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!form) return;
    const payload = {
      workDate: form.workDate,
      startTime: form.startTime,
      finishTime: form.finishTime,
      breakMinutes: Number(form.breakMinutes || 0),
      // §17 — fereastra pauzei. ⚠️ Gol → `null`, ca serverul să nu primească „" ca oră.
      pauseStart: form.pauseStart || null,
      pauseEnd: form.pauseEnd || null,
      kind: form.kind,
      jobId: form.jobId,
      notes: form.notes || null,
    };
    return act(
      () => (form.id ? updateTimeEntry(form.id, payload) : createTimeEntry({ ...payload, cleanerId })),
      form.id ? 'Hours updated.' : 'Hours recorded — still to be approved.',
    ).then(() => setForm(null));
  };

  const startEdit = (e: Entry) => setForm({
    id: e.id, workDate: e.workDate, startTime: e.startTime, finishTime: e.finishTime,
    breakMinutes: String(e.breakMinutes), pauseStart: e.pauseStart ?? '', pauseEnd: e.pauseEnd ?? '',
    kind: e.kind, jobId: null, notes: e.notes ?? '',
  });
  const startDispute = (e: Entry) => { setDisputing(e); setDisputeReason(''); };
  const addSuggestion = (sg) => setForm({
    workDate: sg.workDate, startTime: sg.startTime, finishTime: sg.finishTime,
    breakMinutes: '0', pauseStart: '', pauseEnd: '', kind: 'Job', jobId: sg.jobId, notes: '',
  });

  // ACHU-498: declared before the handlers that read it — the same
  // access-before-declaration shape lint flagged in CustomerJobCard today.
  const entries: Entry[] = data?.entries ?? [];
  /**
   * ACHU-498, gaura 4 — zilele neobișnuite, calculate de SERVER din tot intervalul cerut.
   * ⚠️ Nu se re-derivă aici: ecranul arată doar filtrul curent, iar o zi lungă compusă din
   * intrări ale mai multor filtre ar dispărea exact când e ascunsă.
   */
  const dayWarnings: { code: string; message: string }[] = data?.dayWarnings ?? [];

  /**
   * ACHU-498. An entry carrying a note cannot be approved until the office has
   * read it — the server refuses without the note text, so this is not a UI
   * courtesy that can be skipped by a stale client.
   *
   * The note is the ONLY thing a cleaner can still say about their own hours
   * (they can no longer change the figures), so approving past one unread would
   * make the whole arrangement pointless. Entries without a note approve in one
   * click, exactly as before: a confirmation on every row would be clicked
   * blind within a week.
   */
  const [readingNote, setReadingNote] = useState<Entry | null>(null);
  const onApprove = (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (entry?.notes && entry.notes.trim() !== '') { setReadingNote(entry); return; }
    return act(() => approveTimeEntry(id), 'Hours approved.');
  };
  const confirmNoteAndApprove = () => {
    if (!readingNote) return;
    const note = readingNote.notes ?? '';
    act(() => approveTimeEntry(readingNote.id, note.trim()), 'Hours approved.').then(() => setReadingNote(null));
  };
  /**
   * 🔴 §17 (Sesiunea 151) — **o oră APROBATĂ nu se mai redeschide fără motiv.**
   *
   * ⚠️ Doar cea aprobată: o redeschidere dintr-o dispută are deja motivul scris pe dispută, iar un al
   * doilea ar fi birocrație. ⛔ Serverul refuză oricum fără el, deci dialogul nu e o curtoazie de
   * interfață care se poate sări cu un client vechi.
   */
  const [reopening, setReopening] = useState<Entry | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const onReopen = (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (entry?.status === 'Approved') { setReopening(entry); setReopenReason(''); return; }
    return act(() => reopenTimeEntry(id), 'Reopened — the approval was removed.');
  };
  const confirmReopen = () => {
    if (!reopening) return;
    act(() => reopenTimeEntry(reopening.id, reopenReason.trim()), 'Reopened — the approval was removed.')
      .then(() => setReopening(null));
  };
  const startDelete = (e: Entry) => { setDeleting(e); setDeleteReason(''); };
  const onDelete = () => {
    if (!deleting) return;
    act(() => deleteTimeEntry(deleting.id, deleteReason.trim() || undefined), 'Entry deleted.')
      .then(() => setDeleting(null));
  };

  const confirmDispute = () => {
    if (!disputing) return;
    act(() => disputeTimeEntry(disputing.id, disputeReason), 'Marked as disputed.').then(() => setDisputing(null));
  };


  return (
    <div className="space-y-4">
      <NightWorkNotice />
      <PageHeader
        icon={<Clock className="h-5 w-5" />}
        title="Timesheets"
        description="The hours somebody actually worked — which is what an hourly wage should be worked out from, not the hours in their contract."
        actions={
          <>
            <RefreshButton onRefresh={load} />
            <Button onClick={() => setForm(blankForm())} disabled={!cleanerId}>
              <Plus className="h-4 w-4 mr-2" />Record hours
            </Button>
          </>
        }
      />

      {error && (
        <Card>
          <CardContent className="pt-6 flex gap-3 text-sm">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label htmlFor="ts-person">Person</Label>
            <Select value={cleanerId} onValueChange={v => { setCleanerId(v); setFrom(''); setTo(''); }}>
              <SelectTrigger id="ts-person"><SelectValue placeholder="Choose someone" /></SelectTrigger>
              <SelectContent>
                {people.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.active ? '' : ' (inactive)'}{p.onPayroll ? '' : ' — no pay details'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ts-from">Period from</Label>
            <DateField id="ts-from" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ts-to">to</Label>
            <DateField id="ts-to" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="sm:col-span-4 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={suggestPeriod} disabled={!person}>
              Suggest the period
            </Button>
            <span className="text-xs text-muted-foreground">
              A suggestion from how this person is paid. There is no pay calendar in the app yet — which day a
              week starts on is a decision for the business, so both dates stay editable.
            </span>
          </div>
        </CardContent>
      </Card>

      {!summary && cleanerId && !error && <Skeleton className="h-28 w-full" />}

      <TimesheetsSummaryCard summary={summary} />

      <TimesheetsSuggestionsCard suggestions={suggestions} busy={busy} onAdd={addSuggestion} />

      {/*
        🔴 ACHU-498, gaura 4 — ZILELE neobișnuite, DEASUPRA tabelului.
        Plafonul de 16 ore păzește o intrare; împărțirea în două rânduri e legitimă, deci suma
        zilei nu avea nicio limită și niciun semnal. ⚠️ Aici, nu pe un rând: avertismentul e
        despre ziua omului, iar lipit pe o intrare s-ar citi ca o acuzație despre aceea.
      */}
      {dayWarnings.length > 0 && (
        <div className="rounded-md border border-orange-400 bg-orange-50 p-3 text-sm dark:bg-orange-950">
          <p className="font-medium">Worth a look before approving</p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5 text-xs">
            {dayWarnings.map((w: { code: string; message: string }, i: number) => (
              <li key={`${w.code}-${i}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      <TimesheetsEntriesTable
        entries={entries}
        busy={busy}
        onApprove={onApprove}
        onReopen={onReopen}
        onDispute={startDispute}
        onEditClick={startEdit}
        onDelete={startDelete}
      />

      <TimesheetsFormDialog
        form={form}
        onChange={setForm}
        person={person}
        busy={busy}
        onSave={save}
        onClose={() => setForm(null)}
      />

      <TimesheetsDeleteDialog
        deleting={deleting}
        onClose={() => setDeleting(null)}
        reason={deleteReason}
        onReasonChange={setDeleteReason}
        busy={busy}
        onConfirm={onDelete}
      />

      <TimesheetsDisputeDialog
        disputing={disputing}
        onClose={() => setDisputing(null)}
        reason={disputeReason}
        onReasonChange={setDisputeReason}
        busy={busy}
        onConfirm={confirmDispute}
      />

      <TimesheetsReopenDialog

        reopening={reopening} onClose={() => setReopening(null)}

        reason={reopenReason} onReasonChange={setReopenReason}

        busy={busy} onConfirm={confirmReopen}

      />

      {/* ACHU-498 — the office confirms it has read the cleaner's note before approving. */}
      <Dialog open={readingNote !== null} onOpenChange={o => { if (!o) setReadingNote(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Read this before approving</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The cleaner left a note on the hours for {readingNote?.workDate}. They can no longer change the
            figures themselves, so this is the only way they can tell you something is wrong.
          </p>
          <p className="rounded border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950">
            {readingNote?.notes}
          </p>
          <p className="text-xs text-muted-foreground">
            If the note says the times are wrong, close this and correct them — approving locks the figures in.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReadingNote(null)} disabled={busy}>Not yet</Button>
            <Button onClick={confirmNoteAndApprove} disabled={busy}>I have read it — approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

