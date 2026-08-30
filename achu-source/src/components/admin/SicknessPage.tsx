import { useEffect, useState, useCallback } from 'react';
import { getPayrollPeople, type PayrollPerson } from '@/lib/endpoints';
// ACHU-401: funcțiile de boală au ieșit din `endpoints.ts`, care e la plafonul lui de mărime.
import {
  getSickness, previewSickness, createSickness, updateSickness,
  endSickness, recordReturnToWork, cancelSickness,
} from '@/lib/absenceEndpoints';
// ACHU-401 (felia 18): formele existau deja publicate — ecranul le declara `any` degeaba.
import type { SicknessListResponse, SicknessAbsence, SspPreview } from '@/lib/absenceTypes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import DateField from '@/components/shared/DateField';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Thermometer, AlertCircle, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '@/lib/format';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';
import SicknessInfoCards from './SicknessInfoCards';
import SicknessTotalsCard from './SicknessTotalsCard';
import SicknessAbsencesTable from './SicknessAbsencesTable';
import SicknessEndDialog from './SicknessEndDialog';
import SicknessReturnToWorkDialog from './SicknessReturnToWorkDialog';
import SicknessCancelDialog from './SicknessCancelDialog';
import { errMsg } from '@/lib/errorMessage';

/**
 * Sesiunea 75 (backlog secțiunea 5) — sickness and Statutory Sick Pay.
 *
 * ─── Why this screen had to exist in the same session as the routes ─────────
 * ACHU-260 is the precedent: the pay-profile routes shipped with no screen, every
 * check was green, and the capability was completely unusable because there was no
 * way to reach it. "Has an endpoint" is not "is built". Section 5's routes went in
 * an hour ago; this is the other half.
 *
 * ─── What this screen shows about how solid the figures are ─────────────────
 * It shipped with TWO amber warnings — an unverified Lower Earnings Limit and an
 * assumed three waiting days. Owner pasted the whole gov.uk page hours later and
 * **both were answered**: there are no waiting days for 2026/27, and the SSP section
 * states no earnings condition at all. So the amber card now carries the ONE rule
 * still open (the four-day minimum, which the page is silent on), and the answers
 * moved to a calm grey card beneath it. See SicknessInfoCards.tsx for that split.
 *
 * ─── Working days are asked for, never assumed ──────────────────────────────
 * The server refuses to guess them and so does this form. Most ACHU cleaners work
 * weekends, so a Monday–Friday default would produce a wrong total that looks
 * entirely ordinary — the worst kind.
 */

