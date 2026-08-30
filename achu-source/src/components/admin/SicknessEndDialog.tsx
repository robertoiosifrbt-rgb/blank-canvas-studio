import { Button } from '@/components/ui/button';
import DateField from '@/components/shared/DateField';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

export default function SicknessEndDialog({
  ending, onClose, endDate, onEndDateChange, busy, onConfirm,
}) {
  return (
    <Dialog open={ending != null} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>When was their last day off?</DialogTitle>
          <DialogDescription>
            The sick pay is worked out again on this date, so the figure may change.
          </DialogDescription>
        </DialogHeader>
        <DateField value={endDate} onChange={e => onEndDateChange(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy} onClick={onConfirm}>End the spell</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

