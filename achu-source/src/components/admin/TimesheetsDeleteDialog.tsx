import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import type { Entry } from '@/lib/timesheetsFormat';

/**
 * 🔴 ACHU-498 — CONFIRMAREA LA ȘTERGEREA UNOR ORE.
 *
 * Roberto, 15/08/2026, când i-am spus că ștergerea rămâne un singur click:
 * *„Fara buton de confirmare? Serios?"*. Avea dreptate: se ștergeau ore de
 * muncă ale unui om, ireversibil pentru el, fără ca nimic să întrebe nimic.
 *
 * ⚠️ Dialogul arată **cifrele despre care e vorba** — cine, ce zi, câte ore — nu
 * un „ești sigur?" generic. Un „ești sigur?" care apare la fel pentru orice se
 * apasă din reflex într-o săptămână; unul care spune *„Maria, 27 iulie, 7.5
 * ore"* se citește, fiindcă e singurul loc unde poți vedea că ai apăsat pe
 * rândul greșit.
 *
 * ⛔ Motivul rămâne OPȚIONAL, deliberat. Un birou obligat să scrie ceva scrie
 * „x", iar atunci câmpul arată completat fără să însemne nimic — mai rău decât
 * gol, fiindcă gol se vede că lipsește.
 */
export default function TimesheetsDeleteDialog({
  deleting, onClose, reason, onReasonChange, busy, onConfirm,
}: {
  deleting: Entry | null;
  onClose: () => void;
  reason: string;
  onReasonChange: (value: string) => void;
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={deleting != null} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete these hours?</DialogTitle>
          <DialogDescription>
            {deleting && (
              <span className="mb-2 block font-medium text-foreground">
                {deleting.workDate} · {deleting.startTime}–{deleting.finishTime} · {deleting.workedHours}h
              </span>
            )}
            The row stays visible, crossed out, with your name and the time on it — it is not
            erased. Nothing will be paid on it.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          aria-label="Why are these hours being deleted?"
          value={reason}
          rows={2}
          onChange={e => onReasonChange(e.target.value)}
          placeholder="Why? Optional — e.g. typed on the wrong person"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="destructive" disabled={busy} onClick={onConfirm}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

