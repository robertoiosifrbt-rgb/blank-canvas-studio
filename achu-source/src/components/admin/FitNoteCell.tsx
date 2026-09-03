/**
 * ACHU-392 — CERTIFICATUL MEDICAL, pe rândul absenței.
 *
 * ─── 🔴 DECIZIA LUI ROBERTO, 15/08/2026 ───────────────────────────────────────
 * Certificatul îl vede **doar Admin** — nici HR. Ecranul de boală e deja admin-only, iar
 * serverul refuză oricum pe altcineva; aici se **scrie pe ecran**, ca la pozele de casă:
 * cine încarcă trebuie să știe cine citește.
 *
 * ⛔ **Componentă proprie, nu încă 60 de rânduri în `SicknessAbsencesTable`** — aceea e o
 * tabelă fără stare, iar felia asta are trei stări ale ei (încărcare, deschidere, confirmare
 * de ștergere). Regula: o capabilitate nouă intră în fișierul ei (`AGENT_RULES` §9).
 *
 * ⚠️ **Ștergerea cere două apăsări**, nu un dialog: rândul e într-o tabelă, iar un dialog peste
 * tabelă ar acoperi tocmai persoana la care se uită omul. A doua apăsare spune ce se pierde.
 */
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Eye, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';
import { prepareImageForUpload } from '@/lib/imageCompression';
import {
  uploadFitNote, fitNoteLink, removeFitNote, FIT_NOTE_ACCEPT, FIT_NOTE_MAX_BYTES,
} from '@/lib/fitNoteEndpoints';

export default function FitNoteCell({ absenceId, hasFitNote, disabled, onChanged }: {
  absenceId: string;
  hasFitNote: boolean;
  disabled?: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      /**
       * ⚠️ base64, ca la celelalte încărcări: `readAsDataURL` întoarce prefixul
       * `data:...;base64,`, iar serverul îl acceptă cu sau fără el.
       *
       * 🔴 **MICȘORATĂ ÎNTÂI, dar numai dacă e poză (§32, Sesiunea 147).** ⛔ Un fit note e des un
       * **PDF**, iar un PDF trecut prin canvas ar fi ieșit o pagină albă — de aceea decizia stă în
       * `prepareImageForUpload`, care nu atinge ce nu poate deschide. ⚠️ Mesajul de dinainte cerea
       * *„fotografiază nota în loc să o scanezi la calitate maximă"*: o instrucțiune pentru un om
       * care tocmai a primit hârtia de la angajat și nu are de unde ști ce înseamnă.
       */
      const { dataUrl: fileData, bytes } = await prepareImageForUpload(file);
      if (bytes > FIT_NOTE_MAX_BYTES) {
        toast.error('That file is larger than 10MB, even after shrinking it. Photograph the note instead of sending a full-quality scan.');
        return;
      }
      await uploadFitNote({ absenceId, filename: file.name, fileData });
      toast.success('Fit note attached. Only Admin can open it.');
      onChanged();
    } catch (e) {
      // Mesajul serverului AȘA CUM E: el spune ce se poate face în loc.
      toast.error(errMsg(e) || 'Could not attach that fit note.');
    } finally {
      setBusy(false);
      // Altfel, alegerea aceluiași fișier a doua oară nu mai declanșează nimic.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const open = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { signedUrl } = await fitNoteLink(absenceId);
      // ⚠️ Fereastră nouă, fără `opener`: pagina deschisă nu trebuie să poată atinge aplicația.
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error(errMsg(e) || 'Could not open that fit note.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await removeFitNote(absenceId);
      toast.success('Fit note deleted. The sickness record stays.');
      setConfirming(false);
      onChanged();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not delete that fit note.');
    } finally {
      setBusy(false);
    }
  };

  if (!hasFitNote) {
    return (
      <span className="block mt-1">
        <input
          ref={inputRef}
          type="file"
          accept={FIT_NOTE_ACCEPT}
          className="hidden"
          data-testid={`fit-note-input-${absenceId}`}
          onChange={e => pick(e.target.files?.[0])}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1 text-xs text-muted-foreground"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Paperclip className="h-3 w-3 mr-1" />}
          Add fit note
        </Button>
      </span>
    );
  }

  return (
    <span className="block mt-1 text-xs text-muted-foreground">
      Fit note on file — Admin only
      <span className="flex flex-wrap gap-1 mt-0.5">
        <Button size="sm" variant="ghost" className="h-6 px-1 text-xs" disabled={busy} onClick={open}>
          {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Eye className="h-3 w-3 mr-1" />}
          View
        </Button>
        {confirming ? (
          <>
            <Button size="sm" variant="destructive" className="h-6 px-1 text-xs" disabled={busy} onClick={remove}>
              Delete the note?
            </Button>
            <Button size="sm" variant="ghost" className="h-6 px-1 text-xs" disabled={busy}
              onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" className="h-6 px-1 text-xs" disabled={disabled || busy}
            title="Delete the fit note. The sickness record itself stays."
            onClick={() => setConfirming(true)}>
            <Trash2 className="h-3 w-3 mr-1 text-destructive" />
            Delete
          </Button>
        )}
      </span>
    </span>
  );
}

