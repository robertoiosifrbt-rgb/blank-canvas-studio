import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useState, useEffect, useRef } from 'react';
import { savePayment, getCustomers, getJobs, getRefundInfo } from 'zite-endpoints-sdk';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Info } from 'lucide-react';
import { fmtDate, fmt } from '@/lib/format';
import AuditHistory from './AuditHistory';
import { computeRevision, REVISION_FIELDS } from '@/lib/concurrency';

const methods = ['Card', 'Cash', 'Bank Transfer', 'Payment Link', 'Other'];
const providers = ['Square', 'Bank', 'Cash', 'Halifax', 'Other'];
const statuses = ['Pending', 'Received', 'Failed', 'Refunded', 'Cancelled'];

type DuplicateMatch = { paymentId?: any; paymentDate?: string; amount?: number; paymentStatus?: string; externalReference?: string; customerName?: string; jobLabel?: string };

type RefundInfoState = { totalActiveReceived: number; totalActiveRefunded: number; maxRefundable: number } | null;

export default function PaymentDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: any; onSaved: () => void }) {
  const [form, setForm] = useState({ job: '', customer: '', paymentDate: '', amount: 0, paymentMethod: '', paymentProvider: '', paymentStatus: 'Pending', externalReference: '', notes: '', correctionNotes: '' });
  const [customers, setCustomers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);

  // ACHU-018: Use crypto.randomUUID() for idempotency tokens
  const idempotencyTokenRef = useRef('');
  const revisionRef = useRef<string | undefined>(undefined);
  function generateToken() {
    idempotencyTokenRef.current = crypto.randomUUID();
  }

  // Duplicate warning
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [showDupWarning, setShowDupWarning] = useState(false);

  // FIX 1: Refund info
  const [refundInfo, setRefundInfo] = useState<RefundInfoState>(null);
  const [loadingRefundInfo, setLoadingRefundInfo] = useState(false);

  useEffect(() => {
    if (open) {
      getCustomers({}).then(d => setCustomers(d.records)).catch((err: any) => {
        console.warn('[PaymentDialog] Failed to load customers:', err?.message);
      });
      getJobs({}).then(d => setJobs(d.records)).catch((err: any) => {
        console.warn('[PaymentDialog] Failed to load jobs:', err?.message);
      });
    }
  }, [open]);

  useEffect(() => {
    if (item) {
      const custId = Array.isArray(item.customer) ? item.customer[0] : item.customer;
      const jobId = Array.isArray(item.job) ? item.job[0] : item.job;
      setForm({ job: jobId ?? '', customer: custId ?? '', paymentDate: item.paymentDate ?? '', amount: item.amount ?? 0, paymentMethod: item.paymentMethod ?? '', paymentProvider: item.paymentProvider ?? '', paymentStatus: item.paymentStatus ?? 'Pending', externalReference: item.externalReference ?? '', notes: item.notes ?? '', correctionNotes: '' });
      revisionRef.current = computeRevision(item, REVISION_FIELDS.payment);
    } else {
      setForm({ job: '', customer: '', paymentDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date()), amount: 0, paymentMethod: '', paymentProvider: '', paymentStatus: 'Pending', externalReference: '', notes: '', correctionNotes: '' });
    }
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
        .catch((err: any) => {
          console.warn('[PaymentDialog] Failed to load refund info:', err?.message);
          setRefundInfo(null);
        })
        .finally(() => setLoadingRefundInfo(false));
    } else {
      setRefundInfo(null);
    }
  }, [form.paymentStatus, form.job, item?.id]);

  const isRefund = form.paymentStatus === 'Refunded';
  const refundExceedsMax = isRefund && refundInfo && form.amount > refundInfo.maxRefundable;
  const saveDisabled = saving || (isRefund && (refundExceedsMax === true || loadingRefundInfo));

  const handleSave = async (overrideConfirmed = false) => {
    if (!form.job || !form.paymentDate) { setError('Job and date are required'); return; }
    if (form.amount <= 0) { setError('Amount must be greater than zero'); return; }
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await savePayment({
        ...form,
        id: item?.id,
        voidStatus: item?.voidStatus || 'Active',
        correctionNotes: form.correctionNotes || undefined,
        idempotencyToken: item?.id ? undefined : idempotencyTokenRef.current,
        duplicateOverrideConfirmed: overrideConfirmed,
        _revision: revisionRef.current,
      });

      if (res.duplicateConflict && res.duplicates && res.duplicates.length > 0) {
        setDuplicates(res.duplicates);
        setShowDupWarning(true);
        setSaving(false);
        return;
      }

      // ACHU-047: Show audit warning if present
      if (res.auditWarning) {
        console.warn('[PaymentDialog] Audit warning:', res.auditWarning);
        toast.warning('Record saved, but audit history could not be updated. The change was applied.', { duration: 6000 });
      } else {
        toast.success(item ? 'Payment updated' : 'Payment recorded');
      }
      setAuditRefreshKey(k => k + 1);
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Failed to save payment');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAnyway = () => {
    generateToken();
    handleSave(true);
  };

  // Filter jobs by selected customer
  const filteredJobs = form.customer
    ? jobs.filter(j => { const cid = Array.isArray(j.customer) ? j.customer[0] : j.customer; return cid === form.customer; })
    : jobs;

  // Duplicate warning view
  if (showDupWarning) {
    return (
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
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
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? 'Edit Payment' : 'Record Payment'}</DialogTitle></DialogHeader>
        {item?.voidStatus === 'Voided' && (
          <Badge variant="destructive" className="w-fit">Voided</Badge>
        )}
        <p className="text-xs text-muted-foreground">The customer is automatically set from the selected job.</p>
        <div className="space-y-3">
          <div><Label>Filter by Customer</Label>
            <Select value={form.customer} onValueChange={v => setForm(f => ({ ...f, customer: v, job: '' }))}>
              <SelectTrigger><SelectValue placeholder="All customers" /></SelectTrigger>
              <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.customerName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Job *</Label>
            <Select value={form.job} onValueChange={v => {
              const selectedJob = jobs.find(j => j.id === v);
              const cid = selectedJob ? (Array.isArray(selectedJob.customer) ? selectedJob.customer[0] : selectedJob.customer) : '';
              setForm(f => ({ ...f, job: v, customer: cid ?? f.customer }));
            }}>
              <SelectTrigger><SelectValue placeholder="Select job" /></SelectTrigger>
              <SelectContent>{filteredJobs.map(j => <SelectItem key={j.id} value={j.id}>#{j.jobId} — {j.service} ({j.customerName})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date *</Label><Input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} /></div>
            <div><Label>Amount (£) *</Label><Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Method</Label>
              <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{methods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Provider</Label>
              <Select value={form.paymentProvider} onValueChange={v => setForm(f => ({ ...f, paymentProvider: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{providers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Status</Label>
            <Select value={form.paymentStatus} onValueChange={v => setForm(f => ({ ...f, paymentStatus: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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

          <div><Label>External Reference</Label><Input value={form.externalReference} onChange={e => setForm(f => ({ ...f, externalReference: e.target.value }))} /></div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          {item && (
            <div>
              <Label>Correction Notes {item ? '(required for material changes)' : ''}</Label>
              <Textarea value={form.correctionNotes} onChange={e => setForm(f => ({ ...f, correctionNotes: e.target.value }))} rows={2} placeholder="Reason for changes..." />
            </div>
          )}
          {item?.createdBy && (
            <p className="text-xs text-muted-foreground">Created by: {item.createdBy} • Last updated by: {item.updatedBy || '—'}</p>
          )}
          {item?.id && <AuditHistory entityType="Payment" entityId={item.id} refreshKey={auditRefreshKey} />}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={() => handleSave(false)} disabled={saveDisabled}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
