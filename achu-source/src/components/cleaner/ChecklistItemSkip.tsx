/**
 * §16 „Failure reason" (Sesiunea 143) — CÂND UN PUNCT NU S-A PUTUT FACE, DE CE.
 *
 * ─── 🔴 CE LIPSEA, ȘI E A DOUA OARĂ ACEEAȘI CLASĂ ───────────────────────────
 * Coloanele `notApplicable` și `notApplicableReason` existau de la portare, ruta le scrie **și**
 * le apără (ACHU-690: „făcut" și „nu se aplică" se exclud, într-o singură scriere), iar **ambele
 * ecrane le afișează** — al curățătorului și al biroului. ⛔ **Nu exista niciun loc din care se
 * scriu.** Măsurat: `notApplicable` nu apare în niciun `updateJobChecklistItem` din tot frontendul.
 *
 * ⚠️ Deci pe telefon un punct avea exact două stări: bifat, sau nebifat. Un punct care **nu s-a
 * putut** face arăta identic cu unul uitat, iar biroul afla care e care sunând pe cineva.
 *
 * ─── ⚠️ COLOANA SPUNE „NU SE APLICĂ"; OMUL VREA SĂ SPUNĂ „NU AM PUTUT" ──────
 * Sunt două lucruri diferite: „casa nu are cuptor" (nu era de făcut) și „nu am avut cheia de la
 * baie" (era de făcut și nu s-a făcut). 🔴 **Nu le-am despărțit în coloane** — ar fi cerut o
 * migrație pentru o distincție pe care **motivul o spune deja**, iar motivul e cel pe care biroul
 * îl citește oricum. ⛔ Ce nu era acceptabil e să nu se știe **niciuna** dintre ele.
 *
 * ─── 🔴 MOTIVUL E OBLIGATORIU, ȘI ASTA E ÎNTREG ROSTUL RÂNDULUI ─────────────
 * Ruta acceptă un motiv gol (are nevoie de asta ca să-l poată **retrage**). ⛔ Aici nu: butonul de
 * salvare stă stins până se alege un motiv. Un punct sărit fără motiv e exact starea de dinainte —
 * ceva nefăcut despre care nimeni nu știe nimic — doar cu o etichetă pe el.
 *
 * ⚠️ **Motive gata scrise, nu doar text liber:** se apasă o dată, cu mănuși, în mașină; și, fiind
 * aceleași cuvinte, se pot NUMĂRA mai târziu („de câte ori nu am avut acces luna asta?"), ceea ce
 * un text liber nu permite. Textul liber a rămas, pentru cazul care nu intră în listă.
 */
import { useState } from 'react';
import { Ban, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateJobChecklistItem } from '@/lib/endpoints';
import { errMsg } from '@/lib/errorMessage';
/**
 * ⛔ Lista stă în `lib`, nu aici: exportată dintr-o componentă, clichetul EXACT de lint dă un
 * avertisment nou și poarta se face roșie — iar lista e oricum date, nu ecran.
 */
import { SKIP_REASONS, SKIP_REASON_MAX as REASON_MAX } from '@/lib/checklistSkipReasons';


export default function ChecklistItemSkip({ itemId, itemLabel, notApplicable, onSaved }: {
  itemId: string;
  /** Numele punctului, ca eticheta butonului să spună despre CE e vorba (cititor de ecran). */
  itemLabel: string;
  notApplicable: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [other, setOther] = useState('');
  const [saving, setSaving] = useState(false);

  const isOther = reason === 'other';
  const finalReason = (isOther ? other.trim() : reason).slice(0, REASON_MAX);

  const send = async (payload: { notApplicable: boolean; notApplicableReason?: string }) => {
    if (saving) return;
    setSaving(true);
    try {
      await updateJobChecklistItem({ checklistItemId: itemId, ...payload });
      setOpen(false);
      setReason(''); setOther('');
      onSaved();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not save that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 🔴 **Retragerea e o apăsare, fără formular.** Un curățător care a sărit un punct din greșeală
   * (sau a găsit cheia zece minute mai târziu) trebuie să poată reveni pe loc; iar ruta stinge ea
   * motivul, deci nu rămâne o propoziție care contrazice starea.
   */
  if (notApplicable) {
    return (
      <button
        type="button"
        className="shrink-0 min-h-[44px] px-2 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-60"
        aria-label={`Undo skipping ${itemLabel}`}
        onClick={() => send({ notApplicable: false })}
        disabled={saving}
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : 'Undo skip'}
      </button>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        // ⚠️ 44px, ca restul suprafețelor de atins din ecranul curățătorului: se apasă în mașină.
        className="shrink-0 min-h-[44px] px-2 text-muted-foreground hover:text-foreground"
        aria-label={`Could not do ${itemLabel}`} title={`Could not do ${itemLabel}`}
        onClick={() => setOpen(true)}
      >
        <Ban className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="w-full space-y-1.5 px-2 pb-2">
      <p className="text-[11px] text-muted-foreground">
        {/* ⚠️ Spune ce se întâmplă cu bifa ÎNAINTE de a alege: marcarea o stinge (regula ACHU-690). */}
        Why was “{itemLabel}” not done? The office sees this; the tick comes off.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {SKIP_REASONS.map(r => (
          <button
            key={r}
            type="button"
            aria-pressed={reason === r}
            onClick={() => setReason(r)}
            className={`min-h-[36px] rounded-full border px-2.5 text-[11px] ${
              reason === r ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground'
            }`}
          >
            {r}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={isOther}
          onClick={() => setReason('other')}
          className={`min-h-[36px] rounded-full border px-2.5 text-[11px] ${
            isOther ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground'
          }`}
        >
          Something else
        </button>
      </div>
      {isOther && (
        <textarea
          id={`skip-${itemId}`}
          aria-label={`Why ${itemLabel} was not done`}
          rows={2}
          maxLength={REASON_MAX}
          value={other}
          onChange={e => setOther(e.target.value)}
          placeholder="The tap in the utility room was dripping too hard to wipe under."
          className="w-full rounded-md border px-2 py-1 text-sm"
        />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className="min-h-[36px] rounded-md bg-primary px-3 text-xs text-primary-foreground disabled:opacity-60"
          onClick={() => send({ notApplicable: true, notApplicableReason: finalReason })}
          /** ⛔ Stins fără motiv: un punct sărit fără motiv e starea de dinainte, cu o etichetă pe ea. */
          disabled={saving || finalReason === ''}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : 'Save reason'}
        </button>
        <button
          type="button"
          className="min-h-[36px] px-3 text-xs text-muted-foreground"
          onClick={() => { setOpen(false); setReason(''); setOther(''); }}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

