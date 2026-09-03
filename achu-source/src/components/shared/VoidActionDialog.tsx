import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { errMsg } from '@/lib/errorMessage';

export default function VoidActionDialog({ open, onClose, action, label, onConfirm }: {
  open: boolean; onClose: () => void; action: 'void' | 'restore'; label: string;
  onConfirm: (correctionNotes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!notes.trim()) { setError('Correction notes are required'); return; }
    setSaving(true);
    setError('');
    try {
      await onConfirm(notes.trim());
      setNotes('');
      onClose();
    } catch (e) {
      setError(errMsg(e) || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setNotes(''); setError(''); onClose(); } }}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{action === 'void' ? 'Void' : 'Restore'} {label}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {action === 'void'
            ? 'This record will be excluded from all financial calculations but remain visible for audit purposes.'
            : 'This will restore the record to active status and include it in financial calculations.'}
        </p>
        <div>
          <Label htmlFor="voidaction-correction-notes">Correction Notes *</Label>
          <Textarea id="voidaction-correction-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for this action..." rows={3} />
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => { setNotes(''); setError(''); onClose(); }}>Cancel</Button>
          <Button variant={action === 'void' ? 'destructive' : 'default'} onClick={handleConfirm} disabled={saving}>
            {saving ? 'Processing...' : action === 'void' ? 'Void Record' : 'Restore Record'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

