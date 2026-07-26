import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect, useRef } from 'react';
import { saveJob, getCustomers } from 'zite-endpoints-sdk';
import { toast } from 'sonner';
import { computeRevision, REVISION_FIELDS } from '@/lib/concurrency';
import JobAssignmentsPanel from './JobAssignmentsPanel';
import AuditHistory from './AuditHistory';
import QuoteRequestSection from './QuoteRequestSection';
import AdminChecklistSection from './AdminChecklistSection';
import { AlertTriangle, Clock } from 'lucide-react';
import { StatusBadge, fmt } from '@/lib/format';

const statuses = ['Enquiry', 'Booked', 'Confirmed', 'In Progress', 'Completed', 'Cancelled', 'No Access'];

export default function JobDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: any; onSaved: () => void }) {
  const [form, setForm] = useState({ customer: '', jobDate: '', service: '', address: '', startTime: '', finishTime: '', status: 'Enquiry', amountCharged: 0, customerInstructions: '', adminNotes: '', cleanerCompletionNotes: '', quoteNumber: '' });
  const [customers, setCustomers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const revisionRef = useRef<string | undefined>(undefined);

  useEffect(() => { if (open) getCustomers({}).then(d => setCustomers(d.records)); }, [open]);

  useEffect(() => {
    if (item) {
      const custId = Array.isArray(item.customer) ? item.customer[0] : item.customer;
      setForm({
        customer: custId ?? '', jobDate: item.jobDate ?? '', service: item.service ?? '',
        address: item.address ?? '', startTime: item.startTime ?? '', finishTime: item.finishTime ?? '',
        status: item.status ?? 'Enquiry', amountCharged: item.amountCharged ?? 0,
        customerInstructions: item.customerInstructions ?? '',
        adminNotes: item.adminNotes ?? (item.notes ?? ''),
        cleanerCompletionNotes: item.cleanerCompletionNotes ?? '',
        quoteNumber: item.quoteNumber ?? '',
      });
      revisionRef.current = computeRevision(item, REVISION_FIELDS.job);
    } else {
      // ACHU-057: Default Job Date to today in Europe/London timezone for new jobs
      const todayLondon = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
      setForm({ customer: '', jobDate: todayLondon, service: '', address: '', startTime: '', finishTime: '', status: 'Enquiry', amountCharged: 0, customerInstructions: '', adminNotes: '', cleanerCompletionNotes: '', quoteNumber: '' });
      revisionRef.current = undefined;
    }
  }, [item, open]);

  const quoteNumberTrimmed = form.quoteNumber.trim();
  const quoteNumberError = quoteNumberTrimmed.length > 100 ? 'Quote Number cannot exceed 100 characters.' : '';

  const handleSave = async () => {
    if (!form.customer || !form.jobDate || !form.service.trim()) { toast.error('Customer, date and service are required'); return; }
    if (quoteNumberError) { toast.error(quoteNumberError); return; }
    setSaving(true);
    try {
      const result = await saveJob({ ...form, quoteNumber: quoteNumberTrimmed || null, id: item?.id, _revision: revisionRef.current });
      // ACHU-047: Show audit warning if present
      if (result.auditWarning) {
        console.warn('[JobDialog] Audit warning:', result.auditWarning);
        toast.warning('Record saved, but audit history could not be updated. The change was applied.', { duration: 6000 });
      } else if (result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success(item ? 'Job updated' : 'Job created');
      }
      setAuditRefreshKey(k => k + 1);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save job');
    } finally {
      setSaving(false);
    }
  };

  const isPast = form.jobDate && form.jobDate < new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date()) && !item;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? 'Edit Job' : 'New Job'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Customer *</Label>
            <Select value={form.customer} onValueChange={v => setForm(f => ({ ...f, customer: v }))}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.customerName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Job Date *</Label>
              <Input type="date" value={form.jobDate} onChange={e => setForm(f => ({ ...f, jobDate: e.target.value }))} />
              {isPast && <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Past date — historical record</p>}
            </div>
            <div><Label>Service *</Label><Input value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} /></div>
          </div>
          <div><Label>Address</Label><Textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Scheduled Start</Label><Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} /></div>
            <div><Label>Scheduled Finish</Label><Input type="time" value={form.finishTime} onChange={e => setForm(f => ({ ...f, finishTime: e.target.value }))} /></div>
          </div>
          {item && (item.actualStartTime || item.actualFinishTime) && (
            <div className="bg-muted/40 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Actual Times</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground text-xs">Actual Start</span><p className="font-medium">{item.actualStartTime || '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">Actual Finish</span><p className="font-medium">{item.actualFinishTime || '—'}</p></div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Amount Charged (£)</Label><Input type="number" step="0.01" min="0" value={form.amountCharged} onChange={e => setForm(f => ({ ...f, amountCharged: parseFloat(e.target.value) || 0 }))} /></div>
          </div>
          {item && (item.amountReceived !== undefined || item.outstandingBalance !== undefined) && (
            <div className="bg-muted/40 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Financial Summary</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><span className="text-muted-foreground text-xs">Received</span><p className="font-medium">{fmt(item.amountReceived)}</p></div>
                <div><span className="text-muted-foreground text-xs">Outstanding</span><p className={`font-medium ${(item.outstandingBalance ?? 0) > 0 ? 'text-orange-600' : ''}`}>{fmt(item.outstandingBalance)}</p></div>
                <div><span className="text-muted-foreground text-xs">Payment</span><StatusBadge status={item.paymentStatus} /></div>
              </div>
            </div>
          )}
          <div>
            <Label>Quote Number</Label>
            <Input value={form.quoteNumber} onChange={e => setForm(f => ({ ...f, quoteNumber: e.target.value }))} placeholder="QT-1784598709482-9190" />
            {quoteNumberError && <p className="text-xs text-destructive mt-1">{quoteNumberError}</p>}
          </div>
          <div><Label>Customer Instructions</Label><Textarea value={form.customerInstructions} onChange={e => setForm(f => ({ ...f, customerInstructions: e.target.value }))} rows={2} placeholder="Visible to customer" /></div>
          <div><Label>Admin Notes</Label><Textarea value={form.adminNotes} onChange={e => setForm(f => ({ ...f, adminNotes: e.target.value }))} rows={2} placeholder="Internal only — not visible to cleaners or customers" /></div>
          {item?.cleanerCompletionNotes && (
            <div><Label>Cleaner Completion Notes</Label><Textarea value={form.cleanerCompletionNotes} onChange={e => setForm(f => ({ ...f, cleanerCompletionNotes: e.target.value }))} rows={2} className="bg-muted/50" /></div>
          )}

          {item?.id && (
            <>
              <Separator />
              <JobAssignmentsPanel jobId={item.id} jobInfo={{ jobDate: form.jobDate, startTime: form.startTime, service: form.service, address: form.address }} />
            </>
          )}

          {item?.id && (() => {
            const qrId = Array.isArray(item.quoteRequests) ? item.quoteRequests[0] : item.quoteRequests;
            return qrId ? (
              <>
                <Separator />
                <QuoteRequestSection quoteRequestId={qrId} />
              </>
            ) : null;
          })()}

          {item?.id && (
            <>
              <Separator />
              <AdminChecklistSection jobId={item.id} />
            </>
          )}

          {item?.id && <AuditHistory entityType="Job" entityId={item.id} refreshKey={auditRefreshKey} />}
          <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
