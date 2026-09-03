import { useEffect, useState, useCallback } from 'react';
import { getPayrollPeople, type PayrollPerson } from '@/lib/endpoints';
// ACHU-401: ieșite din `endpoints.ts`, care e la plafonul lui de mărime.
import { getFamilyLeave, previewFamilyLeave, createFamilyLeave, updateFamilyLeave, endFamilyLeave, cancelFamilyLeave } from '@/lib/absenceEndpoints';
import type { FamilyLeaveListResponse, FamilyLeaveSpell, FamilyLeavePreview } from '@/lib/absenceTypes'; // ACHU-401 (felia 18)
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import DateField from '@/components/shared/DateField';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Baby, AlertCircle, AlertTriangle, Info, Inbox, Loader2, Plus, Pencil, Undo2, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '@/lib/format';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';
import { errMsg } from '@/lib/errorMessage';

/**
 * Sesiunea 76 (backlog secțiunea 6) — family leave and statutory family pay.
 *
 * Built in the same session as the routes, for the reason ACHU-260 taught: complete
 * routes with green tests are unusable if nothing reaches them. Follows the shape of
 * `SicknessPage.tsx` deliberately — same filter, totals, warning card, table and
 * dialogs — because the two screens answer the same shape of question and a second
 * layout would just be a second thing to learn.
 *
 * ─── The three things this screen must say, none of them obvious ─────────────
 *   1. **109% is not a mistake.** A small employer recovers MORE than it paid; the
 *      extra 9% compensates the employer's NI. Somebody seeing a figure larger than
 *      the cost will otherwise assume the app is broken. The row carries
 *      `recoveryExceedsCost` so the explanation can be attached to exactly those rows.
 *   2. **The first six weeks of maternity and adoption are UNCAPPED.** The breakdown
 *      shows them separately, because a single total hides the most valuable fact on
 *      the screen.
 *   3. **90% here, 80% for sick pay.** The two sit next to each other on the same
 *      gov.uk page, and the note from the server says so.
 *
 * ─── Why a refusal is shown as a refusal ────────────────────────────────────
 * Without average weekly earnings there is no answer at all — every figure is a
 * percentage of them. The server refuses, and this screen shows that refusal with the
 * fix (a rate on the pay profile, or approving a timesheet) rather than an empty
 * total that looks calculated.
 */

const TYPE_ORDER = [
  'Maternity', 'Paternity', 'Adoption', 'SharedParental',
  'ParentalBereavement', 'NeonatalCare', 'UnpaidParental', 'Compassionate',
];

const STATUS_STYLE: Record<string, string> = {
  Planned: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  Active: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  Ended: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  Cancelled: 'bg-muted text-muted-foreground',
};

const todayIso = () => new Date().toISOString().slice(0, 10);

type FormState = {
  id?: string;
  type: string;
  startDate: string;
  weeks: string;
  notes: string;
};

const blankForm = (): FormState => ({
  type: 'Maternity', startDate: todayIso(), weeks: '39', notes: '',
});

