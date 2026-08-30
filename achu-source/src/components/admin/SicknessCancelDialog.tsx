import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

export default function SicknessCancelDialog({
  cancelling, onClose, reason, onReasonChange, busy, onConfirm,
}) {
  return (
    <Dialog open={cancelling != null} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Why is this record being cancelled?</DialogTitle>
          <DialogDescription>
            The record stays and the sick pay goes to zero. There is no delete on purpose: an absence is
            something somebody acted on, and deleting it hides that it ever happened.
          </DialogDescription>
        </DialogHeader>
        <Textarea aria-label="Why is this record being cancelled?" rows={3} value={reason} onChange={e => onReasonChange(e.target.value)}
          placeholder="e.g. Recorded on the wrong person" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Keep it</Button>
          <Button disabled={busy || reason.trim().length < 3} onClick={onConfirm}>
            Cancel the record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

