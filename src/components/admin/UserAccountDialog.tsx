import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect, useRef } from 'react';
import { saveUserAccount } from 'zite-endpoints-sdk';
import { toast } from 'sonner';
import AuditHistory from './AuditHistory';
import { computeRevision, REVISION_FIELDS } from '@/lib/concurrency';

const roles = ['Admin', 'Cleaner', 'Customer'] as const;

export default function UserAccountDialog({ open, onClose, item, customers, cleaners, onSaved }: {
  open: boolean; onClose: () => void; item: any; customers: any[]; cleaners: any[]; onSaved: () => void;
}) {
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'Customer' as 'Admin' | 'Cleaner' | 'Customer', customer: '', cleaner: '', active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const revisionRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (item) {
      const custId = Array.isArray(item.customer) ? item.customer[0] : item.customer;
      const clId = Array.isArray(item.cleaner) ? item.cleaner[0] : item.cleaner;
      setForm({ email: item.email ?? '', firstName: item.firstName ?? '', lastName: item.lastName ?? '', role: item.role ?? 'Customer', customer: custId ?? '', cleaner: clId ?? '', active: item.active ?? true });
      revisionRef.current = computeRevision(item, REVISION_FIELDS.userAccount);
    } else {
      setForm({ email: '', firstName: '', lastName: '', role: 'Customer', customer: '', cleaner: '', active: true });
      revisionRef.current = undefined;
    }
    setError('');
  }, [item, open]);

  // FIX 4: When role changes, clear incompatible links
  const handleRoleChange = (newRole: 'Admin' | 'Cleaner' | 'Customer') => {
    setForm(f => {
      const updated = { ...f, role: newRole };
      if (newRole === 'Admin') {
        updated.customer = '';
        updated.cleaner = '';
      } else if (newRole === 'Customer') {
        updated.cleaner = '';
      } else if (newRole === 'Cleaner') {
        updated.customer = '';
      }
      return updated;
    });
  };

  // FIX 4: Frontend validation — check required links
  const isMissingRequiredLink =
    form.active &&
    ((form.role === 'Customer' && !form.customer) ||
     (form.role === 'Cleaner' && !form.cleaner));

  const handleSave = async () => {
    if (!form.email.trim()) { toast.error('Email is required'); return; }
    if (isMissingRequiredLink) {
      setError(form.role === 'Customer'
        ? 'An active Customer account must be linked to a Customer record.'
        : 'An active Cleaner account must be linked to a Cleaner record.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await saveUserAccount({ ...form, customer: form.customer || undefined, cleaner: form.cleaner || undefined, id: item?.id, _revision: revisionRef.current });
      // ACHU-047: Show audit warning if present
      if (result.auditWarning) {
        console.warn('[UserAccountDialog] Audit warning:', result.auditWarning);
        toast.warning('Record saved, but audit history could not be updated. The change was applied.', { duration: 6000 });
      } else if (result.message) {
        toast.success(result.message, { duration: 6000 });
      } else {
        toast.success(item ? 'Account updated' : 'User record created');
      }
      setAuditRefreshKey(k => k + 1);
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Failed to save user account');
    } finally {
      setSaving(false);
    }
  };

  const showCustomerLink = form.role === 'Customer';
  const showCleanerLink = form.role === 'Cleaner';

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit User Account' : 'Create User Record'}</DialogTitle>
          {!item && (
            <DialogDescription>
              Creates a prepared user record. The person must sign up with the same email address to access the app.
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Email *</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First Name</Label><Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} /></div>
            <div><Label>Last Name</Label><Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} /></div>
          </div>
          <div><Label>Role *</Label>
            <Select value={form.role} onValueChange={v => handleRoleChange(v as 'Admin' | 'Cleaner' | 'Customer')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {showCustomerLink && (
            <div>
              <Label>Link to Customer {form.active && <span className="text-destructive">*</span>}</Label>
              <Select value={form.customer} onValueChange={v => setForm(f => ({ ...f, customer: v }))}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.customerName}</SelectItem>)}</SelectContent>
              </Select>
              {form.active && !form.customer && <p className="text-xs text-destructive mt-1">Required for active Customer accounts</p>}
            </div>
          )}
          {showCleanerLink && (
            <div>
              <Label>Link to Cleaner {form.active && <span className="text-destructive">*</span>}</Label>
              <Select value={form.cleaner} onValueChange={v => setForm(f => ({ ...f, cleaner: v }))}>
                <SelectTrigger><SelectValue placeholder="Select cleaner" /></SelectTrigger>
                <SelectContent>{cleaners.map(c => <SelectItem key={c.id} value={c.id}>{c.cleanerName}</SelectItem>)}</SelectContent>
              </Select>
              {form.active && !form.cleaner && <p className="text-xs text-destructive mt-1">Required for active Cleaner accounts</p>}
            </div>
          )}
          <div className="flex items-center gap-2"><Checkbox checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: !!v }))} /><Label>Active</Label></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {item?.id && <AuditHistory entityType="UserAccount" entityId={item.id} refreshKey={auditRefreshKey} />}
          <Button className="w-full" onClick={handleSave} disabled={saving || isMissingRequiredLink}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
