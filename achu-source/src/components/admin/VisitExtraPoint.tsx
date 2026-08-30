/**
 * §16 „Customer-requested additions" (Sesiunea 148) — **BIROUL ADAUGĂ UN PUNCT PE O VIZITĂ.**
 *
 * ─── 🔴 DE CE AICI, ȘI NU PE CASĂ ───────────────────────────────────────────────────────────
 * Pe casă (`PropertyChecklistManager`) se scrie ce se face **de fiecare dată**. Aici se scrie ce se
 * face **marțea asta**: clientul a cerut ceva în plus, sau curățătorul de săptămâna trecută a lăsat
 * o notă. ⛔ Pus pe casă, „doar de data asta" ar apărea de cincizeci de ori pe an pe un contract
 * săptămânal, iar cine îl scoate luna viitoare n-ar ști de ce fusese pus.
 *
 * ⚠️ **Fișier propriu** (`AGENT_RULES` §9): scrie, nu doar afișează, și are refuzuri proprii.
 *
 * 🔴 **Ce spune ecranul, și de ce cu litere:** un punct adăugat e, până la proba contrarie, muncă
 * de făcut — deci **oprește încheierea vizitei**. Cine adaugă o favoare pe care curățătorul o face
 * „dacă ajunge" trebuie să vadă comutatorul chiar acolo, nu să afle de la un refuz la ușă.
 */
import { useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { addVisitChecklistPoint, removeVisitChecklistPoint } from '@/lib/visitExtraEndpoints';
import { errMsg } from '@/lib/errorMessage';

export function AddVisitPoint({ jobId, onAdded }: { jobId: string; onAdded: () => void }) {
  const [label, setLabel] = useState('');
  const [required, setRequired] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    /**
     * ⚠️ Verificarea de aici e doar ca să nu plece o cerere goală degeaba — **textul refuzului
     * rămâne al serverului** (`visitExtraPolicy.ts`), care spune ce se așteaptă, cu un exemplu. ⛔ O
     * a doua propoziție scrisă în ecran s-ar despărți de a lui la prima corectură.
     */
    if (!label.trim()) return;
    setSaving(true);
    try {
      await addVisitChecklistPoint({ jobId, label: label.trim(), required });
      setLabel('');
      setRequired(true);
      toast.success('Added to this job only.');
      onAdded();
    } catch (e) {
      toast.error(errMsg(e));
    }
    setSaving(false);
  };

  return (
    <div className="space-y-1.5 rounded-lg border border-dashed px-3 py-2">
      <label htmlFor={`extra-${jobId}`} className="text-xs font-semibold">
        Add a point for this job only
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`extra-${jobId}`}
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
          placeholder="Clean the inside of the kitchen window"
          className="flex-1 min-w-0 rounded border bg-background px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving || !label.trim()}
          className="shrink-0 inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Add
        </button>
      </div>
      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <input type="checkbox" checked={!required} onChange={e => setRequired(!e.target.checked)} />
        Only if there is time — this one will not stop the job being completed
      </label>
      {/* ⚠️ Se spune unde NU ajunge: altfel cineva îl adaugă aici pentru fiecare săptămână. */}
      <p className="text-[10px] text-muted-foreground">
        For something that should come up every time, put it on the property instead.
      </p>
    </div>
  );
}

/**
 * ⚠️ **Butonul apare doar pe punctele adăugate pe vizită**, iar decizia se ia din `sourceField`,
 * nu din grup: grupul e un titlu care se poate schimba, sursa e ce citește și serverul. ⛔ Iar pe un
 * punct la care s-a răspuns (bifat sau „nu se aplică") nu apare deloc — ruta îl refuză, și un buton
 * care întoarce un refuz e mai rău decât niciun buton.
 */
export function RemoveVisitPoint({ itemId, itemLabel, onRemoved }: {
  itemId: string; itemLabel: string; onRemoved: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const remove = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await removeVisitChecklistPoint(itemId);
      onRemoved();
    } catch (e) {
      toast.error(errMsg(e));
    }
    setSaving(false);
  };

  return (
    <button
      type="button"
      onClick={() => void remove()}
      disabled={saving}
      aria-label={`Remove ${itemLabel} from this job`} title={`Remove ${itemLabel} from this job`}
      className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
    >
      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
    </button>
  );
}

