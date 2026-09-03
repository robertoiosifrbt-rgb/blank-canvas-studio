import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import DateField from '@/components/shared/DateField';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useState, useEffect, useRef, useCallback } from 'react';
import { savePayment, getCustomers, getRefundInfo, getJobsForSelect, type JobForSelect } from '@/lib/endpoints';
// ACHU-746 — `paymentDate` sosește ca timestamp întreg din ruta de listă; vezi acolo de ce.
import { toDateInputValue } from '@/lib/ukDate';
// ACHU-401 (felia 19) — forma pe care o citește dialogul, aceeași cu a listei.
import type { PaymentRecord } from '@/lib/adminRecordTypes';
import SearchablePicker, { type PickerOption } from '../shared/SearchablePicker';
import DiscardChangesDialog from '../shared/DiscardChangesDialog';
import { useUnsavedGuard } from '@/lib/useUnsavedGuard';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Info, Upload, FileText, X } from 'lucide-react';
// §23 (Sesiunea 153) — dovada plății merge în bucket-ul privat EXISTENT, `receipts`.
import { uploadFile, getReceiptUrl } from '@/lib/storage';
import { MAX_PDF_BYTES } from '@/lib/validation';
import { fmtDate, fmt } from '@/lib/format';
import AuditHistory from './AuditHistory';
// §43 „Related payment" (Sesiunea 150) — urmărirea unui ban, notată de pe plată.
import TaskComposer from './TaskComposer';
import { computeRevision, REVISION_FIELDS } from '@/lib/concurrency';
import { errMsg } from '@/lib/errorMessage';

const methods = ['Card', 'Cash', 'Bank Transfer', 'Payment Link', 'Other'];
const providers = ['Square', 'Bank', 'Cash', 'Halifax', 'Other'];
const statuses = ['Pending', 'Received', 'Failed', 'Refunded', 'Cancelled'];

type DuplicateMatch = { paymentId?: number; paymentDate?: string; amount?: number; paymentStatus?: string; externalReference?: string; customerName?: string; jobLabel?: string };

type RefundInfoState = { totalActiveReceived: number; totalActiveRefunded: number; maxRefundable: number } | null;

