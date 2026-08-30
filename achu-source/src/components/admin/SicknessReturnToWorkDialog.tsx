import { Button } from '@/components/ui/button';
import DateField from '@/components/shared/DateField';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

export default function SicknessReturnToWorkDialog({
  rtw, onClose, rtwOn, onRtwOnChange, rtwNote, onRtwNoteChange, busy, onConfirm,
}) {
  return (
    <Dialog open={rtw != null} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return to work</DialogTitle>
          <DialogDescription>
            The date they came back, and anything agreed. Your name goes on it, so the record shows who had
            the conversation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="sk-rtw">Came back on</Label>
            <DateField id="sk-rtw" value={rtwOn} onChange={e => onRtwOnChange(e.target.value)} />
          </div>
          <Textarea aria-label="Note about the return to work" rows={3} value={rtwNote} onChange={e => onRtwNoteChange(e.target.value)}
            placeholder="e.g. Fit to return, no adjustments needed" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy} onClick={onConfirm}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

