/**
 * ACHU-577 (`Backlog_Functionalitati_Viitoare` §5, Grupul E) — MUNCA REPETATĂ LA ACEEAȘI CASĂ.
 *
 * ─── 🔴 GOLUL ─────────────────────────────────────────────────────────────────
 * Ce se face de fiecare dată la o casă se **retastează** azi în instrucțiunile fiecărei vizite.
 * Pe un contract săptămânal, de cincizeci de ori pe an — iar când cineva uită o dată,
 * curățătorul din ziua aceea nu află, și nimeni nu observă până sună clientul.
 *
 * ─── DE CE DOUĂ LUCRURI PE ACELAȘI ECRAN ──────────────────────────────────────
 * **Textul** e ce trebuie ȘTIUT („aspiratorul e în debara, nu-l aduceți"). **Punctele** sunt ce
 * trebuie BIFAT — fiecare intră în checklistul vizitei, deci biroul poate vedea care s-a făcut.
 * ⛔ Un text nu se bifează, iar o bifă nu poate explica unde e aspiratorul.
 *
 * ⚠️ **Punctele se pot adăuga abia după ce casa există** — au nevoie de `id`-ul ei. Se **spune**
 * pe ecran, în loc să apară un formular care eșuează la salvare.
 */
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ListChecks, Plus, Trash2, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  getPropertyChecklist, addPropertyChecklistPoint, deletePropertyChecklistPoint,
  updatePropertyChecklistPoint,
  type PropertyChecklistPoint,
} from '@/lib/endpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { errMsg } from '@/lib/errorMessage';

