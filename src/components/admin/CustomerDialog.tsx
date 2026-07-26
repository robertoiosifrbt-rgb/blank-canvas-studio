import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect, useRef } from 'react';
import { saveCustomer } from 'zite-endpoints-sdk';
import { toast } from 'sonner';
import AuditHistory from './AuditHistory';
import { computeRevision, REVISION_FIELDS } from '@/lib/concurrency';

const types = ['Domestic', 'Commercial', 'Airbnb', 'Landlord', 'Other'];
const statuses = ['Lead', 'Active', 'Inactive', 'Blocked'];

export default function CustomerDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: any; onSaved: () => void }) {
  const [form, setForm] = useState({ customerName: '', phone: '', email: '', address: '', postcode: '', customerType: '', status: 'Lead', notes: '' });
  const [saving, setSaving] = useState(false);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const revisionRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (item) {
      setForm({ customerName: item.customerName ?? '', phone: item.phone ?? '', email: item.email ?? '', address: item.address ?? '', postcode: item.postcode ?? '', customerType: item.customerType ?? '', status: item.status ?? 'Lead', notes: item.notes ?? '' });
      revisionRef.current = computeRevision(item, REVISION_FIELDS.customer);
    } else {
      setForm({ customerName: '', phone: '', email: '', address: '', postcode: '', customerType: '', status: 'Lead', notes: '' });
      revisionRef.current = undefined;
    }
  }, [item, open]);

  const handleSave = async () => {
    if (!form.customerName.trim()) { toast.error('Name is required'); return; }
    if (saving) return;
    setSaving(true);
    try {
      const result = await saveCustomer({ ...form, id: item?.id, _revision: revisionRef.current });
      // ACHU-047: Show audit warning if present
      if (result.auditWarning) {
        console.warn('[CustomerDialog] Audit warning:', result.auditWarning);
        toast.warning('Record saved, but audit history could not be updated. The change was applied.', { duration: 6000 });
      } else {
        toast.success(item ? 'Customer updated' : 'Customer created');
      }
      setAuditRefreshKey(k => k + 1);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? 'Edit Customer' : 'New Customer'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Customer Name *</Label><Input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          </div>
          <div><Label>Address</Label><Textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} /></div>
          <div><Label>Postcode</Label><Input value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} placeholder="e.g. SW1A 1AA" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Type</Label>
              <Select value={form.customerType} onValueChange={v => setForm(f => ({ ...f, customerType: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          {item?.id && <AuditHistory entityType="Customer" entityId={item.id} refreshKey={auditRefreshKey} />}
          <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
