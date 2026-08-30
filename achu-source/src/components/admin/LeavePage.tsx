import { useEffect, useState, useCallback } from 'react';
import { getPayrollPeople, getLeave, createLeaveRequest, updateLeaveRequest, approveLeave, declineLeave, cancelLeave, deleteLeaveRequest, type PayrollPerson } from '@/lib/endpoints';
import type { LeaveRequest, LeaveListResponse } from '@/lib/absenceTypes'; // ACHU-401, feliile 18 + 32
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
import { Umbrella, AlertCircle, AlertTriangle, Info, Inbox, Loader2, Check, X, Plus, Pencil, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '@/lib/format';
import RefreshButton from '@/components/shared/RefreshButton';
import PageHeader from '@/components/shared/PageHeader';
import { errMsg } from '@/lib/errorMessage';

/**
 * ACHU-289 (Sesiunea 70) — holiday: requested, approved, taken.
 *
 * ACHU-267 brought the ACCRUAL — 12.07% of hours worked, a legal entitlement for
 * people with irregular hours. Nothing recorded what was **taken**, so the app could
 * say "41 hours accrued" and nothing at all about how many were left.
 *
 * ─── The leave year (ACHU-290, Sesiunea 71) ─────────────────────────────
 * This screen used to say the app had no leave year, because when one starts is a
 * business decision and 1 January, 6 April and each person's start-date anniversary
 * all give different answers. **Owner chose 6 April on 31/07/2026.**
 *
 * So the window is no longer "some dates you pick" — it defaults to the current
 * leave year, is labelled as one, and the year comes from the SERVER rather than
 * being worked out here. That last part is deliberate: a screen that computes its
 * own year can disagree with an export about which year a figure belongs to, and
 * the disagreement is invisible.
 *
 * Custom dates still work and are still refused the word "entitlement" — the
 * caveat splits on `leaveYear.isLeaveYear`.
 *
 * ─── Four buckets, not two ──────────────────────────────────────────────
 * Taken and booked are both approved; the difference is whether the date has passed.
 * Both are deducted, and shown apart, because "12 hours left" means something
 * different when 8 are already promised for next Friday. Requested is shown and NOT
 * deducted — nobody has granted it.
 */

const KIND_LABEL: Record<string, string> = {
  Holiday: 'Holiday',
  Unpaid: 'Unpaid leave',
};

const STATUS_STYLE: Record<string, string> = {
  Approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  Requested: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  Declined: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  Cancelled: 'bg-muted text-muted-foreground',
};

const todayIso = () => new Date().toISOString().slice(0, 10);

type FormState = {
  id?: string;
  kind: string;
  startDate: string;
  endDate: string;
  hours: string;
  notes: string;
};

const blankForm = (): FormState => ({
  kind: 'Holiday', startDate: todayIso(), endDate: todayIso(), hours: '8', notes: '',
});

export default function LeavePage() {
  const [people, setPeople] = useState<PayrollPerson[]>([]);
  const [cleanerId, setCleanerId] = useState('');
  /**
   * `null` means "whatever the server says the current leave year is" — the first
   * load asks for no dates at all rather than guessing one here.
   */
  const [window_, setWindow] = useState<{ from: string; to: string } | null>(null);

  const [data, setData] = useState<LeaveListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<FormState | null>(null);
  const [declining, setDeclining] = useState<LeaveRequest | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    getPayrollPeople()
      .then(r => {
        const list = r?.people ?? [];
        setPeople(list);
        if (list.length) setCleanerId(prev => prev || list[0].id);
      })
      .catch(e => setError(e?.message ?? 'Could not load the list of people.'));
  }, []);

  const load = useCallback(() => {
    if (!cleanerId) return;
    setError(null);
    getLeave(window_ ? { cleanerId, ...window_ } : { cleanerId })
      .then(setData)
      .catch(e => setError(e?.message ?? 'Could not load the leave record.'));
  }, [cleanerId, window_]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      load();
    } catch (e) {
      // The server's own sentence — it explains WHY a refusal happened (cancel
      // instead of editing, hours over the cap) and a generic message would lose it.
      toast.error(errMsg(e) ?? 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!form) return;
    const payload = {
      kind: form.kind,
      startDate: form.startDate,
      endDate: form.endDate,
      hours: Number(form.hours || 0),
      notes: form.notes || null,
    };
    return act(
      () => (form.id ? updateLeaveRequest(form.id, payload) : createLeaveRequest({ ...payload, cleanerId })),
      form.id ? 'Request updated.' : 'Requested — still to be approved.',
    ).then(() => setForm(null));
  };

  const b = data?.balance;
  const requests: LeaveRequest[] = data?.requests ?? [];
  const person = people.find(p => p.id === cleanerId);
  const leaveYear = data?.leaveYear;
  const entitlement = data?.entitlement;
  const carryOver = data?.carryOver;
  const takingPaceView = data?.takingPace;

  // The dates SHOWN are the server's, until somebody types over them. Falling back
  // to a locally computed year would put a different window in the boxes than the
  // one the figures describe.
  const shownFrom = window_?.from ?? data?.period?.from ?? '';
  const shownTo = window_?.to ?? data?.period?.to ?? '';
  const isThisWindow = (y: { from: string; to: string }) => y.from === shownFrom && y.to === shownTo;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Umbrella className="h-5 w-5" />}
        title="Holiday and leave"
        description="What has accrued, what has been taken, and what is left — over the leave year."
        actions={
          <>
            <RefreshButton onRefresh={load} />
            <Button onClick={() => setForm(blankForm())} disabled={!cleanerId}>
              <Plus className="h-4 w-4 mr-2" />Record leave
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
            <Label htmlFor="lv-person">Person</Label>
            <Select value={cleanerId} onValueChange={setCleanerId}>
              <SelectTrigger id="lv-person"><SelectValue placeholder="Choose someone" /></SelectTrigger>
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
            <Label htmlFor="lv-from">From</Label>
            <DateField id="lv-from" value={shownFrom}
              onChange={e => setWindow({ from: e.target.value, to: shownTo })} />
          </div>
          <div>
            <Label htmlFor="lv-to">to</Label>
            <DateField id="lv-to" value={shownTo}
              onChange={e => setWindow({ from: shownFrom, to: e.target.value })} />
          </div>

          {/* ACHU-290. One click per leave year, so nobody has to remember that it
              runs 6 April to 5 April — and so the dates typed by hand are the
              exception rather than the only way in. The years come from the server. */}
          {leaveYear && (
            <div className="sm:col-span-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground mr-1">Leave year:</span>
              {leaveYear.recent.map(y => (
                <Button key={y.startYear} size="sm"
                  variant={isThisWindow(y) ? 'default' : 'outline'}
                  onClick={() => setWindow({ from: y.from, to: y.to })}>
                  {y.label}{y.startYear === leaveYear.current.startYear ? ' (current)' : ''}
                </Button>
              ))}
              {!leaveYear.isLeaveYear && (
                <Badge variant="outline" className="text-amber-700 dark:text-amber-400">Custom dates</Badge>
              )}
            </div>
          )}

          <p className="sm:col-span-4 text-xs text-muted-foreground">
            {leaveYear?.decidedNote
              ?? 'The leave year starts on 6 April — the owner\'s decision of 31/07/2026.'}
          </p>
        </CardContent>
      </Card>

      {!data && cleanerId && !error && <Skeleton className="h-32 w-full" />}

      {b && (
        <>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className={`grid gap-4 ${b.carriedInHours !== 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
                {/* ACHU-291. Shown as its own figure, not folded into "Accrued":
                    somebody looking at 32h needs to know whether they earned it this
                    year or brought it from last, and the owner's rule means it can be
                    years old. Hidden when zero rather than shown as 0h. */}
                {b.carriedInHours !== 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Brought forward</p>
                    <p className={`text-2xl font-semibold ${b.carriedInHours < 0 ? 'text-amber-700 dark:text-amber-400' : ''}`}>
                      {b.carriedInHours}h
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Accrued{b.carriedInHours !== 0 ? ' this year' : ''}</p>
                  <p className="text-2xl font-semibold">{b.accruedHours}h</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Taken</p>
                  <p className="text-2xl font-semibold">{b.takenHours}h</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Approved for later</p>
                  <p className={`text-2xl font-semibold ${b.bookedHours > 0 ? 'text-sky-700 dark:text-sky-400' : ''}`}>
                    {b.bookedHours}h
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Left</p>
                  <p className={`text-2xl font-semibold ${b.remainingHours < 0 ? 'text-red-700 dark:text-red-400' : ''}`}>
                    {b.remainingHours}h
                  </p>
                  {data.value && (
                    <p className="text-xs text-muted-foreground">worth {fmt(data.value.remaining)}</p>
                  )}
                </div>
              </div>

              {/* ⚠️ The caveat, ALWAYS, and above nothing else on this card by accident:
                  without it "Left" reads as a statutory annual allowance. */}
              <p className={`flex gap-2 rounded-md border p-2 text-xs ${
                b.remainingHours < 0
                  ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300'
                  : 'text-muted-foreground'
              }`}>
                {b.remainingHours < 0
                  ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  : <Info className="h-4 w-4 shrink-0 mt-0.5" />}
                <span>{data.caveat}</span>
              </p>

              <p className="text-xs text-muted-foreground">{data.accrual.note}</p>

              {data.value
                ? <p className="text-xs text-muted-foreground">{data.value.note}</p>
                : <p className="text-xs text-amber-700 dark:text-amber-400">{data.rateNote}</p>}

              {b.unpaidHours > 0 && (
                <p className="text-xs text-muted-foreground">
                  Plus {b.unpaidHours}h of approved unpaid leave, which is time away but spends no entitlement.
                </p>
              )}

              {data.carriedIn?.minutes !== 0 && (
                <p className="text-xs text-muted-foreground">{data.carriedIn.note}</p>
              )}
            </CardContent>
          </Card>

          {/* ⚠️ ACHU-291, owner rule 2: „Concediu se ia tot pe parcursul anului."
              Its own card because a target nothing watches is a wish — and because
              nothing expires, the only cost of not noticing is a debt that keeps
              growing. Amber, but not alarming: nobody is losing anything. */}
          {takingPaceView?.status === 'behind' && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="pt-6 space-y-2 text-sm">
                <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {person?.name ?? 'This person'} is behind on taking their holiday
                </p>
                <p className="text-muted-foreground">{takingPaceView.note}</p>
                <p className="text-xs text-muted-foreground">
                  Nothing is lost either way — everything carries into the next year, and nothing expires. But
                  untaken holiday is money the business owes, and hours that keep rolling forward have to be paid
                  eventually, in time off or in cash when somebody leaves.
                </p>
              </CardContent>
            </Card>
          )}

          {/* ⚠️ ACHU-290. The settled-contract warning gets its own card, in amber,
              because it is the one thing on this screen that can mean somebody is
              being UNDERPAID — and it would disappear as a fifth grey footnote. */}
          {entitlement?.shortfallHours != null && entitlement.shortfallHours > 0 && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="pt-6 space-y-2 text-sm">
                <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  This person may be entitled to more holiday than has accrued
                </p>
                <p className="text-muted-foreground">
                  {person?.name ?? 'They'} have a settled{' '}
                  <strong>{entitlement.fixedWeek.contractedHoursPerWeek}-hour week</strong> recorded, and 5.6 weeks
                  of that is <strong>{entitlement.fixedWeek.annualHours}h</strong> a year — about{' '}
                  {entitlement.fixedExpectedByNowHours}h by today. The accrual is{' '}
                  {entitlement.accruedHours}h, so it is{' '}
                  <strong>{entitlement.shortfallHours}h behind</strong>.
                </p>
                <p className="text-xs text-muted-foreground">
                  {entitlement.note}
                </p>
                <p className="text-xs text-muted-foreground">
                  Two innocent explanations before you worry: timesheets not yet entered or not yet approved, or
                  the person genuinely works fewer hours than the contract says. If neither is true, the contracted
                  week may be the figure to pay from — or the wrong figure to have on the profile.
                </p>
              </CardContent>
            </Card>
          )}

          {/* ACHU-291: TOTUL se reportează (`appliedToNextYear` e `true` literal în carryOverView). */}
          {carryOver?.yearComplete && carryOver.untakenHours > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-2 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {carryOver.untakenHours}h were left unused when this leave year ended — and carried forward
                </p>
                <p className="text-xs text-muted-foreground">{carryOver.note}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              {requests.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No leave recorded for {person?.name ?? 'this person'} in these dates.
                </div>
              ) : (
                <div tabIndex={0} className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th scope="col" className="py-2 pr-3">Dates</th>
                        <th scope="col" className="py-2 pr-3">Hours</th>
                        <th scope="col" className="py-2 pr-3">Kind</th>
                        <th scope="col" className="py-2 pr-3">Status</th>
                        <th scope="col" className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map(r => (
                        <tr key={r.id} className="border-b last:border-0 align-top">
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {r.startDate}
                            {r.endDate !== r.startDate && <> → {r.endDate}</>}
                            {r.notes && <span className="block text-xs text-muted-foreground">{r.notes}</span>}
                          </td>
                          <td className="py-2 pr-3 font-medium whitespace-nowrap">{r.hours}h</td>
                          <td className="py-2 pr-3">{KIND_LABEL[r.kind] ?? r.kind}</td>
                          <td className="py-2 pr-3">
                            <Badge className={STATUS_STYLE[r.status] ?? ''}>{r.status}</Badge>
                            {r.decidedBy && (
                              <span className="block text-xs text-muted-foreground">by {r.decidedBy}</span>
                            )}
                            {r.decisionNote && (
                              <span className="block text-xs text-muted-foreground">{r.decisionNote}</span>
                            )}
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1 justify-end">
                              {r.status === 'Requested' && (
                                <>
                                  <Button size="sm" variant="outline" disabled={busy}
                                    onClick={() => act(() => approveLeave(r.id), 'Leave approved.')}>
                                    <Check className="h-4 w-4 mr-1" />Approve
                                  </Button>
                                  <Button size="sm" variant="ghost" disabled={busy}
                                    onClick={() => { setDeclining(r); setReason(''); }}>
                                    <X className="h-4 w-4 mr-1" />Decline
                                  </Button>
                                </>
                              )}
                              {r.status === 'Approved' && (
                                <Button size="sm" variant="outline" disabled={busy}
                                  onClick={() => act(() => cancelLeave(r.id), 'Leave cancelled — the hours are back.')}>
                                  <Undo2 className="h-4 w-4 mr-1" />Cancel
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" disabled={busy || r.status === 'Approved'}
                                title={r.status === 'Approved' ? 'Cancel it and raise a new request — the person may have arranged their life around these dates.' : undefined}
                                onClick={() => setForm({
                                  id: r.id, kind: r.kind, startDate: r.startDate, endDate: r.endDate,
                                  hours: String(r.hours), notes: r.notes ?? '',
                                })}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" disabled={busy || r.status === 'Approved'}
                                title={r.status === 'Approved' ? 'Approved leave cannot be deleted — cancel it, which keeps the decision on the record.' : undefined}
                                onClick={() => act(() => deleteLeaveRequest(r.id), 'Request deleted.')}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={form != null} onOpenChange={o => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Change this request' : 'Record leave'}</DialogTitle>
            <DialogDescription>
              {person ? `For ${person.name}. ` : ''}
              Saved as waiting to be approved — asking and granting are two different things, and only the second
              spends an entitlement.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="grid gap-3">
              <div>
                <Label htmlFor="lf-kind">Kind</Label>
                <Select value={form.kind} onValueChange={v => setForm({ ...form, kind: v })}>
                  <SelectTrigger id="lf-kind"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(KIND_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.kind === 'Unpaid' && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Unpaid leave is recorded but spends no holiday entitlement.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="lf-start">First day</Label>
                  <DateField id="lf-start" value={form.startDate}
                    onChange={e => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="lf-end">Last day</Label>
                  <DateField id="lf-end" value={form.endDate}
                    onChange={e => setForm({ ...form, endDate: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="lf-hours">Hours</Label>
                  <Input id="lf-hours" type="number" min="0" step="0.5" value={form.hours}
                    onChange={e => setForm({ ...form, hours: e.target.value })} />
                </div>
              </div>
              {/* Said here rather than left as a puzzle: people expect a day off to be
                  a day, and for variable hours it cannot be. */}
              <p className="text-xs text-muted-foreground">
                Hours, not days — a day off is not a fixed number of hours for somebody whose hours vary, and
                the accrual it comes out of is measured in hours.
              </p>
              <div>
                <Label htmlFor="lf-notes">Notes</Label>
                <Textarea id="lf-notes" rows={2} value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={declining != null} onOpenChange={o => !o && setDeclining(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Why is this being declined?</DialogTitle>
            <DialogDescription>
              A reason is required. Refusing somebody's time off without saying why is a dead end for whoever
              picks it up next, and the person has a right to know what was decided.
            </DialogDescription>
          </DialogHeader>
          <Textarea aria-label="Why is this being declined?" value={reason} rows={3} onChange={e => setReason(e.target.value)}
            placeholder="e.g. Two people are already off that week" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclining(null)} disabled={busy}>Cancel</Button>
            <Button disabled={busy || reason.trim().length < 3}
              onClick={() => declining && act(() => declineLeave(declining.id, reason), 'Declined.')
                .then(() => setDeclining(null))}>
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