export default function PropertyRecurringWork({ propertyId, standardInstructions, onChange }: {
  /** `null` cât timp casa nu e salvată — atunci punctele nu se pot atașa de nimic. */
  propertyId: string | null;
  standardInstructions: string;
  onChange: (patch: { standardInstructions: string }) => void;
}) {
  const req = useTrackedRequest<{ records: PropertyChecklistPoint[] }>({ timeoutMs: 20000 });
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const { fire } = req;
  const load = useCallback(() => {
    if (propertyId) fire(() => getPropertyChecklist({ propertyId }));
  }, [fire, propertyId]);

  useEffect(() => { load(); }, [load]);

  const points = req.data?.records ?? [];

  const add = async () => {
    if (!propertyId || !newLabel.trim() || saving) return;
    setSaving(true);
    try {
      await addPropertyChecklistPoint({ propertyId, label: newLabel.trim() });
      setNewLabel('');
      load();
    } catch (e) {
      // Mesajul serverului AȘA CUM E: el spune ce se poate face în loc („Remove one first").
      toast.error(errMsg(e) || 'Could not add that.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * §16 (Sesiunea 144) — mută punctul între „trebuie făcut" și „e bine dacă se face".
   *
   * ⚠️ **Vizitele care au DEJA checklist generat rămân cum sunt** — se spune pe ecran, mai jos,
   * fiindcă altfel biroul ar crede că a schimbat și ziua de mâine.
   */
  const setRequired = async (id: string, required: boolean) => {
    try {
      await updatePropertyChecklistPoint({ id, required });
      load();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not change that.');
    }
  };

  /**
   * §16 „Photo required per item" (Sesiunea 144) — biroul cere o poză la punctul ăsta, de fiecare
   * dată când se vine aici. ⚠️ Aceeași rută ca `setRequired`, deci același `load()` după: cele două
   * steaguri sunt decizii separate pe același rând.
   */
  const setPhotoRequired = async (id: string, photoRequired: boolean) => {
    try {
      await updatePropertyChecklistPoint({ id, photoRequired });
      load();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not change that.');
    }
  };

  const remove = async (id: string) => {
    try {
      await deletePropertyChecklistPoint({ id });
      load();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not remove that.');
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-sky-500/40 bg-sky-500/5 p-3">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
        Every time we come here
      </p>
      <p className="text-xs text-muted-foreground">
        <strong>The cleaner sees this on every job to this property</strong> — so it does not
        have to be typed into each booking.
      </p>

      <div>
        <Label htmlFor="prop-standing" className="text-xs">What we do every time here</Label>
        <Textarea
          id="prop-standing"
          rows={3}
          value={standardInstructions}
          onChange={e => onChange({ standardInstructions: e.target.value })}
          placeholder="The hoover is in the cupboard under the stairs — no need to bring one. Wipe the window sills, she checks them."
        />
        {/* ⚠️ Spus pe ecran: cele două câmpuri arată la fel și se confundă, iar cel greșit e
            rescris la fiecare vizită. */}
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Not the same as the note on a single job — that one is about that day only.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Extra checklist points for this property</Label>
        {/* 🔴 Diferența față de textul de mai sus, spusă: astea se BIFEAZĂ, deci biroul poate
            vedea după vizită care s-a făcut. */}
        <p className="text-[11px] text-muted-foreground">
          These are added to the checklist of every job here, and get ticked off one by one.
        </p>

        {!propertyId ? (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            Save the property first, then you can add its own checklist points.
          </p>
        ) : (
          <>
            {!req.data && !req.error && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Loading…
              </div>
            )}
            {req.error && <p className="text-xs text-destructive">Could not load the checklist points.</p>}

            {points.map(p => (
              <div key={p.id} className="flex items-center gap-2 rounded bg-background/60 px-2 py-1">
                <span className="text-sm flex-1 break-words">
                  {p.label}
                  {/* ⚠️ Se marchează doar excepția — o insignă pe fiecare rând ar fi tapet. */}
                  {!p.required && (
                    <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground align-middle">
                      Optional
                    </span>
                  )}
                  {p.photoRequired && (
                    <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground align-middle">
                      Photo
                    </span>
                  )}
                </span>
                {/**
                  * 🔴 §16 (Sesiunea 144) — **aici se decide o SINGURĂ dată**, pentru toate vizitele
                  * viitoare la casa asta. ⛔ Alternativa era să se marcheze opțional pe fiecare
                  * vizită în parte: de cincizeci de ori pe an pe un contract săptămânal, adică
                  * exact munca repetată pe care ecranul ăsta a existat ca s-o scoată din drum.
                  */}
                <Button
                  type="button" variant="ghost" size="sm"
                  aria-label={p.required ? `Make ${p.label} optional` : `Make ${p.label} required`}
                  className="text-[10px] text-muted-foreground"
                  onClick={() => setRequired(p.id, !p.required)}
                >
                  {p.required ? 'Make optional' : 'Make required'}
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  aria-label={p.photoRequired ? `Stop asking for a photo for ${p.label}` : `Ask for a photo for ${p.label}`}
                  className="text-[10px] text-muted-foreground"
                  onClick={() => setPhotoRequired(p.id, !p.photoRequired)}
                >
                  {p.photoRequired ? 'No photo' : 'Ask for a photo'}
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  aria-label={`Remove ${p.label}`} title={`Remove ${p.label}`}
                  onClick={() => remove(p.id)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}

            {req.data && points.length === 0 && (
              <p className="text-xs text-muted-foreground">None yet.</p>
            )}

            <div className="flex gap-2">
              <Input
                aria-label="New checklist point"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Put the bins out"
                // ⚠️ Enter adaugă: biroul tastează o listă, iar mutarea mâinii pe buton între
                // fiecare rând e chiar motivul pentru care nu se completează liste.
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
              />
              <Button
                type="button" size="sm" aria-label="Add checklist point" title="Add checklist point"
                onClick={add} disabled={!newLabel.trim() || saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              </Button>
            </div>
            {/* ⚠️ Ce se întâmplă cu vizitele deja programate — altfel biroul șterge un punct și
                nu știe dacă a rescris istoria. */}
            <p className="text-[11px] text-muted-foreground">
              Removing one leaves past jobs exactly as they were — anything already ticked stays
              ticked.
            </p>
            {/**
              * 🔴 §16 (Sesiunea 144) — **cele două jumătăți ale schimbării, spuse amândouă.**
              * ⚠️ „Optional" e util doar dacă se știe ce înseamnă (nu oprește încheierea vizitei),
              * iar cine schimbă un punct trebuie să afle pe loc că vizitele deja deschise nu se
              * mișcă — altfel ar crede că a schimbat și ziua de mâine, și nu ar verifica.
              */}
            <p className="text-[11px] text-muted-foreground">
              An <strong>optional</strong> point still shows on the cleaner’s list, but it does not
              stop them finishing the job. Changing this applies to jobs from now on — ones
              already opened keep what they had.
            </p>
            {/**
              * 🔴 §16 (Sesiunea 144) — **ce înseamnă „ask for a photo", spus înainte de a fi apăsat.**
              * ⚠️ Biroul trebuie să afle DOUĂ lucruri: că punctul nu se mai poate bifa fără poză (deci
              * poate bloca un curățător), și că poza e din casa clientului (deci nu se cere din
              * curiozitate). Fără a doua propoziție, butonul ar fi apăsat „ca să vedem".
              */}
            <p className="text-[11px] text-muted-foreground">
              Asking for a <strong>photo</strong> means the cleaner cannot tick that point without
              taking one. Only ask where the photo is worth having — it is a picture inside the
              customer’s home, and it is kept with their data.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

