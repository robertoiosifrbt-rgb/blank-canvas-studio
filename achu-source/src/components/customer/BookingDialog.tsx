import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import DateField from '@/components/shared/DateField';
import TimeField from '@/components/shared/TimeField';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { requestBooking, getCustomerPortal } from '@/lib/endpoints';
import { withTimeout } from '@/lib/useTrackedRequest';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';
import type { PortalJob } from './portalTypes';

const SUBMIT_TIMEOUT_MS = 30000;

const services = [
  'Regular Clean', 'Deep Clean', 'End of Tenancy', 'Carpet Clean',
  'Oven Clean', 'Window Clean', 'Airbnb Turnaround', 'Commercial Clean', 'Other',
];

export default function BookingDialog({ open, onClose, address, onSaved }: {
  open: boolean; onClose: () => void; address?: string; onSaved: () => void;
}) {
  const [form, setForm] = useState({ jobDate: '', service: '', startTime: '', address: '', notes: '', additionalDetails: '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<{ jobId: number } | null>(null);
  const [needsReconcile, setNeedsReconcile] = useState(false);
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const seqRef = useRef(0);
  const mountedRef = useRef(true);

  // Idempotency token — one per form session, reused on retry
  const idempotencyTokenRef = useRef('');
  function generateToken() {
    idempotencyTokenRef.current = crypto.randomUUID();
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (open) {
      setForm({ jobDate: '', service: '', startTime: '', address: address ?? '', notes: '', additionalDetails: '' });
      setErrors([]);
      setSuccess(null);
      setNeedsReconcile(false);
      generateToken();
    }
  }, [open, address]);

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!form.service) errs.push('Service is required.');
    if (!form.jobDate) errs.push('Preferred date is required.');
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.jobDate)) errs.push('Invalid date format.');
    else {
      const [y, m, d] = form.jobDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) errs.push('Invalid date.');
      else if (form.jobDate < todayStr) errs.push('Booking date cannot be in the past.');
    }
    if (!form.address.trim()) errs.push('Address is required.');
    return errs;
  };

  const reconcileBeforeRetry = async () => {
    // Reload server state to check if the timed-out booking was actually created
    const mySeq = ++seqRef.current;
    setSaving(true);
    setErrors([]);
    try {
      const fresh = await withTimeout(getCustomerPortal({}), 30000);
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      // Check if a job matching our idempotency token's booking already exists
      // by looking for a recently created enquiry with matching details
      const recentEnquiry = fresh.upcomingJobs?.find((j: PortalJob) =>
        j.service === form.service && j.jobDate === form.jobDate && j.status === 'Enquiry'
      );
      if (recentEnquiry) {
        // Booking was actually created — show success
        setSuccess({ jobId: recentEnquiry.jobId });
        toast.success('Booking was already submitted successfully.');
        generateToken();
      } else {
        // Booking was NOT created — safe to retry with same idempotency token
        setNeedsReconcile(false);
        toast('Server state verified — you can resubmit.');
      }
    } catch {
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      setErrors(['Could not verify server state. Please try again.']);
    } finally {
      if (mountedRef.current && mySeq === seqRef.current) setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (saving) return;

    if (needsReconcile) {
      await reconcileBeforeRetry();
      return;
    }

    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;

    const mySeq = ++seqRef.current;
    setSaving(true);
    try {
      const res = await withTimeout(
        requestBooking({
          jobDate: form.jobDate,
          service: form.service,
          address: form.address.trim(),
          startTime: form.startTime || undefined,
          notes: form.notes.trim() || undefined,
          additionalDetails: form.additionalDetails.trim() || undefined,
          idempotencyToken: idempotencyTokenRef.current,
        }),
        SUBMIT_TIMEOUT_MS,
      );
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      setSuccess({ jobId: res.jobId });
      toast.success('Booking request submitted!');
      // Generate new token for next booking
      generateToken();
    } catch (e) {
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      const isTimeout = errMsg(e) === 'Request timed out';
      setErrors([errMsg(e) || 'Failed to submit booking request. Please try again.']);
      if (isTimeout) setNeedsReconcile(true);
      // Keep the same idempotency token so retry won't duplicate
    } finally {
      if (mountedRef.current && mySeq === seqRef.current) setSaving(false);
    }
  };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={v => { if (!v) { onSaved(); } }}>
        <DialogContent className="max-w-md">
          <div className="text-center py-6 space-y-3">
            <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
            <h3 className="text-lg font-semibold">Booking Request Submitted</h3>
            <p className="text-sm text-muted-foreground">
              Your request {success.jobId && <>(ref <span className="font-mono font-medium">#{success.jobId}</span>)</>} has been received.
              It will appear in your Upcoming Jobs as an <span className="font-medium">Enquiry</span>.
            </p>
            <p className="text-xs text-muted-foreground">ACHU will review and confirm your booking shortly.</p>
            <Button onClick={onSaved} className="w-full">Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Request a Booking</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="bookingdia-service-required">Service Required *</Label>
            <Select value={form.service} onValueChange={v => setForm(f => ({ ...f, service: v }))} disabled={saving}>
              <SelectTrigger id="bookingdia-service-required"><SelectValue placeholder="Select a service" /></SelectTrigger>
              <SelectContent>{services.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="bookingdia-preferred-date">Preferred Date *</Label>
            <DateField id="bookingdia-preferred-date" min={todayStr} value={form.jobDate} onChange={e => setForm(f => ({ ...f, jobDate: e.target.value }))} disabled={saving} />
          </div>
          <div>
            <Label htmlFor="bookingdia-preferred-start-time-optional">Preferred Start Time (optional)</Label>
            <TimeField id="bookingdia-preferred-start-time-optional" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} disabled={saving} />
          </div>
          <div>
            <Label htmlFor="bookingdia-address">Address *</Label>
            <Textarea id="bookingdia-address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} disabled={saving} />
          </div>
          <div>
            <Label htmlFor="bookingdia-customer-instructions">Customer Instructions</Label>
            <Textarea id="bookingdia-customer-instructions" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Access codes, parking, special requests..." disabled={saving} />
          </div>
          <div>
            <Label htmlFor="bookingdia-additional-details">Additional Details</Label>
            <Textarea id="bookingdia-additional-details" value={form.additionalDetails} onChange={e => setForm(f => ({ ...f, additionalDetails: e.target.value }))} rows={2} placeholder="Anything else we should know..." disabled={saving} />
          </div>

          {errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-1">
              {errors.map((e, i) => <p key={i} className="text-sm text-destructive">{e}</p>)}
            </div>
          )}

          <Button className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving
              ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Submitting...</>
              : needsReconcile
                ? <><RefreshCw className="h-4 w-4 mr-1" />Check &amp; Retry</>
                : 'Submit Request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

