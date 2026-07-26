import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useState, useEffect, useRef } from 'react';
import { saveCleaner } from 'zite-endpoints-sdk';
import { toast } from 'sonner';
import AuditHistory from './AuditHistory';
import { computeRevision, REVISION_FIELDS } from '@/lib/concurrency';

export default function CleanerFormDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: any; onSaved: () => void }) {
  const [form, setForm] = useState({ cleanerName: '', phone: '', email: '', active: true, notes: '' });
  const [saving, setSaving] = useState(false);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const revisionRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (item) {
      setForm({ cleanerName: item.cleanerName ?? '', phone: item.phone ?? '', email: item.email ?? '', active: item.active ?? true, notes: item.notes ?? '' });
      revisionRef.current = computeRevision(item, REVISION_FIELDS.cleaner);
    } else {
      setForm({ cleanerName: '', phone: '', email: '', active: true, notes: '' });
      revisionRef.current = undefined;
    }
  }, [item, open]);

  const handleSave = async () => {
    if (!form.cleanerName.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const result = await saveCleaner({ ...form, id: item?.id, _revision: revisionRef.current });
      // ACHU-047: Show audit warning if present
      if (result.auditWarning) {
        console.warn('[CleanerFormDialog] Audit warning:', result.auditWarning);
        toast.warning('Record saved, but audit history could not be updated. The change was applied.', { duration: 6000 });
      } else {
        toast.success(item ? 'Cleaner updated' : 'Cleaner created');
      }
      setAuditRefreshKey(k => k + 1);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save cleaner');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? 'Edit Cleaner' : 'New Cleaner'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Cleaner Name *</Label><Input value={form.cleanerName} onChange={e => setForm(f => ({ ...f, cleanerName: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          </div>
          <div className="flex items-center gap-2"><Checkbox checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: !!v }))} /><Label>Active</Label></div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          {item?.id && <AuditHistory entityType="Cleaner" entityId={item.id} refreshKey={auditRefreshKey} />}
          <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
