/**
 * §16 „Cleaner notes per item" (Sesiunea 143) — omul care a fost acolo scrie o propoziție pe
 * punctul de care e vorba.
 *
 * ─── 🔴 CE LIPSEA, ȘI CE EXISTA DEJA ────────────────────────────────────────
 * Coloana `notes`, ruta care o scrie și **afișarea** ei pe ecranul curățătorului existau de la
 * portare. ⛔ **Nu exista locul unde omul o scrie** — atingerea rândului doar bifa. Deci nota era
 * o funcționalitate care se putea citi și nu se putea scrie: exact clasa pe care proiectul o
 * numește „un preview pe care niciun ecran nu îl afișează", în oglindă.
 *
 * ─── De ce un fișier propriu ─────────────────────────────────────────────────
 * `AGENT_RULES` §9 — o capabilitate nouă intră în fișierul ei; `WorkChecklist.tsx` rămâne lista.
 *
 * ─── ⚠️ DE CE UN BUTON SEPARAT, ȘI NU O APĂSARE LUNGĂ PE RÂND ───────────────
 * Rândul e o suprafață de bifat, iar bifatul e ce se întâmplă de zeci de ori pe zi. O apăsare
 * lungă care deschide o casetă de text ar fi însemnat că un deget ținut o clipă mai mult pe un
 * telefon, cu mănuși, deschide un formular în loc să bifeze. ⛔ Butonul de notă e mic și lateral,
 * exact ca să nu concureze cu bifatul.
 *
 * ⚠️ **Nu atinge bifa.** Trimite DOAR `notes`, iar ruta scrie doar coloana aceea — o notă nu
 * spune nimic despre dacă munca s-a făcut.
 */
import { useState } from 'react';
import { StickyNote, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateJobChecklistItem } from '@/lib/endpoints';
import { errMsg } from '@/lib/errorMessage';

/** Cât încape. Aceeași cifră ca plafonul rutei: un plafon mai mare aici ar produce un refuz. */
const NOTE_MAX = 5000;

export default function ChecklistItemNote({ itemId, itemLabel, note, onSaved }: {
  itemId: string;
  /** Numele punctului, ca eticheta butonului să spună despre CE e nota (cititor de ecran). */
  itemLabel: string;
  note: string | null;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      /**
       * ⚠️ Textul golit pleacă drept `''`, nu se sare peste el: altfel o notă scrisă greșit nu
       * s-ar putea retrage — iar ruta o transformă într-o consemnare de „notă ștearsă".
       */
      await updateJobChecklistItem({ checklistItemId: itemId, notes: text.trim() });
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not save that note. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        // ⚠️ 44px, ca restul suprafețelor de atins din ecranul curățătorului: se apasă în mașină.
        className="shrink-0 min-h-[44px] px-2 text-muted-foreground hover:text-foreground"
        aria-label={note ? `Edit the note on ${itemLabel}` : `Add a note to ${itemLabel}`} title={note ? `Edit the note on ${itemLabel}` : `Add a note to ${itemLabel}`}
        onClick={() => { setText(note ?? ''); setOpen(true); }}
      >
        <StickyNote className={`h-4 w-4 ${note ? 'text-amber-500' : ''}`} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="w-full space-y-1.5 px-2 pb-2">
      <label htmlFor={`note-${itemId}`} className="text-[11px] text-muted-foreground block">
        {/* 🔴 Spune cine citește ÎNAINTE de a scrie — regula de la instrucțiunile de acces. */}
        A note for the office about “{itemLabel}”. The customer does not see this.
      </label>
      <textarea
        id={`note-${itemId}`}
        rows={2}
        maxLength={NOTE_MAX}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Fridge was full — could not clean the bottom shelf."
        className="w-full rounded-md border px-2 py-1 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="min-h-[36px] rounded-md bg-primary px-3 text-xs text-primary-foreground disabled:opacity-60"
          onClick={save}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : 'Save note'}
        </button>
        <button
          type="button"
          className="min-h-[36px] px-3 text-xs text-muted-foreground"
          onClick={() => setOpen(false)}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

