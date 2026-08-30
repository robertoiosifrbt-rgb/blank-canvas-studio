/**
 * §16 „Required / Optional checklist items" (Sesiunea 144) — BIROUL SPUNE DACĂ UN PUNCT TREBUIE
 * FĂCUT, PE O VIZITĂ ANUME.
 *
 * ─── 🔴 DE CE EXISTĂ, DEȘI DECIZIA SE POATE LUA ȘI PE CASĂ ──────────────────
 * Pe casă se decide **regula** („scoate gunoiul la stradă" e opțional aici, mereu). Aici se decide
 * **excepția**: azi la casa asta se schimbă cheia, deci baia nu se poate face, dar restul da. ⛔ Fără
 * excepția per vizită, singura ieșire ar fi override-ul — care trimite vizita în „Completion
 * Review", adică muncă de aprobare pentru ceva ce biroul a decis deja.
 *
 * ⚠️ **Doar pe ecranul biroului, și serverul o impune din nou.** Un curățător care ar putea muta
 * punctul care îl oprește în „e bine dacă se face" ar face poarta decorativă — ruta îi refuză
 * câmpul, iar componenta asta nu apare niciodată pe telefonul lui.
 *
 * ⚠️ **Fișier propriu** (`AGENT_RULES` §9): e o capabilitate nouă, nu o linie în plus în lista
 * care doar afișa.
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateJobChecklistItem } from '@/lib/endpoints';
import { errMsg } from '@/lib/errorMessage';

export default function ChecklistRequiredToggle({ itemId, itemLabel, required, photoRequired, onSaved }: {
  itemId: string;
  /** Numele punctului, ca eticheta să spună despre CE e vorba (cititor de ecran). */
  itemLabel: string;
  required: boolean;
  /**
   * §16 (Sesiunea 144) — al doilea steag al biroului: punctul cere o poză de dovadă.
   * ⚠️ **Butonul lui e AICI, nu într-o componentă nouă**, fiindcă e aceeași decizie luată în
   * același loc, pe același rând — două componente ar fi însemnat două chemări identice de rută
   * și două refuzuri de rol scrise separat.
   */
  photoRequired: boolean;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState<'required' | 'photo' | null>(null);

  const flip = async (patch: { required?: boolean; photoRequired?: boolean }, which: 'required' | 'photo') => {
    if (saving) return;
    setSaving(which);
    try {
      await updateJobChecklistItem({ checklistItemId: itemId, ...patch });
      onSaved();
    } catch (e) {
      // Mesajul serverului AȘA CUM E: el spune care regulă a refuzat.
      toast.error(errMsg(e) || 'Could not change that.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
    <button
      type="button"
      onClick={() => flip({ required: !required }, 'required')}
      disabled={saving !== null}
      /**
       * ⚠️ Eticheta spune ce se ÎNTÂMPLĂ, nu în ce stare e — starea se vede din insigna de lângă
       * text. Un buton care ar scrie „Required" ar fi citit de jumătate dintre oameni ca stare și
       * de cealaltă jumătate ca acțiune.
       */
      aria-label={required ? `Make ${itemLabel} optional` : `Make ${itemLabel} required`}
      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-60"
    >
      {saving === 'required'
        ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        : (required ? 'Make optional' : 'Make required')}
    </button>
    {/**
      * §16 (Sesiunea 144) — ⚠️ **eticheta spune ce se întâmplă, ca vecina ei.** „Ask for a photo"
      * e o cerere adresată curățătorului, nu o stare a punctului; starea se vede din insigna de
      * lângă text.
      */}
    <button
      type="button"
      onClick={() => flip({ photoRequired: !photoRequired }, 'photo')}
      disabled={saving !== null}
      aria-label={photoRequired ? `Stop asking for a photo for ${itemLabel}` : `Ask for a photo for ${itemLabel}`}
      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-60"
    >
      {saving === 'photo'
        ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        : (photoRequired ? 'No photo needed' : 'Ask for a photo')}
    </button>
    </>
  );
}