export default function PaymentDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: PaymentRecord | null; onSaved: () => void }) {
  const [form, setForm] = useState({ job: '', paymentDate: '', amount: 0, paymentMethod: '', paymentProvider: '', paymentStatus: 'Pending', externalReference: '', notes: '', correctionNotes: '', refundReason: '' });
  // ACHU-200: kept OUT of `form` deliberately. This is a browse-only filter for
  // the Job picker — the payment's real customer is always derived server-side
  // from the chosen Job (payments.ts: `const customerId = job.customerId`), never
  // from anything sent here. Holding it in `form` is what caused the bug: picking
  // a Job wrote that Job's customer into the same field the Job list filters on,
  // so the list collapsed to that one customer and you could no longer switch to
  // another customer's Job.
  const [customerFilter, setCustomerFilter] = useState('');
  // Labels for what is currently picked, so reopening or re-rendering doesn't
  // need a lookup against a fully-loaded list (there isn't one any more).
  const [customerFilterLabel, setCustomerFilterLabel] = useState<string | undefined>(undefined);
  const [selectedJobLabel, setSelectedJobLabel] = useState<string | undefined>(undefined);
  // Which customer the chosen Job belongs to — needed only to decide whether a
  // newly applied browse filter would hide it (ACHU-200).
  const [selectedJobCustomerId, setSelectedJobCustomerId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  /**
   * §23 — dovada plății. ⚠️ Ținută în afara `form`, ca `receiptFileUrl` la cheltuieli: e o cale
   * de fișier scrisă de o încărcare, nu un câmp tastat, iar paznicul de modificări o urmărește
   * separat (mai jos, `guard.track`).
   */
  const [proofFileUrl, setProofFileUrl] = useState('');
  /**
   * ⚠️ **Calea ȘI adresa semnată, împreună**, nu adresa singură. ⛔ Ținute separat, efectul ar fi
   * trebuit să golească adresa sincron la fiecare schimbare de fișier — ceea ce pornește un lanț de
   * randări (și e chiar avertismentul pe care clichetul de lint nu-l lasă să apară). 🔴 Perechea
   * răspunde singură: cât timp calea nu se potrivește, nu e nimic de arătat.
   */
  const [proofPreview, setProofPreview] = useState<{ path: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);

  // ACHU-018: Use crypto.randomUUID() for idempotency tokens
  const idempotencyTokenRef = useRef('');
  const revisionRef = useRef<string | undefined>(undefined);
  // Sesiunea 29 (backlog 46): guard against losing typed edits on a stray close.
  const guard = useUnsavedGuard({ onClose });
  guard.track({ form, proofFileUrl });
  function generateToken() {
    idempotencyTokenRef.current = crypto.randomUUID();
  }

  // Duplicate warning
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [showDupWarning, setShowDupWarning] = useState(false);

  // FIX 1: Refund info
  const [refundInfo, setRefundInfo] = useState<RefundInfoState>(null);
  const [loadingRefundInfo, setLoadingRefundInfo] = useState(false);

  // Sesiunea 28: replaces the two eager loads (every customer + every job) that
  // ran on open purely to fill dropdowns. Both endpoints filter server-side.
  const searchCustomers = useCallback(async (q: string): Promise<PickerOption[]> => {
    const d = await getCustomers(q ? { search: q } : {});
    return d.records.map(c => ({ id: c.id, label: c.customerName }));
  }, []);

  const searchJobs = useCallback(async (q: string): Promise<PickerOption[]> => {
    const d = await getJobsForSelect({
      ...(q ? { search: q } : {}),
      ...(customerFilter ? { customerId: customerFilter } : {}),
    });
    return d.jobs.map((j: JobForSelect): PickerOption => ({
      id: j.id,
      label: `#${j.jobId} — ${j.service} (${j.customerName})`,
      hint: `· ${fmtDate(j.jobDate)}`,
      data: { customerId: j.customerId },
    }));
  }, [customerFilter]);

  useEffect(() => {
    if (item) {
      const initial = { job: item.jobId ?? '', paymentDate: toDateInputValue(item.paymentDate), amount: item.amount ?? 0, paymentMethod: item.paymentMethod ?? '', paymentProvider: item.paymentProvider ?? '', paymentStatus: item.paymentStatus ?? 'Pending', externalReference: item.externalReference ?? '', notes: item.notes ?? '', correctionNotes: '', refundReason: item.refundReason ?? '' };
      setForm(initial);
      guard.captureBaseline({ form: initial, proofFileUrl: item.proofFileUrl ?? '' });
      setProofFileUrl(item.proofFileUrl ?? '');
      revisionRef.current = computeRevision(item, REVISION_FIELDS.payment);
    } else {
      const initial = { job: '', paymentDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date()), amount: 0, paymentMethod: '', paymentProvider: '', paymentStatus: 'Pending', externalReference: '', notes: '', correctionNotes: '', refundReason: '' };
      setForm(initial);
      guard.captureBaseline({ form: initial, proofFileUrl: '' });
      setProofFileUrl('');
    }
    // Always reset the browse filter to "all" when the dialog (re)opens, so
    // editing a payment never starts with the Job list pre-narrowed to that
    // payment's customer — the whole point is being able to move it elsewhere.
    setCustomerFilter('');
    setCustomerFilterLabel(undefined);
    setSelectedJobLabel(undefined);
    setSelectedJobCustomerId(item?.customerId);
    setError('');
    setDuplicates([]);
    setShowDupWarning(false);
    setRefundInfo(null);
    generateToken();
    if (!item) revisionRef.current = undefined;
  }, [item, open]);

  // FIX 1: Load refund info when status is Refunded and job is selected
  useEffect(() => {
    if (form.paymentStatus === 'Refunded' && form.job) {
      setLoadingRefundInfo(true);
      getRefundInfo({ jobId: form.job, excludePaymentId: item?.id })
        .then(info => setRefundInfo(info))
        .catch((err: unknown) => {
          console.warn('[PaymentDialog] Failed to load refund info:', errMsg(err));
          setRefundInfo(null);
        })
        .finally(() => setLoadingRefundInfo(false));
    } else {
      setRefundInfo(null);
    }
  }, [form.paymentStatus, form.job, item?.id]);

  /**
   * §23 — previzualizarea, semnată la cerere. ⛔ Calea din bucket nu e o adresă publică: fără
   * semnătură nu se vede nimic, iar semnătura expiră. Aceeași formă ca la chitanțele de cheltuieli.
   */
  useEffect(() => {
    if (!proofFileUrl) return;
    let alive = true;
    getReceiptUrl(proofFileUrl)
      .then(url => { if (alive) setProofPreview({ path: proofFileUrl, url }); })
      .catch((err: unknown) => {
        console.warn('[PaymentDialog] Failed to sign payment proof URL:', errMsg(err));
      });
    return () => { alive = false; };
  }, [proofFileUrl]);

  const proofDisplayUrl = proofPreview?.path === proofFileUrl ? proofPreview.url : '';

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > MAX_PDF_BYTES) { setError(`File exceeds ${Math.floor(MAX_PDF_BYTES / 1024 / 1024)} MB limit`); return; }
    setUploading(true); setError('');
    try {
      const { path } = await uploadFile({ data: file, filename: file.name });
      setProofFileUrl(path);
      toast.success('Proof attached');
    } catch (err) { setError(errMsg(err) || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const proofIsImage = /\.(jpg|jpeg|png|webp|gif)/i.test(proofFileUrl);
  const isRefund = form.paymentStatus === 'Refunded';
  const refundExceedsMax = isRefund && refundInfo && form.amount > refundInfo.maxRefundable;
  const saveDisabled = saving || uploading || (isRefund && (refundExceedsMax === true || loadingRefundInfo));

  const handleSave = async (overrideConfirmed = false) => {
    if (!form.job || !form.paymentDate) { setError('Job and date are required'); return; }
    if (form.amount <= 0) { setError('Amount must be greater than zero'); return; }
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await savePayment({
        ...form,
        /**
         * §23 — motivul pleacă **doar pe o restituire**. ⛔ Ruta refuză oricum un motiv pe o plată
         * care nu e `Refunded` (`refundReasonPlacementCheck`), iar un câmp rămas completat după ce
         * cineva a schimbat statusul înapoi ar produce un refuz pe care ecranul nu-l explică.
         */
        refundReason: isRefund ? form.refundReason || undefined : undefined,
        proofFileUrl: proofFileUrl || null,
        id: item?.id,
        voidStatus: item?.voidStatus || 'Active',
        correctionNotes: form.correctionNotes || undefined,
        idempotencyToken: item?.id ? undefined : idempotencyTokenRef.current,
        duplicateOverrideConfirmed: overrideConfirmed,
        _revision: revisionRef.current,
      });

      // ACHU-401 (felia 22): verificat pe `success`. Ruta răspunde ori cu id, ori cu duplicate.
      if (!res.success) {
        setDuplicates(res.duplicates);
        setShowDupWarning(true);
        setSaving(false);
        return;
      }

      /**
       * 🔴 ACHU-751 — AICI ERA UN MESAJ IMPOSIBIL, al doilea din aceeași familie ca ACHU-742.
       *
       * Ecranul putea spune „Record saved, but audit history could not be updated". ⛔ Ruta de
       * plăți **nu poate** întoarce acel câmp: la Plăți auditul e CRITIC (ACHU-AUD-007, decizie
       * de owner) — o scriere eșuată în istoric **rostogolește înapoi plata însăși**. Deci
       * mesajul ar fi spus că banii s-au înregistrat fără urmă în istoric, când adevărul e că
       * fără urmă nu se înregistrează deloc. ⚠️ Ramura s-a născut inaccesibilă, iar un test o
       * ținea în viață cu un răspuns fabricat.
       */
      toast.success(item ? 'Payment updated' : 'Payment recorded');
      setAuditRefreshKey(k => k + 1);
      guard.markSaved();
      onSaved();
    } catch (e) {
      setError(errMsg(e) || 'Failed to save payment');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAnyway = () => {
    generateToken();
    handleSave(true);
  };

  // Duplicate warning view
  if (showDupWarning) {
    return (
      <Dialog open={open} onOpenChange={v => !v && guard.requestClose()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Possible Duplicate Detected</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">This payment may already exist</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    An active payment was found with the same date, amount, job and status. Please review before saving.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Existing payment(s)</p>
              {duplicates.map((d, i) => (
                <Card key={i} className="bg-muted/30">
                  <CardContent className="p-3 text-sm space-y-1">
                    <p className="font-medium">Payment #{d.paymentId}</p>
                    <p>{fmtDate(d.paymentDate)} • {fmt(d.amount)}</p>
                    {d.paymentStatus && <p className="text-muted-foreground">Status: {d.paymentStatus}</p>}
                    {d.externalReference && <p className="text-muted-foreground">Ref: {d.externalReference}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">You are saving</p>
              <Card>
                <CardContent className="p-3 text-sm space-y-1">
                  <p className="font-medium">{fmtDate(form.paymentDate)} • {fmt(form.amount)}</p>
                  <p className="text-muted-foreground">Status: {form.paymentStatus}</p>
                  {form.externalReference && <p className="text-muted-foreground">Ref: {form.externalReference}</p>}
                </CardContent>
              </Card>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowDupWarning(false); setDuplicates([]); }}>
                Cancel / Review
              </Button>
              <Button className="flex-1" onClick={handleSaveAnyway} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving...</> : 'Save Anyway'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && guard.requestClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? 'Edit Payment' : 'Record Payment'}</DialogTitle></DialogHeader>
        {item?.voidStatus === 'Voided' && (
          <Badge variant="destructive" className="w-fit">Voided</Badge>
        )}
        <p className="text-xs text-muted-foreground">The customer is automatically set from the selected job.</p>
        <div className="space-y-3">
          <div><Label id="paydlg-customer-filter-label">Narrow by Customer (optional)</Label>
            {/* Sesiunea 28: searchable, and it now narrows the Job search
                server-side (/jobs/for-select?customerId=…) instead of filtering
                a fully-loaded job list in the browser. */}
            <SearchablePicker
              labelId="paydlg-customer-filter-label"
              value={customerFilter}
              selectedLabel={customerFilterLabel}
              onSelect={(id, option) => {
                setCustomerFilter(id);
                setCustomerFilterLabel(option?.label);
                // ACHU-200: only drop the chosen Job if the new filter would hide
                // it — clearing the filter must never clear a valid choice.
                if (id && selectedJobCustomerId && selectedJobCustomerId !== id) {
                  setForm(f => ({ ...f, job: '' }));
                  setSelectedJobLabel(undefined);
                  setSelectedJobCustomerId(undefined);
                }
              }}
              fetchOptions={searchCustomers}
              triggerLabel="All customers"
              placeholder="Search customers by name, email, phone…"
              emptyLabel="No customers found"
            />
          </div>
          <div><Label id="paydlg-job-label">Job *</Label>
            <SearchablePicker
              labelId="paydlg-job-label"
              value={form.job}
              selectedLabel={selectedJobLabel ?? (item ? item.jobLabel : undefined)}
              onSelect={(id, option) => {
                // ACHU-200: only the `job` field is written here. The payment's
                // real customer is derived server-side from the chosen Job
                // (payments.ts: `const customerId = job.customerId`), and the
                // browse filter above is deliberately left untouched.
                setForm(f => ({ ...f, job: id }));
                setSelectedJobLabel(option?.label);
                setSelectedJobCustomerId(option?.data?.customerId as string | undefined);
              }}
              fetchOptions={searchJobs}
              triggerLabel="Select job"
              placeholder="Search jobs by number, service, customer…"
              emptyLabel="No jobs found"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="paymentdia-date">Date *</Label><DateField id="paymentdia-date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} /></div>
            <div><Label htmlFor="paymentdia-amount">Amount (£) *</Label><Input id="paymentdia-amount" type="number" step="0.01" min="0" value={form.amount !== 0 ? form.amount : ''} onFocus={e => e.target.select()} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="paymentdia-method">Method</Label>
              <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                <SelectTrigger id="paymentdia-method"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{methods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="paymentdia-provider">Provider</Label>
              <Select value={form.paymentProvider} onValueChange={v => setForm(f => ({ ...f, paymentProvider: v }))}>
                <SelectTrigger id="paymentdia-provider"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{providers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label htmlFor="paymentdia-status">Status</Label>
            <Select value={form.paymentStatus} onValueChange={v => setForm(f => ({ ...f, paymentStatus: v }))}>
              <SelectTrigger id="paymentdia-status"><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* FIX 1: Refund info panel */}
          {isRefund && form.job && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Info className="h-3.5 w-3.5" /> Refund Summary
              </div>
              {loadingRefundInfo ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading…</div>
              ) : refundInfo ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Total Active Received</span>
                  <span className="font-medium text-right">{fmt(refundInfo.totalActiveReceived)}</span>
                  <span className="text-muted-foreground">Already Refunded</span>
                  <span className="font-medium text-right">{fmt(refundInfo.totalActiveRefunded)}</span>
                  <span className="text-muted-foreground">Max Refundable</span>
                  <span className="font-medium text-right text-green-700">{fmt(refundInfo.maxRefundable)}</span>
                  <span className="text-muted-foreground">Proposed Refund</span>
                  <span className={`font-medium text-right ${refundExceedsMax ? 'text-destructive' : ''}`}>{fmt(form.amount)}</span>
                </div>
              ) : null}
              {refundExceedsMax && (
                <p className="text-xs text-destructive font-medium mt-1">
                  Refund exceeds the maximum refundable amount ({fmt(refundInfo!.maxRefundable)}).
                </p>
              )}
            </div>
          )}

          {/*
            🔴 §23 „Refund reason" (Sesiunea 153) — **de ce se întorc banii.**
            ⚠️ Apare **doar pe o restituire**: pe o încasare n-are ce căuta, iar ruta o refuză
            acolo tocmai ca să nu devină a doua căsuță de note.
            ⛔ Obligatoriu doar la TRECEREA în „Refunded" — o plată rambursată de dinainte de
            câmpul acesta se poate încă edita fără el (`paymentEvidencePolicy.ts`).
          */}
          {isRefund && (
            <div>
              <Label htmlFor="paymentdia-refund-reason">Refund reason *</Label>
              <Textarea
                id="paymentdia-refund-reason"
                value={form.refundReason}
                onChange={e => setForm(f => ({ ...f, refundReason: e.target.value }))}
                rows={2}
                placeholder="Why is this money going back to the customer?"
              />
              <p className="text-xs text-muted-foreground mt-1">
                A refund without a reason cannot be explained to the customer, to an accountant, or to
                whoever reads the account a year from now.
              </p>
            </div>
          )}

          {/*
            🔴 §23 „Payment proof" (Sesiunea 153) — **dovada că banii au intrat.**
            ⚠️ **Opțională, deliberat.** Biroul înregistrează plăți dintr-un extras pe care îl are în
            față; a refuza salvarea fără fișier ar opri munca de zi cu zi pentru o regulă pe care
            nimeni n-a cerut-o.
            ⛔ A o **scoate** cere însă note de corecție: fișierul de dinainte dispare.
          */}
          <div>
            <Label>Proof of payment (optional)</Label>
            <input
              ref={proofInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={handleProofUpload}
            />
            {proofFileUrl ? (
              <Card className="mt-1">
                <CardContent className="p-2 space-y-2">
                  {proofIsImage && proofDisplayUrl
                    ? <img src={proofDisplayUrl} alt="Proof of payment" className="w-full max-h-40 object-contain bg-muted/20" />
                    : (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {proofDisplayUrl
                          ? <a href={proofDisplayUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View file</a>
                          : <span className="text-muted-foreground">Attached</span>}
                      </div>
                    )}
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => proofInputRef.current?.click()} disabled={uploading}>
                      <Upload className="h-3.5 w-3.5 mr-1" />Replace
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setProofFileUrl('')} disabled={uploading}>
                      <X className="h-3.5 w-3.5 mr-1" />Remove
                    </Button>
                  </div>
                  {item?.proofUploadedBy && item.proofFileUrl === proofFileUrl && (
                    <p className="text-xs text-muted-foreground">
                      Attached by {item.proofUploadedBy}{item.proofUploadedAt ? ` on ${fmtDate(item.proofUploadedAt)}` : ''}
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => proofInputRef.current?.click()} disabled={uploading}>
                {uploading
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Uploading…</>
                  : <><Upload className="h-4 w-4 mr-1" />Attach bank statement or receipt</>}
              </Button>
            )}
            {item?.proofFileUrl && !proofFileUrl && (
              <p className="text-xs text-destructive mt-1">
                Removing the proof destroys the evidence that this money arrived — write why in the
                correction notes below.
              </p>
            )}
          </div>

          <div><Label htmlFor="paymentdia-external-reference">External Reference</Label><Input id="paymentdia-external-reference" value={form.externalReference} onChange={e => setForm(f => ({ ...f, externalReference: e.target.value }))} /></div>
          <div><Label htmlFor="paymentdia-notes">Notes</Label><Textarea id="paymentdia-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          {item && (
            <div>
              <Label htmlFor="paymentdia-correction-notes">Correction Notes {item ? '(required for material changes)' : ''}</Label>
              <Textarea id="paymentdia-correction-notes" value={form.correctionNotes} onChange={e => setForm(f => ({ ...f, correctionNotes: e.target.value }))} rows={2} placeholder="Reason for changes..." />
            </div>
          )}
          {item?.createdBy && (
            <p className="text-xs text-muted-foreground">Created by: {item.createdBy} • Last updated by: {item.updatedBy || '—'}</p>
          )}
          {/*
            🔴 §43 „Related payment" (Sesiunea 150) — **munca de urmărit un ban se notează de pe
            plată.** ⛔ „Sună banca pentru plata #212", „urmărește refundul" se scriau până azi pe
            lista de sarcini fără să spună despre CE plată — iar peste o săptămână nimeni nu mai știa,
            deci sarcina rămânea nefăcută.
            ⚠️ **Doar pe o plată care EXISTĂ** (`item`): pe formularul de creare nu e încă nimic de
            legat, iar o sarcină legată de un rând nescris ar fi o legătură către nimic.
          */}
          {item?.id && (
            <TaskComposer
              about={{ kind: 'payment', id: item.id, label: `payment #${item.paymentId}` }}
              onCreated={() => toast.success('Task noted.')}
            />
          )}
          {item?.id && <AuditHistory entityType="Payment" entityId={item.id} refreshKey={auditRefreshKey} />}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={() => handleSave(false)} disabled={saveDisabled}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
      <DiscardChangesDialog open={guard.confirmOpen} onDiscard={guard.discard} onKeepEditing={guard.keepEditing} />
    </Dialog>
  );
}

