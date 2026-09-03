import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import type { Entry } from '@/lib/timesheetsFormat';

export default function TimesheetsDisputeDialog({
  disputing, onClose, reason, onReasonChange, busy, onConfirm,
}: {
  disputing: Entry | null;
  onClose: () => void;
  reason: string;
  onReasonChange: (value: string) => void;
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={disputing != null} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What is being questioned?</DialogTitle>
          <DialogDescription>
            A reason is required. „Disputed" with no explanation is a dead end for whoever picks it up next,
            and the person whose hours these are has a right to know what is in question.
          </DialogDescription>
        </DialogHeader>
        <Textarea aria-label="What is being questioned?" value={reason} rows={3} onChange={e => onReasonChange(e.target.value)}
          placeholder="e.g. Maria says she left at 15:00, not 17:00" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy || reason.trim().length < 3} onClick={onConfirm}>
            Mark as disputed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