const WEEKDAY_LABELS = [
  { value: 0, short: 'Sun' },
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

type FormState = {
  id?: string;
  startDate: string;
  endDate: string;
  stillOff: boolean;
  weekdays: number[];
  notes: string;
};

const blankForm = (): FormState => ({
  startDate: todayIso(), endDate: todayIso(), stillOff: false, weekdays: [], notes: '',
});

export default function SicknessPage() {
  const [people, setPeople] = useState<PayrollPerson[]>([]);
  const [cleanerId, setCleanerId] = useState('');
  const [data, setData] = useState<SicknessListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<FormState | null>(null);
  const [preview, setPreview] = useState<SspPreview | null>(null);
  const [ending, setEnding] = useState<SicknessAbsence | null>(null);
  const [endDate, setEndDate] = useState(todayIso());
  const [rtw, setRtw] = useState<SicknessAbsence | null>(null);
  const [rtwOn, setRtwOn] = useState(todayIso());
  const [rtwNote, setRtwNote] = useState('');
  const [cancelling, setCancelling] = useState<SicknessAbsence | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    getPayrollPeople()
      .then(r => setPeople(r?.people ?? []))
      .catch(e => setError(e?.message ?? 'Could not load the list of people.'));
  }, []);

  const load = useCallback(() => {
    setError(null);
    getSickness(cleanerId ? { cleanerId } : {})
      .then(setData)
      .catch(e => setError(e?.message ?? 'Could not load the sickness records.'));
  }, [cleanerId]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      load();
    } catch (e) {
      // The server's own sentence — it explains WHY (a URL instead of a path, an
      // interview before the person came back) and a generic message loses it.
      toast.error(errMsg(e) ?? 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Prices the spell before saving, so the office sees the figure — including a £0
   * one — rather than discovering it afterwards. A three-day absence is worth
   * nothing, and that is the answer somebody will query.
   */
  const runPreview = async (f: FormState, person: string) => {
    if (!person || f.weekdays.length === 0) { setPreview(null); return; }
    try {
      const r = await previewSickness({
        cleanerId: person,
        startDate: f.startDate,
        endDate: f.stillOff ? null : f.endDate,
        qualifyingWeekdays: f.weekdays.join(','),
      });
      setPreview(r);
    } catch {
      // A failed preview must never block saving — the server validates again.
      setPreview(null);
    }
  };

  const openForm = (f: FormState, person: string) => {
    setForm(f);
    setPreview(null);
    runPreview(f, person);
  };

  const updateForm = (next: FormState) => {
    setForm(next);
    runPreview(next, formCleanerId(next));
  };

  // An edit is always for the person the row belongs to; a new record uses the
  // filter, or the first person when the filter is "everyone".
  const formCleanerId = (f: FormState) =>
    f.id ? (absences.find(a => a.id === f.id)?.cleanerId ?? cleanerId) : (cleanerId || people[0]?.id || '');

  const save = () => {
    if (!form) return;
    const person = formCleanerId(form);
    const payload = {
      startDate: form.startDate,
      endDate: form.stillOff ? null : form.endDate,
      qualifyingWeekdays: form.weekdays,
      notes: form.notes || null,
    };
    return act(
      () => (form.id ? updateSickness(form.id, payload) : createSickness({ ...payload, cleanerId: person })),
      form.id ? 'Sickness record updated.' : 'Sickness recorded.',
    ).then(() => { setForm(null); setPreview(null); });
  };

  const startEdit = (a) => openForm({
    id: a.id,
    startDate: a.startDate,
    endDate: a.endDate ?? todayIso(),
    stillOff: a.endDate == null,
    weekdays: a.qualifyingWeekdays,
    notes: a.notes ?? '',
  }, a.cleanerId);

  const startEnding = (a) => { setEnding(a); setEndDate(todayIso()); };
  const startRtw = (a) => { setRtw(a); setRtwOn(a.endDate ?? todayIso()); setRtwNote(''); };
  const startCancelling = (a) => { setCancelling(a); setReason(''); };

  const confirmEnd = () => {
    if (!ending) return;
    act(() => endSickness(ending.id, endDate), 'Sickness ended.').then(() => setEnding(null));
  };
  const confirmRtw = () => {
    if (!rtw) return;
    act(() => recordReturnToWork(rtw.id, rtwOn, rtwNote || null), 'Return to work recorded.').then(() => setRtw(null));
  };
  const confirmCancel = () => {
    if (!cancelling) return;
    act(() => cancelSickness(cancelling.id, reason), 'Record cancelled.').then(() => setCancelling(null));
  };

  const absences: SicknessAbsence[] = data?.absences ?? [];
  const totals = data?.totals;
  const rules = data?.rules;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Thermometer className="h-5 w-5" />}
        title="Sickness and sick pay"
        description="Who has been off ill, and what Statutory Sick Pay it comes to."
        actions={
          <>
            <RefreshButton onRefresh={load} />
            <Button onClick={() => openForm(blankForm(), cleanerId || people[0]?.id || '')} disabled={people.length === 0}>
              <Plus className="h-4 w-4 mr-2" />Record sickness
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
        <CardContent className="pt-6 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="sk-person">Person</Label>
            <Select value={cleanerId || 'all'} onValueChange={v => setCleanerId(v === 'all' ? '' : v)}>
              <SelectTrigger id="sk-person"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {people.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.active ? '' : ' (inactive)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {rules && (
            <p className="text-xs text-muted-foreground self-end">{rules.note}</p>
          )}
        </CardContent>
      </Card>

      {!data && !error && <Skeleton className="h-32 w-full" />}

      <SicknessInfoCards data={data} />

      <SicknessTotalsCard totals={totals} />

      <SicknessAbsencesTable
        data={data}
        absences={absences}
        busy={busy}
        onEdit={startEdit}
        onEndClick={startEnding}
        onReturnToWorkClick={startRtw}
        onCancelClick={startCancelling}
        onFitNoteChanged={load}
      />

      {/* Record / edit */}
      <Dialog open={form != null} onOpenChange={o => { if (!o) { setForm(null); setPreview(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Change this sickness record' : 'Record sickness'}</DialogTitle>
            <DialogDescription>
              Sick pay is worked out per working day, so the days this person normally works have to be stated.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="grid gap-3">
              {!form.id && (
                <div>
                  <Label htmlFor="sk-form-person">Person</Label>
                  <Select value={formCleanerId(form)} onValueChange={v => { setCleanerId(v); runPreview(form, v); }}>
                    <SelectTrigger id="sk-form-person"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {people.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="sk-start">First day off</Label>
                  <DateField id="sk-start" value={form.startDate}
                    onChange={e => updateForm({ ...form, startDate: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="sk-end">Last day off</Label>
                  <DateField id="sk-end" value={form.endDate} disabled={form.stillOff}
                    onChange={e => updateForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.stillOff}
                  onChange={e => updateForm({ ...form, stillOff: e.target.checked })} />
                Still off — no end date yet
              </label>

              {/* ACHU-523: șapte butoane comutabile — un grup, nu un câmp. */}
              <div role="group" aria-labelledby="sickness-weekdays-label">
                <Label id="sickness-weekdays-label">Days this person normally works</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {WEEKDAY_LABELS.map(w => (
                    <Button key={w.value} type="button" size="sm"
                      variant={form.weekdays.includes(w.value) ? 'default' : 'outline'}
                      onClick={() => updateForm({
                        ...form,
                        weekdays: form.weekdays.includes(w.value)
                          ? form.weekdays.filter(v => v !== w.value)
                          : [...form.weekdays, w.value].sort((a, b) => a - b),
                      })}>
                      {w.short}
                    </Button>
                  ))}
                </div>
                {/* Said rather than defaulted: the wrong answer here is invisible. */}
                <p className="mt-1 text-xs text-muted-foreground">
                  Not assumed, because most cleaners work weekends and Monday–Friday would pay the wrong number
                  of days while looking completely normal. Somebody on three days a week gets a THIRD of the
                  weekly rate per day, not a fifth.
                </p>
              </div>

              <div>
                <Label htmlFor="sk-notes">Notes</Label>
                <Textarea id="sk-notes" rows={2} value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>

              {/* The figure BEFORE saving, including a £0 one. */}
              {preview?.preview && (
                <div className="rounded-md border p-3 text-sm space-y-1">
                  <p className="font-medium">
                    {preview.preview.eligibility.isPiw
                      ? <>{fmt(preview.preview.totalPence / 100)} — {preview.preview.payableDays} day
                        {preview.preview.payableDays === 1 ? '' : 's'} of SSP</>
                      : <>No SSP for this absence</>}
                    {preview.provisional && <span className="text-muted-foreground"> (so far)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{preview.preview.note}</p>
                  {preview.preview.withheldForWaitingPence > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {fmt(preview.preview.withheldForWaitingPence / 100)} of that is unpaid waiting days.
                    </p>
                  )}
                  {preview.linkedTo && (
                    <p className="text-xs text-muted-foreground">
                      Links to the spell ending {preview.linkedTo.endDate}, so waiting days are not served again.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{preview.averageWeeklyEarnings.note}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setForm(null); setPreview(null); }} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy || !form || form.weekdays.length === 0}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SicknessEndDialog
        ending={ending}
        onClose={() => setEnding(null)}
        endDate={endDate}
        onEndDateChange={setEndDate}
        busy={busy}
        onConfirm={confirmEnd}
      />

      <SicknessReturnToWorkDialog
        rtw={rtw}
        onClose={() => setRtw(null)}
        rtwOn={rtwOn}
        onRtwOnChange={setRtwOn}
        rtwNote={rtwNote}
        onRtwNoteChange={setRtwNote}
        busy={busy}
        onConfirm={confirmRtw}
      />

      <SicknessCancelDialog
        cancelling={cancelling}
        onClose={() => setCancelling(null)}
        reason={reason}
        onReasonChange={setReason}
        busy={busy}
        onConfirm={confirmCancel}
      />
    </div>
  );
}