export default function FamilyLeavePage() {
  const [people, setPeople] = useState<PayrollPerson[]>([]);
  const [cleanerId, setCleanerId] = useState('');
  const [data, setData] = useState<FamilyLeaveListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<FormState | null>(null);
  const [formPerson, setFormPerson] = useState('');
  const [preview, setPreview] = useState<FamilyLeavePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [ending, setEnding] = useState<FamilyLeaveSpell | null>(null);
  const [endDate, setEndDate] = useState(todayIso());
  const [cancelling, setCancelling] = useState<FamilyLeaveSpell | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    getPayrollPeople()
      .then(r => setPeople(r?.people ?? []))
      .catch(e => setError(e?.message ?? 'Could not load the list of people.'));
  }, []);

  const load = useCallback(() => {
    setError(null);
    getFamilyLeave(cleanerId ? { cleanerId } : {})
      .then(setData)
      .catch(e => setError(e?.message ?? 'Could not load the family leave records.'));
  }, [cleanerId]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      load();
    } catch (e) {
      toast.error(errMsg(e) ?? 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Prices the spell before saving. Unlike the sickness screen, a FAILED preview is
   * shown rather than swallowed: here a failure usually means "no average weekly
   * earnings", which is the thing the office has to fix before anything can be saved
   * at all.
   */
  const runPreview = async (f: FormState, person: string) => {
    setPreviewError(null);
    if (!person || !f.weeks) { setPreview(null); return; }
    try {
      const r = await previewFamilyLeave({
        cleanerId: person, type: f.type, startDate: f.startDate, weeks: Number(f.weeks),
      });
      setPreview(r);
    } catch (e) {
      setPreview(null);
      setPreviewError(errMsg(e) ?? 'Could not work out what this would pay.');
    }
  };

  const openForm = (f: FormState, person: string) => {
    setForm(f);
    setFormPerson(person);
    setPreview(null);
    setPreviewError(null);
    runPreview(f, person);
  };

  const updateForm = (next: FormState) => {
    setForm(next);
    runPreview(next, formPerson);
  };

  const save = () => {
    if (!form) return;
    const payload = {
      type: form.type,
      startDate: form.startDate,
      weeks: Number(form.weeks || 0),
      notes: form.notes || null,
    };
    return act(
      () => (form.id ? updateFamilyLeave(form.id, payload) : createFamilyLeave({ ...payload, cleanerId: formPerson })),
      form.id ? 'Family leave updated.' : 'Family leave recorded.',
    ).then(() => { setForm(null); setPreview(null); });
  };

  const spells: FamilyLeaveSpell[] = data?.spells ?? [];
  const totals = data?.totals;
  const rules = data?.rules;
  const labelOf = (type: string) => rules?.labels?.[type] ?? type;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Baby className="h-5 w-5" />}
        title="Family leave"
        description="Maternity, paternity, adoption and the rest — what is owed, and what HMRC gives back."
        actions={
          <>
            <RefreshButton onRefresh={load} />
            <Button onClick={() => openForm(blankForm(), cleanerId || people[0]?.id || '')} disabled={people.length === 0}>
              <Plus className="h-4 w-4 mr-2" />Record family leave
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
            <Label htmlFor="fl-person">Person</Label>
            <Select value={cleanerId || 'all'} onValueChange={v => setCleanerId(v === 'all' ? '' : v)}>
              <SelectTrigger id="fl-person"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {people.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}{p.active ? '' : ' (inactive)'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {rules && <p className="text-xs text-muted-foreground self-end">{rules.note}</p>}
        </CardContent>
      </Card>

      {!data && !error && <Skeleton className="h-32 w-full" />}

      {/* ⚠️ Above the totals: the durations and the service test are not verified, and
          a caveat under a total is a caveat nobody reads. */}
      {data?.unverified && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-6 space-y-2 text-sm">
            <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Two things here are not confirmed yet
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>How many weeks each type lasts.</strong> {data.unverified.paidWeeks.whyItMatters}
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Whether the person qualifies.</strong> {data.unverified.continuousService.whyItMatters}
            </p>
          </CardContent>
        </Card>
      )}

      {totals && (
        <Card>
          <CardContent className="pt-6 grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Spells</p>
              <p className="text-2xl font-semibold">{totals.spells}</p>
              {totals.planned > 0 && (
                <p className="text-xs text-muted-foreground">{totals.planned} planned</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Weeks paid</p>
              <p className="text-2xl font-semibold">{totals.weeksPaid}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Statutory pay</p>
              <p className="text-2xl font-semibold">{fmt(totals.totalPence / 100)}</p>
              {totals.companyTopUpPence > 0 && (
                <p className="text-xs text-muted-foreground">
                  plus {fmt(totals.companyTopUpPence / 100)} company top-up
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recoverable from HMRC</p>
              <p className={`text-2xl font-semibold ${
                totals.recoveryPence > totals.totalPence ? 'text-emerald-700 dark:text-emerald-400' : ''
              }`}>
                {fmt(totals.recoveryPence / 100)}
              </p>
            </div>

            {/* ⚠️ The sentence that stops somebody "fixing" a figure larger than the cost. */}
            {data.recoveryNote && (
              <p className="sm:col-span-4 flex gap-2 rounded-md border p-2 text-xs text-muted-foreground">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{data.recoveryNote}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {data && (
        <Card>
          <CardContent className="pt-6">
            {spells.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No family leave recorded.
              </div>
            ) : (
              <div tabIndex={0} className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3">Dates</th>
                      <th scope="col" className="py-2 pr-3">Person</th>
                      <th scope="col" className="py-2 pr-3">Type</th>
                      <th scope="col" className="py-2 pr-3">Pay</th>
                      <th scope="col" className="py-2 pr-3">From HMRC</th>
                      <th scope="col" className="py-2 pr-3">Status</th>
                      <th scope="col" className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {spells.map(s => (
                      <tr key={s.id} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {s.startDate}
                          {s.endDate ? <> → {s.endDate}</> : <> · {s.weeksClaimed} weeks</>}
                          {s.notes && <span className="block text-xs text-muted-foreground">{s.notes}</span>}
                        </td>
                        <td className="py-2 pr-3">{s.cleanerName}</td>
                        <td className="py-2 pr-3">{s.label}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {s.unpaidType ? (
                            <span className="text-muted-foreground">unpaid</span>
                          ) : (
                            <>
                              <span className="font-medium">{fmt(s.total)}</span>
                              <span className="block text-xs text-muted-foreground">
                                {s.weeksPaid} week{s.weeksPaid === 1 ? '' : 's'}
                              </span>
                              {/* The most valuable fact on the row: the uncapped weeks. */}
                              {s.higherRateWeeks > 0 && (
                                <span className="block text-xs text-muted-foreground">
                                  {s.higherRateWeeks} at 90%, uncapped
                                </span>
                              )}
                            </>
                          )}
                          {s.companyTopUpDecided && s.companyTopUpPence > 0 && (
                            <span className="block text-xs text-muted-foreground">
                              + {fmt(s.companyTopUpPence / 100)} company
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {s.recoveryPercent == null ? (
                            <span className="text-xs text-muted-foreground">not known</span>
                          ) : (
                            <>
                              <span className={s.recoveryExceedsCost ? 'text-emerald-700 dark:text-emerald-400' : ''}>
                                {fmt((s.recoveryPence ?? 0) / 100)}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {s.recoveryPercent}%{s.recoveryExceedsCost ? ' — more than paid' : ''}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge className={STATUS_STYLE[s.status] ?? ''}>{s.status}</Badge>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1 justify-end">
                            {s.status !== 'Ended' && s.status !== 'Cancelled' && (
                              <Button size="sm" variant="outline" disabled={busy}
                                onClick={() => { setEnding(s); setEndDate(s.endDate ?? todayIso()); }}>
                                <CalendarCheck className="h-4 w-4 mr-1" />End
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" disabled={busy || s.status === 'Cancelled'}
                              title={s.status === 'Cancelled' ? 'A cancelled record is part of the history and is not edited.' : undefined}
                              onClick={() => openForm({
                                id: s.id, type: s.type, startDate: s.startDate,
                                weeks: String(s.weeksClaimed), notes: s.notes ?? '',
                              }, s.cleanerId)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" disabled={busy || s.status === 'Cancelled'}
                              title="Cancel this record — it stays in the history, which is why there is no delete."
                              onClick={() => { setCancelling(s); setReason(''); }}>
                              <Undo2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.companyTopUpNote && (
              <p className="mt-4 text-xs text-muted-foreground">{data.companyTopUpNote}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Record / edit */}
      <Dialog open={form != null} onOpenChange={o => { if (!o) { setForm(null); setPreview(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Change this record' : 'Record family leave'}</DialogTitle>
            <DialogDescription>
              The pay is worked out from this person's average weekly earnings over the eight weeks before the
              leave starts, so it cannot be entered by hand.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="grid gap-3">
              {!form.id && (
                <div>
                  <Label htmlFor="fl-form-person">Person</Label>
                  <Select value={formPerson} onValueChange={v => { setFormPerson(v); runPreview(form, v); }}>
                    <SelectTrigger id="fl-form-person"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {people.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="fl-type">Type</Label>
                <Select value={form.type} onValueChange={v => updateForm({
                  ...form, type: v, weeks: String(rules?.paidWeeks?.[v] ?? form.weeks),
                })}>
                  <SelectTrigger id="fl-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_ORDER.map(t => <SelectItem key={t} value={t}>{labelOf(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {rules?.higherRateTypes?.includes(form.type) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    The first {rules.higherRateWeeks} weeks are 90% of earnings with <strong>no cap</strong>.
                  </p>
                )}
                {rules?.unpaidTypes?.includes(form.type) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No statutory pay: a right to time, not to money. Nothing can be recovered from HMRC either.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="fl-start">Starts</Label>
                  <DateField id="fl-start" value={form.startDate}
                    onChange={e => updateForm({ ...form, startDate: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="fl-weeks">Weeks</Label>
                  <Input id="fl-weeks" type="number" min="1" value={form.weeks}
                    onChange={e => updateForm({ ...form, weeks: e.target.value })} />
                </div>
              </div>

              <div>
                <Label htmlFor="fl-notes">Notes</Label>
                <Textarea id="fl-notes" rows={2} value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>

              {/* ⚠️ A refusal shown as a refusal: it names what the office must fix. */}
              {previewError && (
                <p className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{previewError}</span>
                </p>
              )}

              {preview?.preview && (
                <div className="rounded-md border p-3 text-sm space-y-1">
                  <p className="font-medium">
                    {preview.preview.unpaidType
                      ? 'Unpaid'
                      : <>{fmt(preview.preview.totalPence / 100)} over {preview.preview.weeksPaid} week
                        {preview.preview.weeksPaid === 1 ? '' : 's'}</>}
                  </p>
                  {preview.preview.breakdown?.map((b, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      {b.label} — {fmt(b.weeklyRatePence / 100)}/week, {fmt(b.totalPence / 100)}
                    </p>
                  ))}
                  {preview.preview.recovery && (
                    <p className="text-xs text-muted-foreground">
                      {fmt(preview.preview.recovery.amountPence / 100)} back from HMRC at{' '}
                      {preview.preview.recovery.percent}%. {preview.preview.recovery.note}
                    </p>
                  )}
                  {preview.earnings?.note && (
                    <p className="text-xs text-muted-foreground">{preview.earnings.note}</p>
                  )}
                  {preview.preview.warnings?.map((w: string, i: number) => (
                    <p key={`w${i}`} className="text-xs text-amber-700 dark:text-amber-400">{w}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setForm(null); setPreview(null); }} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy || !form || !form.weeks}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End */}
      <Dialog open={ending != null} onOpenChange={o => !o && setEnding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>When did the leave end?</DialogTitle>
            <DialogDescription>
              This closes the record. The pay already worked out is not recalculated — it is what was paid.
            </DialogDescription>
          </DialogHeader>
          <DateField value={endDate} onChange={e => setEndDate(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnding(null)} disabled={busy}>Cancel</Button>
            <Button disabled={busy}
              onClick={() => ending && act(() => endFamilyLeave(ending.id, endDate), 'Family leave ended.')
                .then(() => setEnding(null))}>
              End it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel — never delete */}
      <Dialog open={cancelling != null} onOpenChange={o => !o && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Why is this record being cancelled?</DialogTitle>
            <DialogDescription>
              The record stays and the pay goes to zero. There is no delete on purpose: family leave is planned
              around, and deleting it hides that it ever existed.
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={3} aria-label="Why is this record being cancelled?" value={reason} onChange={e => setReason(e.target.value)}
            placeholder="e.g. Recorded on the wrong person" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)} disabled={busy}>Keep it</Button>
            <Button disabled={busy || reason.trim().length < 3}
              onClick={() => cancelling && act(() => cancelFamilyLeave(cancelling.id, reason), 'Record cancelled.')
                .then(() => setCancelling(null))}>
              Cancel the record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

