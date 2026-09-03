import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, CalendarPlus, Info } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import DateField from '@/components/shared/DateField';
import TimeField from '@/components/shared/TimeField';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import SearchablePicker, { type PickerOption } from '../shared/SearchablePicker';
import DiscardChangesDialog from '../shared/DiscardChangesDialog';
import AuditHistory from './AuditHistory';
import { useUnsavedGuard } from '@/lib/useUnsavedGuard';
import {
  getCustomers, getCleaners, saveRecurringSeries, getRecurringSeries,
  generateRecurringVisits, applyRecurringSeriesToFuture,
} from '@/lib/endpoints';
import { ukToday } from '@/lib/ukDate';
import { showGenerationOutcome } from '@/lib/recurringGenerationFeedback';
// ACHU-401: formele și formularul gol stau în fișierul lor — vezi antetul de acolo.
import {
  type EndMode, type RecurringSeriesRecord, type CleanerOption, emptyForm,
} from '@/lib/recurringSeriesTypes';
export type { RecurringSeriesRecord };
import { fmt } from '@/lib/format';
import { WEEKDAYS, CADENCE_PRESETS, presetKeyFor, describeCadence } from '@/lib/cadenceWording';
import { errMsg } from '@/lib/errorMessage';

/**
 * Sesiunea 32 (backlog 18 — Recurring services).
 *
 * ─── The wording is the feature ──────────────────────────────────────────
 * The owner and Denisa are not developers. "Interval", "occurrence" and
 * "horizon" are the words in the data model, and none of them appear on this
 * form. It asks "how often", "repeat every", "stop after"; the cadence is spelled
 * out as a sentence the server composes, so nobody has to work out what
 * "frequency: weekly, interval: 2" means.
 *
 * ─── Days of the week are buttons, not a multi-select ────────────────────
 * Seven toggles fit on a phone and show their state at a glance. A multi-select
 * dropdown hides the answer behind a click, which for the single most important
 * field on the form is the wrong trade.
 */



