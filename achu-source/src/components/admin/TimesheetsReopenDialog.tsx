/**
 * 🔴 §17 „Correction reason" (Sesiunea 151) — **DE CE SE DESCHIDE O ORĂ DEJA APROBATĂ.**
 *
 * ⚠️ Un rând aprobat nu se poate schimba în loc: se **redeschide** întâi, ca schimbarea unei cifre
 * convenite să fie o decizie cu un nume pe ea. ⛔ Dar până azi redeschiderea nu cerea **nimic** — o
 * oră agreată cu omul se deblocca dintr-o apăsare, iar jurnalul spunea *„reopened"* fără să spună de
 * ce. 🔴 Disputa cerea un motiv, ștergerea cerea un motiv; asta, care schimbă chiar cifra plătită, nu.
 *
 * ⚠️ Aceeași formă ca dialogul de dispută, deliberat: același gest cere același ecran, iar biroul nu
 * învață un al doilea tipar pentru același lucru.
 */
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import type { Entry } from '@/lib/timesheetsFormat';

export default function TimesheetsReopenDialog({
  reopening, onClose, reason, onReasonChange, busy, onConfirm,
}: {
  reopening: Entry | null;
  onClose: () => void;
  reason: string;
  onReasonChange: (value: string) => void;
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={reopening != null} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Why are these hours being reopened?</DialogTitle>
          <DialogDescription>
            These {reopening?.workedHours}h were agreed with the person and could have been paid. A reason is
            required — a changed wage needs an explanation somebody can read a year from now.
          </DialogDescription>
        </DialogHeader>
        <Textarea aria-label="Why are these hours being reopened?" value={reason} rows={3} onChange={e => onReasonChange(e.target.value)}
          placeholder="e.g. Maria's shift was entered twice — this one is the duplicate" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy || reason.trim().length < 3} onClick={onConfirm}>
            Reopen these hours
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

