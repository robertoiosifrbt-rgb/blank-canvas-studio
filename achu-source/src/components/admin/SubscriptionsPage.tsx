/**
 * Sesiunea 45 (backlog 53) — selling a prepaid term of cleaning.
 *
 * Owner asked for "un abonament personalizat. Care poate fi creat pe loc in
 * functie de nevoia clientului", so this screen is built around a live preview
 * rather than a list of fixed packages: pick the contract, type a term, a price
 * and a discount, and the exact figures the customer will be quoted appear
 * before anything is saved.
 *
 * Two things are said out loud on the screen rather than left to be discovered:
 *
 * 1. **What cancelling would refund.** The rule is not the obvious one — the
 *    customer loses the discount and the visits already done are charged at full
 *    price. That is the owner's decision, and the office quotes it on the phone,
 *    so the sentence is on the page and on the cancel dialog, not in a document.
 *
 * 2. **That a term is not paid until it is marked paid.** A Draft term does not
 *    stop its visits being invoiced. If that were hidden, an unpaid term would
 *    look identical to a paid one and the office would stop billing visits
 *    nobody had paid for.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  getSubscriptions, getSubscription, getSubscriptionOptions, previewSubscription,
  createSubscription, setSubscriptionStatus, cancelSubscription, getRecurringSeriesList,
  issueInvoice, getInvoices, type RecurringSeriesListRow,
  type SubscriptionRow, type SubscriptionDetail, type SubscriptionPreview,
  type SubscriptionOptions, type SubscriptionInvoice,
} from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import DateField from '@/components/shared/DateField';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BadgePoundSterling, AlertCircle, Inbox, Loader2, CalendarRange, Percent, Info } from 'lucide-react';
import { toast } from 'sonner';
import { fmtDate, fmt } from '@/lib/format';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import RefreshButton from '@/components/shared/RefreshButton';
import { errMsg } from '@/lib/errorMessage';
// ACHU-582 — casele acoperite de un termen. Secțiune proprie, cu stările ei de încărcare.
import SubscriptionPropertiesSection from './SubscriptionPropertiesSection';

/**
 * ⛔ **Formele răspunsurilor NU se mai declară aici** — stau lângă funcțiile care le cer
 * (`subscriptionEndpoints.ts`), inclusiv nota despre de ce banii sunt `string` și
 * previzualizarea `number`. Mutate în ACHU-401 felia 13, când regula de mărime (`AGENT_RULES`
 * §7, punctul 4) a cerut ca o modificare a acestui fișier să **extragă** o responsabilitate.
 *
 * 🔴 ACHU-401 (felia 12) — `ContractOption` era scris de mână și numea un câmp **inexistent**
 * (`recurringSeriesId`; ruta îl întoarce ca `reference`), deci lista scria numărul gol. Vine
 * acum de la funcția care produce rândul, ca următoarea redenumire să pice la compilare.
 */
type ContractOption = RecurringSeriesListRow;

const STATUS_STYLE: Record<string, string> = {
  'Draft': 'bg-muted text-muted-foreground',
  'Awaiting Payment': 'bg-amber-100 text-amber-800',
  'Active': 'bg-emerald-100 text-emerald-800',
  'Completed': 'bg-sky-100 text-sky-800',
  'Cancelled': 'bg-rose-100 text-rose-800',
};

/** Plain words, not jargon — this is what the office reads out on the phone. */
const STATUS_MEANING: Record<string, string> = {
  'Draft': 'Set up, payment not asked for yet. Jobs are invoiced as normal.',
  'Awaiting Payment': 'Payment has been asked for, the money has not arrived. Jobs are still invoiced as normal.',
  'Active': 'Paid. Jobs inside the term are NOT invoiced separately.',
  'Completed': 'The term has ended.',
  'Cancelled': 'Cancelled, with the refund worked out.',
};