export default function RecurringSeriesDialog({
  open, onClose, item, onSaved,
}: { open: boolean; onClose: () => void; item: RecurringSeriesRecord; onSaved: () => void }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [cleaners, setCleaners] = useState<CleanerOption[]>([]);
  const [detail, setDetail] = useState<RecurringSeriesRecord>(null);
  const [busy, setBusy] = useState(false);

  const guard = useUnsavedGuard({ onClose });
  guard.track(form);

  const searchCustomers = useCallback(async (q: string): Promise<PickerOption[]> => {
    const d = await getCustomers(q ? { search: q } : {});
    return d.records.map(c => ({ id: c.id, label: c.customerName, data: { address: c.address } }));
  }, []);

  useEffect(() => {
    getCleaners({}).then(res => setCleaners(res.records ?? [])).catch(() => {
      // The cleaner list is a convenience — a contract can be created without
      // default cleaners and they can be assigned per visit.
    });
  }, []);

  useEffect(() => {
    if (!item) {
      const initial = { ...emptyForm, startDate: ukToday() };
      setForm(initial);
      guard.captureBaseline(initial);
      setDetail(null);
      return;
    }
    const initial = {
      customer: item.customerId ?? '',
      frequency: item.frequency ?? 'weekly',
      interval: item.interval ?? 1,
      // Derived, and present on BOTH the new and the edit path: the unsaved-changes
      // guard compares the form against a baseline captured from this object, so a
      // key that appears only later would read as an edit the user never made.
      customCadence: presetKeyFor(item.frequency ?? 'weekly', item.interval ?? 1) === 'custom',
      weekdays: item.weekdays ?? [],
      dayOfMonth: item.dayOfMonth != null ? String(item.dayOfMonth) : '',
      startDate: item.startDate ?? ukToday(),
      // Derived rather than stored: the server refuses both an end date and a
      // count, so the three are genuinely one choice and modelling them as one
      // control is what stops an invalid combination being submitted at all.
      endMode: item.occurrenceCount ? 'count' : item.endDate ? 'date' : 'never',
      endDate: item.endDate ?? '',
      occurrenceCount: item.occurrenceCount != null ? String(item.occurrenceCount) : '',
      service: item.service ?? '',
      address: item.address ?? '',
      startTime: item.startTime ?? '',
      finishTime: item.finishTime ?? '',
      amountCharged: item.amountCharged != null ? String(item.amountCharged) : '',
      customerInstructions: item.customerInstructions ?? '',
      defaultCleanerIds: item.defaultCleanerIds ?? [],
      priceReviewDate: item.priceReviewDate ?? '',
      notes: item.notes ?? '',
    } as typeof emptyForm;
    setForm(initial);
    guard.captureBaseline(initial);

    getRecurringSeries({ id: item.id }).then(res => setDetail(res.record)).catch(() => setDetail(null));
  }, [item, open]);

  const toggleWeekday = (value: number) =>
    setForm(f => ({ ...f, weekdays: f.weekdays.includes(value) ? f.weekdays.filter(d => d !== value) : [...f.weekdays, value] }));

  const toggleCleaner = (id: string) =>
    setForm(f => ({ ...f, defaultCleanerIds: f.defaultCleanerIds.includes(id) ? f.defaultCleanerIds.filter(c => c !== id) : [...f.defaultCleanerIds, id] }));

  const handleSave = async () => {
    if (!form.customer || !form.service.trim() || !form.startDate) {
      toast.error('Customer, service and start date are required');
      return;
    }
    setSaving(true);
    try {
      const res = await saveRecurringSeries({
        id: item?.id,
        customer: form.customer,
        frequency: form.frequency,
        interval: Number(form.interval) || 1,
        weekdays: form.frequency === 'weekly' ? form.weekdays : undefined,
        dayOfMonth: form.frequency === 'monthly' && form.dayOfMonth ? Number(form.dayOfMonth) : null,
        startDate: form.startDate,
        endDate: form.endMode === 'date' && form.endDate ? form.endDate : null,
        occurrenceCount: form.endMode === 'count' && form.occurrenceCount ? Number(form.occurrenceCount) : null,
        service: form.service.trim(),
        address: form.address.trim() || null,
        startTime: form.startTime || null,
        finishTime: form.finishTime || null,
        amountCharged: form.amountCharged === '' ? null : Number(form.amountCharged),
        customerInstructions: form.customerInstructions.trim() || null,
        defaultCleanerIds: form.defaultCleanerIds,
        priceReviewDate: form.priceReviewDate || null,
        notes: form.notes.trim() || null,
      });

      guard.markSaved();
      if (res.futureVisitsUnchanged > 0) {
        // Said out loud, because the alternative is someone discovering next week
        // that the price change never reached the visits.
        toast.success('Contract saved', {
          description: `${res.futureVisitsUnchanged} job(s) already in the diary keep their old details. Use "Apply to future jobs" below if you want them updated.`,
        });
      } else {
        toast.success(res.description ?? 'Contract saved');
      }
      onSaved();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not save the contract.');
    } finally {
      setSaving(false);
    }
  };

  const bookAhead = async () => {
    if (!item?.id) return;
    setBusy(true);
    try {
      showGenerationOutcome(await generateRecurringVisits({ id: item.id }), true);
      const fresh = await getRecurringSeries({ id: item.id });
      setDetail(fresh.record);
    } catch (e) {
      toast.error(errMsg(e) || 'Could not create the jobs.');
    } finally {
      setBusy(false);
    }
  };

  const applyToFuture = async () => {
    if (!item?.id) return;
    if (!window.confirm('Update the future jobs already in the diary to match this contract?\n\nVisits somebody has moved or confirmed are left alone.')) return;
    setBusy(true);
    try {
      const res = await applyRecurringSeriesToFuture({ id: item.id });
      toast.success(`${res.updated} job(s) updated`, {
        description: res.skippedRescheduled ? `${res.skippedRescheduled} left alone because they had been moved.` : undefined,
      });
      const fresh = await getRecurringSeries({ id: item.id });
      setDetail(fresh.record);
    } catch (e) {
      toast.error(errMsg(e) || 'Could not update the jobs.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={o => { if (!o) guard.requestClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{item ? 'Recurring contract' : 'New recurring contract'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="flex gap-2 rounded-md border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                This sets the <strong>pattern</strong>. The jobs themselves are created from it — press{' '}
                <strong>Book ahead</strong> to put the next few weeks in the diary. Nothing is booked until you do.
              </span>
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label id="recseries-customer-label">Customer</Label>
                <SearchablePicker
                  labelId="recseries-customer-label"
                  value={form.customer}
                  selectedLabel={item?.customerName}
                  onSelect={(id, opt) => setForm(f => ({
                    ...f,
                    customer: id,
                    // Prefilled, not forced: many contracts are at the customer's
                    // registered address, but a landlord's cleaning is not.
                    address: f.address || String(opt?.data?.address ?? ''),
                  }))}
                  fetchOptions={searchCustomers}
                  placeholder="Search customers…"
                />
              </div>
              <div>
                <Label htmlFor="recurrings-service">Service</Label>
                <Input id="recurrings-service" value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} placeholder="e.g. Regular Clean" />
              </div>
            </div>

            <Separator />

            {/* ─── The pattern ──────────────────────────────────────── */}
            <div>
              <p className="mb-2 text-sm font-medium">How often</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  {/* ACHU-523: eticheta trebuie legată de comandă, altfel un cititor de ecran
                      anunță butonul fără să spună CE alege — la fel ca „Repeat unit" mai jos. */}
                  <Label htmlFor="recurrings-repeats" className="text-xs">Repeats</Label>
                  {/* One control in words instead of two that had to be combined
                      mentally. "Custom" keeps every pattern the server accepts
                      reachable, without making everybody pass through it. */}
                  <Select
                    value={presetKeyFor(form.frequency, Number(form.interval) || 1)}
                    onValueChange={v => {
                      if (v === 'custom') { setForm(f => ({ ...f, customCadence: true })); return; }
                      const p = CADENCE_PRESETS[Number(v)];
                      setForm(f => ({
                        ...f,
                        customCadence: false,
                        frequency: p.frequency,
                        interval: p.interval,
                        // Cleared on a change of frequency: weekdays mean nothing to
                        // a monthly pattern, and a stale value would be sent anyway.
                        weekdays: p.frequency === f.frequency ? f.weekdays : [],
                        dayOfMonth: p.frequency === f.frequency ? f.dayOfMonth : '',
                      }));
                    }}
                  >
                    <SelectTrigger id="recurrings-repeats"><SelectValue placeholder="Choose how often" /></SelectTrigger>
                    <SelectContent>
                      {CADENCE_PRESETS.map((p, i) => (
                        <SelectItem key={p.label} value={String(i)}>{p.label}</SelectItem>
                      ))}
                      <SelectItem value="custom">Something else…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="recurrings-starts" className="text-xs">Starts</Label>
                  <DateField id="recurrings-starts" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
              </div>

              {/* Only for a pattern none of the presets covers — e.g. every 6
                  weeks. Hidden otherwise, because two fields that restate each
                  other is what made this form unreadable in the first place. */}
              {(form.customCadence || presetKeyFor(form.frequency, Number(form.interval) || 1) === 'custom') && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="recurrings-repeat-unit" className="text-xs">Repeat unit</Label>
                    <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v as typeof emptyForm['frequency'], weekdays: [], dayOfMonth: '' }))}>
                      <SelectTrigger id="recurrings-repeat-unit"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weeks</SelectItem>
                        <SelectItem value="monthly">Months</SelectItem>
                        <SelectItem value="daily">Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="recurrings-once-every-how-many" className="text-xs">
                      Once every how many {form.frequency === 'weekly' ? 'weeks' : form.frequency === 'monthly' ? 'months' : 'days'}?
                    </Label>
                    <Input id="recurrings-once-every-how-many" type="number" min={1} max={52} value={form.interval} onChange={e => setForm(f => ({ ...f, interval: Number(e.target.value) }))} />
                  </div>
                </div>
              )}

              {form.frequency === 'weekly' && (
                <div className="mt-3">
                  {/* ACHU-523: un titlu peste ȘAPTE butoane, nu eticheta unei comenzi. `role="group"`
                      + `aria-labelledby` îl anunță ca grup — altfel cele șapte butoane se citesc
                      ca „L, Ma, Mi…" fără să se spună vreodată la ce se referă. */}
                  <Label id="recurrings-weekdays-label" className="text-xs">On which days</Label>
                  <div className="mt-1 flex gap-1" role="group" aria-labelledby="recurrings-weekdays-label">
                    {WEEKDAYS.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        aria-label={d.full}
                        aria-pressed={form.weekdays.includes(d.value)}
                        onClick={() => toggleWeekday(d.value)}
                        className={`h-9 w-9 rounded-md border text-xs font-medium transition-colors ${
                          form.weekdays.includes(d.value)
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        {d.short}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Leave all off to use the day of the start date.
                  </p>
                </div>
              )}

              {/* The answer to "what did I just set up?", on the screen where the
                  question arises. The list already showed a sentence like this;
                  the form, which is where it is needed, did not. */}
              <div className="mt-3 rounded-md bg-accent/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">This means: </span>
                <strong>{describeCadence(form)}</strong>
              </div>

              {form.frequency === 'monthly' && (
                <div className="mt-3 sm:w-1/3">
                  <Label htmlFor="recurrings-day-of-the-month" className="text-xs">Day of the month</Label>
                  <Input id="recurrings-day-of-the-month" type="number" min={1} max={31} value={form.dayOfMonth} onChange={e => setForm(f => ({ ...f, dayOfMonth: e.target.value }))} placeholder="from start date" />
                  {Number(form.dayOfMonth) > 28 && (
                    // Otherwise a customer on the 31st rings up in February.
                    <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                      In shorter months this falls on the last day.
                    </p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            <div>
              <p className="mb-2 text-sm font-medium">Until when</p>
              {/* One control, three options — because the server refuses an end
                  date and a count together, so they are genuinely one choice. */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="recurrings-ends" className="text-xs">Ends</Label>
                  <Select value={form.endMode} onValueChange={v => setForm(f => ({ ...f, endMode: v as EndMode }))}>
                    <SelectTrigger id="recurrings-ends"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Ongoing</SelectItem>
                      <SelectItem value="date">On a date</SelectItem>
                      <SelectItem value="count">After N jobs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.endMode === 'date' && (
                  <div>
                    <Label htmlFor="recurrings-end-date" className="text-xs">End date</Label>
                    <DateField id="recurrings-end-date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                )}
                {form.endMode === 'count' && (
                  <div>
                    <Label htmlFor="recurrings-number-of-visits" className="text-xs">Number of jobs</Label>
                    <Input id="recurrings-number-of-visits" type="number" min={1} max={520} value={form.occurrenceCount} onChange={e => setForm(f => ({ ...f, occurrenceCount: e.target.value }))} />
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* ─── Defaults stamped onto each visit ─────────────────── */}
            <div>
              <p className="mb-2 text-sm font-medium">Details for each job</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="recurrings-start-time" className="text-xs">Start time</Label><TimeField id="recurrings-start-time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} /></div>
                <div><Label htmlFor="recurrings-finish-time" className="text-xs">Finish time</Label><TimeField id="recurrings-finish-time" value={form.finishTime} onChange={e => setForm(f => ({ ...f, finishTime: e.target.value }))} /></div>
                <div><Label htmlFor="recurrings-price-per-visit" className="text-xs">Price per job</Label><Input id="recurrings-price-per-visit" type="number" step="0.01" min={0} value={form.amountCharged} onChange={e => setForm(f => ({ ...f, amountCharged: e.target.value }))} /></div>
                <div>
                  <Label htmlFor="recurrings-review-the-price-on" className="text-xs">Review the price on</Label>
                  <DateField id="recurrings-review-the-price-on" value={form.priceReviewDate} onChange={e => setForm(f => ({ ...f, priceReviewDate: e.target.value }))} />
                </div>
              </div>
              <div className="mt-3"><Label htmlFor="recurrings-address" className="text-xs">Address</Label><Input id="recurrings-address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="mt-3">
                <Label htmlFor="recurrings-instructions-for-the-cleaner" className="text-xs">Instructions for the cleaner</Label>
                <Textarea id="recurrings-instructions-for-the-cleaner" rows={2} value={form.customerInstructions} onChange={e => setForm(f => ({ ...f, customerInstructions: e.target.value }))} placeholder="e.g. key under the mat, dog in the garden" />
              </div>

              {cleaners.length > 0 && (
                <div className="mt-3">
                  <Label id="recurrings-cleaners-label" className="text-xs">Usual cleaner(s)</Label>
                  <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-labelledby="recurrings-cleaners-label">
                    {cleaners.filter(c => c.active !== false).map(c => (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={form.defaultCleanerIds.includes(c.id)}
                        onClick={() => toggleCleaner(c.id)}
                        className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                          form.defaultCleanerIds.includes(c.id)
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        {c.cleanerName}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Assigned automatically to each job created. Can still be changed per job.</p>
                </div>
              )}
            </div>

            <div><Label htmlFor="recurrings-notes-internal" className="text-xs">Notes (internal)</Label><Textarea id="recurrings-notes-internal" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>

            {/* ─── Existing series: the visits and the actions ──────── */}
            {item?.id && detail && (
              <>
                <Separator />
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">Jobs</p>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="h-8" disabled={busy} onClick={bookAhead}>
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CalendarPlus className="h-3.5 w-3.5 mr-1" />Book ahead</>}
                      </Button>
                      <Button variant="outline" size="sm" className="h-8" disabled={busy} onClick={applyToFuture}>
                        Apply to future jobs
                      </Button>
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs">{detail.description}</p>

                  {detail.visits.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">Nothing in the diary yet — press <strong>Book ahead</strong>.</p>
                  ) : (
                    <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto">
                      {detail.visits.map(v => (
                        <li key={v.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="tabular-nums">{v.date}</span>
                          <span className="text-muted-foreground truncate">
                            {v.startTime ?? '—'} · {v.status}
                            {/* So "why is there a clean on a Thursday" has an answer. */}
                            {v.rescheduled && <span className="ml-1 text-amber-600 dark:text-amber-400">moved</span>}
                          </span>
                          <span className="tabular-nums text-muted-foreground">{v.amountCharged != null ? fmt(v.amountCharged) : ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {detail.upcomingUngenerated?.length > 0 && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {/* A preview, not a promise. */}
                      Next dates in the pattern, <strong>not booked yet</strong>: {detail.upcomingUngenerated.slice(0, 5).join(', ')}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Every change to a standing commitment — price, cadence, pause,
                cancel, and the generation runs themselves — is on the record.
                "Who booked these twelve jobs" has to be answerable. */}
            {item?.id && <AuditHistory entityType="RecurringSeries" entityId={item.id} refreshKey={0} />}

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DiscardChangesDialog
        open={guard.confirmOpen}
        onDiscard={guard.discard}
        onKeepEditing={guard.keepEditing}
      />
    </>
  );
}