export default function SubscriptionsPage() {
  const req = useTrackedRequest<SubscriptionRow[]>({ timeoutMs: 30000 });
  const [status, setStatus] = useState('All');
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(() => {
    req.fire(() => getSubscriptions(status === 'All' ? {} : { status }));
  }, [req.fire, status]);

  useEffect(() => { load(); }, [load]);

  const rows = req.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BadgePoundSterling className="h-6 w-6" /> Subscriptions
          </h1>
          <p className="text-sm text-muted-foreground">
            A term of cleaning paid for in full up front, at a discount. Built on top of a recurring contract.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[190px]" aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['All', 'Draft', 'Awaiting Payment', 'Active', 'Completed', 'Cancelled'].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <RefreshButton onRefresh={load} />
          <Button onClick={() => setCreating(true)}>New subscription</Button>
        </div>
      </div>

      {req.error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 flex items-start gap-2 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" />
            <span>{req.error}</span>
          </CardContent>
        </Card>
      )}

      {req.loading && <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>}

      {!req.loading && !req.error && rows.length === 0 && (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No subscriptions{status !== 'All' ? ` with the status "${status}"` : ''}.</p>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {rows.map(s => (
          <Card key={s.id} className="cursor-pointer hover:bg-accent/40" onClick={() => setDetailId(s.id)}>
            <CardContent className="pt-5 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">#{s.subscriptionId} · {s.customerName ?? 'Unknown customer'}</span>
                    <Badge className={STATUS_STYLE[s.status] ?? ''}>{s.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {s.service} · {s.termMonths} {s.termMonths === 1 ? 'month' : 'months'} · {fmtDate(s.startDate)} → {fmtDate(s.endDate)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{STATUS_MEANING[s.status]}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold">{fmt(Number(s.prepaidAmount))}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.expectedVisits} {s.expectedVisits === 1 ? 'job' : 'jobs'} × {fmt(Number(s.pricePerVisit))}
                  </div>
                  {Number(s.discountPercent) > 0 && (
                    <div className="text-xs text-emerald-700">−{Number(s.discountPercent)}% off {fmt(Number(s.fullPricePerVisit))}</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {creating && <CreateDialog onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
      {detailId && <DetailDialog id={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
}

/**
 * Nothing is saved until Save is pressed, and Save is disabled until a preview
 * has succeeded — so the figures stored are always figures somebody looked at.
 */
function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [options, setOptions] = useState<SubscriptionOptions>(null);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [seriesId, setSeriesId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [termMonths, setTermMonths] = useState(3);
  const [fullPrice, setFullPrice] = useState('');
  const [discount, setDiscount] = useState('5');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<SubscriptionPreview>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSubscriptionOptions().then(setOptions).catch(() => setOptions(null));
    // `?? d` era o plasă pentru „ruta întoarce direct vectorul". Nu o face niciodată; tipul o spune.
    getRecurringSeriesList({ status: 'active' }).then(d => setContracts(d.records ?? [])).catch(() => setContracts([]));
  }, []);

  const chosen = contracts.find(c => c.id === seriesId);

  // Prefill from the contract, so the common case is "check and confirm" rather
  // than "retype what the system already knows".
  useEffect(() => {
    if (!chosen) return;
    if (!fullPrice && chosen.amountCharged != null) setFullPrice(String(Number(chosen.amountCharged)));
    if (!startDate && chosen.startDate) setStartDate(String(chosen.startDate).slice(0, 10));
  }, [chosen]);

  function applySuggestedDiscount(months: number) {
    setTermMonths(months);
    const match = options?.suggestedTermMonths?.find(t => t.months === months);
    if (match) setDiscount(String(match.suggestedDiscountPercent));
    setPreview(null);
  }

  async function doPreview() {
    setBusy(true); setPreviewError(null); setPreview(null);
    try {
      const result = await previewSubscription({
        recurringSeriesId: seriesId,
        startDate,
        termMonths,
        fullPricePerVisit: Number(fullPrice),
        discountPercent: Number(discount),
      });
      setPreview(result);
    } catch (e) {
      setPreviewError(errMsg(e) ?? 'Could not work that out.');
    } finally {
      setBusy(false);
    }
  }

  async function doSave() {
    setSaving(true);
    try {
      await createSubscription({
        recurringSeriesId: seriesId,
        startDate,
        termMonths,
        fullPricePerVisit: Number(fullPrice),
        discountPercent: Number(discount),
        notes: notes.trim() || undefined,
      });
      toast.success('Subscription created as a draft. Mark it paid when the money arrives.');
      onCreated();
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  const ready = seriesId && startDate && Number(fullPrice) > 0;

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New subscription</DialogTitle>
          <DialogDescription>
            Pick the recurring contract that produces the jobs, then the term and the discount. You see the figures before you save.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="subscripti-recurring-contract">Recurring contract</Label>
            <Select value={seriesId} onValueChange={v => { setSeriesId(v); setPreview(null); }}>
              <SelectTrigger id="subscripti-recurring-contract"><SelectValue placeholder="Choose an active contract" /></SelectTrigger>
              <SelectContent>
                {contracts.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {/* `reference`, nu `recurringSeriesId` — vezi nota de la `ContractOption`. */}
                    #{c.reference} · {c.customerName ?? '—'} · {c.service}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {contracts.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                There are no active recurring contracts. A subscription needs a contract underneath it to create the jobs — set one up under <strong>Recurring</strong> first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="subscripti-starts-on">Starts on</Label>
              <DateField id="subscripti-starts-on" value={startDate} onChange={e => { setStartDate(e.target.value); setPreview(null); }} />
            </div>
            {/* ACHU-523: titlu peste un GRUP de butoane de alegere, nu eticheta unui câmp. */}
            <div role="group" aria-labelledby="subscription-term-label">
              <Label id="subscription-term-label">Term (months)</Label>
              <div className="flex gap-1 flex-wrap mt-1">
                {(options?.suggestedTermMonths ?? []).map(t => (
                  <Button
                    key={t.months}
                    type="button"
                    size="sm"
                    variant={termMonths === t.months ? 'default' : 'outline'}
                    onClick={() => applySuggestedDiscount(t.months)}
                  >
                    {t.months} {t.months === 1 ? 'month' : 'months'}
                  </Button>
                ))}
              </div>
              <Input aria-label="Term length in months"
                type="number" min={1} max={options?.maxTermMonths ?? 24} className="mt-2"
                value={termMonths}
                onChange={e => { setTermMonths(Number(e.target.value)); setPreview(null); }}
              />
              <p className="text-xs text-muted-foreground mt-1">The buttons are shortcuts. You can type any number of months.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="subscripti-full-price-per-visit">Full price per job (£)</Label>
              <Input id="subscripti-full-price-per-visit" type="number" step="0.01" min="0" value={fullPrice} onChange={e => { setFullPrice(e.target.value); setPreview(null); }} />
              <p className="text-xs text-muted-foreground mt-1">The normal price, before any discount. This is the one used to work out the refund if it gets cancelled.</p>
            </div>
            <div>
              <Label htmlFor="subscripti-discount" className="flex items-center gap-1"><Percent className="h-3 w-3" /> Discount (%)</Label>
              <Input id="subscripti-discount" type="number" step="0.5" min="0" max={options?.maxDiscountPercent ?? 60} value={discount} onChange={e => { setDiscount(e.target.value); setPreview(null); }} />
              <p className="text-xs text-muted-foreground mt-1">You set this, per customer. The suggestion changes with the term, but it does not tie your hands.</p>
            </div>
          </div>

          <Button type="button" variant="secondary" disabled={!ready || busy} onClick={doPreview} className="w-full">
            {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Working it out…</> : 'Work out the figures'}
          </Button>

          {previewError && (
            <div className="text-sm flex items-start gap-2 text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{previewError}</span>
            </div>
          )}

          {preview && (
            <Card className="bg-accent/40">
              <CardContent className="pt-5 space-y-2 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <CalendarRange className="h-4 w-4" />
                  {fmtDate(preview.startDate)} → {fmtDate(preview.endDate)}
                </div>
                <p className="text-muted-foreground">{preview.scheduleDescription}</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div><span className="text-muted-foreground">Jobs:</span> <strong>{preview.expectedVisits}</strong></div>
                  <div><span className="text-muted-foreground">Per job:</span> <strong>{fmt(preview.pricePerVisit)}</strong></div>
                  <div><span className="text-muted-foreground">Without the discount it would be:</span> {fmt(preview.fullTermAmount)}</div>
                  <div className="text-emerald-700"><span className="text-muted-foreground">Saving:</span> <strong>{fmt(preview.savings)}</strong></div>
                </div>
                <div className="pt-2 border-t text-base">
                  To pay now, in full: <strong>{fmt(preview.prepaidAmount)}</strong>
                </div>
              </CardContent>
            </Card>
          )}

          {options?.cancellationRule && (
            <div className="text-xs flex items-start gap-2 text-muted-foreground border rounded-md p-3">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span><strong>If it is cancelled:</strong> {options.cancellationRule}</span>
            </div>
          )}

          <div>
            <Label htmlFor="subscripti-notes-optional">Notes (optional)</Label>
            <Textarea id="subscripti-notes-optional" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!preview || saving} onClick={doSave}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : 'Save as draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<SubscriptionDetail>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  // ACHU-251. Loaded separately from the term itself so that a failure to read
  // the invoices — a not-yet-run migration, say — cannot blank the whole dialog.
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);

  const load = useCallback(() => {
    setError(null);
    getSubscription({ id }).then(setData).catch((e: unknown) => setError(errMsg(e) ?? 'Could not load.'));
  }, [id]);

  const loadInvoices = useCallback(() => {
    getInvoices({ subscriptionId: id })
      .then(r => setInvoices(r?.records ?? []))
      .catch(() => setInvoices([]));
  }, [id]);

  useEffect(() => { load(); loadInvoices(); }, [load, loadInvoices]);

  async function move(status: 'Awaiting Payment' | 'Active' | 'Completed') {
    setBusy(true);
    try {
      const res = await setSubscriptionStatus({ id, status });
      toast.success(
        status === 'Active' && res?.visitsMarkedPrepaid
          ? `Marked paid. ${res.visitsMarkedPrepaid} existing ${res.visitsMarkedPrepaid === 1 ? 'job' : 'jobs'} will no longer be invoiced separately.`
          : 'Updated.',
      );
      load(); onChanged();
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not update.');
    } finally { setBusy(false); }
  }

  /**
   * ACHU-251. One invoice for the whole term.
   *
   * Deliberately NOT offered for a Draft term (its figures can still change) or a
   * cancelled one (the money went back). It IS offered before payment, because
   * billing first is the ordinary direction — the owner's first term simply
   * happened to be paid before anyone asked for a document.
   */
  async function raiseInvoice() {
    setBusy(true);
    try {
      const res = await issueInvoice({ subscriptionId: id });
      toast.success(`Invoice ${res?.invoice?.invoiceNumber} raised for the whole term.`);
      loadInvoices();
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not raise the invoice.');
    } finally { setBusy(false); }
  }

  async function doCancel() {
    setBusy(true);
    try {
      const res = await cancelSubscription({ id, reason: reason.trim() });
      toast.success(res?.refund?.explanation ?? 'Cancelled.');
      setCancelling(false); load(); onChanged();
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not cancel.');
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data ? `Subscription #${data.subscriptionId}` : 'Subscription'}</DialogTitle>
          <DialogDescription>{data?.customerName ?? ''}</DialogDescription>
        </DialogHeader>

        {error && <div className="text-sm text-destructive flex items-start gap-2"><AlertCircle className="h-4 w-4 mt-0.5" />{error}</div>}
        {!data && !error && <Skeleton className="h-40 w-full" />}

        {data && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={STATUS_STYLE[data.status] ?? ''}>{data.status}</Badge>
              <span className="text-muted-foreground">{STATUS_MEANING[data.status]}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Term:</span> {fmtDate(data.startDate)} → {fmtDate(data.endDate)}</div>
              <div><span className="text-muted-foreground">Months:</span> {data.termMonths}</div>
              <div><span className="text-muted-foreground">Jobs sold:</span> {data.expectedVisits}</div>
              <div><span className="text-muted-foreground">Jobs carried out:</span> {data.visitsCompleted}</div>
              <div><span className="text-muted-foreground">Full price per job:</span> {fmt(Number(data.fullPricePerVisit))}</div>
              <div><span className="text-muted-foreground">With the discount:</span> {fmt(Number(data.pricePerVisit))} (−{Number(data.discountPercent)}%)</div>
              <div className="col-span-2 pt-1 border-t">
                <span className="text-muted-foreground">Paid in full:</span> <strong>{fmt(Number(data.prepaidAmount))}</strong>
                {data.paidAt && <span className="text-muted-foreground"> · on {fmtDate(data.paidAt)}</span>}
              </div>
            </div>

            {data.scheduleDescription && <p className="text-muted-foreground">{data.scheduleDescription}</p>}

            {/*
              🔴 ACHU-582 — casele acoperite de termen. Sub cifrele lui, fiindcă răspund la
              întrebarea următoare a aceleiași conversații: „am plătit 900 £ — pentru ce?"
              ⚠️ Secțiune proprie: `CLAUDE.md` §3.2, iar fișierul ăsta e destul de mare.
            */}
            <SubscriptionPropertiesSection
              subscriptionId={id}
              customerId={data.customerId}
              termStatus={data.status}
              onChanged={() => { load(); onChanged(); }}
            />

            {data.refundIfCancelledNow && (
              <Card className="bg-accent/40"><CardContent className="pt-4 text-sm">
                <p className="font-medium">If it were cancelled now:</p>
                <p className="text-muted-foreground mt-1">{data.refundIfCancelledNow.explanation}</p>
              </CardContent></Card>
            )}

            {data.status === 'Cancelled' && (
              <Card className="border-rose-200"><CardContent className="pt-4 text-sm space-y-1">
                <p className="font-medium">Cancelled{data.cancelledAt ? ` on ${fmtDate(data.cancelledAt)}` : ''}</p>
                <p className="text-muted-foreground">{data.cancellationReason}</p>
                <p>{data.refundExplanation}</p>
                <p>Refund: <strong>{fmt(Number(data.refundAmount ?? 0))}</strong></p>
              </CardContent></Card>
            )}

            {data.jobs?.length > 0 && (
              /* ACHU-523: titlu peste o listă de citit. Nu e un câmp, deci nu are `htmlFor`. */
              <div role="group" aria-labelledby="subscription-visits-label">
                <Label id="subscription-visits-label">Jobs covered ({data.jobs.length})</Label>
                <div className="mt-1 max-h-40 overflow-y-auto border rounded-md divide-y">
                  {data.jobs.map(j => (
                    <div key={j.id} className="px-3 py-1.5 flex justify-between">
                      <span>#{j.jobId} · {fmtDate(j.jobDate)}</span>
                      <span className="text-muted-foreground">{j.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {invoices.length > 0 && (
              <div role="group" aria-labelledby="subscription-invoices-label">
                <Label id="subscription-invoices-label">Invoices ({invoices.length})</Label>
                <div className="mt-1 border rounded-md divide-y">
                  {invoices.map(i => (
                    <div key={i.id} className="px-3 py-1.5 flex justify-between">
                      <span>{i.invoiceNumber} · {fmt(Number(i.grossAmount))}</span>
                      {/* A void invoice stays on the list on purpose: the number
                          is reserved forever and can never be reused, so hiding it
                          would make the sequence look like it had a gap. */}
                      <span className={i.status === 'Void' ? 'text-destructive' : 'text-muted-foreground'}>{i.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cancelling ? (
              <div className="space-y-2 border rounded-md p-3">
                <Label htmlFor="subscripti-why-is-it-being">Why is it being cancelled?</Label>
                <Textarea id="subscripti-why-is-it-being" value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="e.g. the customer has moved out" />
                <p className="text-xs text-muted-foreground">
                  The jobs already carried out are charged at the <strong>full</strong> price, not the discounted one. The refund is worked out automatically.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCancelling(false)}>Go back</Button>
                  <Button variant="destructive" size="sm" disabled={!reason.trim() || busy} onClick={doCancel}>
                    Cancel the subscription
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {/* Shown for every status that can carry one, and hidden once it
                    has one — a second click could only ever be refused, and a
                    button that cannot succeed should not be under the thumb. */}
                {['Awaiting Payment', 'Active', 'Completed'].includes(data.status)
                  && !invoices.some(i => i.status !== 'Void') && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={raiseInvoice}>Raise the invoice</Button>
                )}
                {data.status === 'Draft' && <Button size="sm" disabled={busy} onClick={() => move('Awaiting Payment')}>Ask for payment</Button>}
                {data.status === 'Awaiting Payment' && <Button size="sm" disabled={busy} onClick={() => move('Active')}>The money has arrived</Button>}
                {data.status === 'Active' && <Button size="sm" variant="secondary" disabled={busy} onClick={() => move('Completed')}>End the term</Button>}
                {['Draft', 'Awaiting Payment', 'Active'].includes(data.status) && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setCancelling(true)}>Cancel…</Button>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

