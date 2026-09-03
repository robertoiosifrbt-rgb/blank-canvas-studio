/**
 * ACHU-556 (Sesiunea 122, `Backlog_Client_Prioritar` Nivel 2) — SERVICIILE EXTRA LA O VIZITĂ.
 *
 * Răspunde la întrebarea *„de ce vizita asta a costat 90 £ și nu 60 £"* — pusă de client pe
 * factură, și de birou peste trei luni.
 *
 * 🔴 **ECRANUL SPUNE, ÎNAINTE DE SALVARE, CĂ SUMA VIZITEI SE SCHIMBĂ.** Fiecare adăugare
 * mută `Job.amountCharged` cu prețul liniei, în aceeași tranzacție de pe server — deci
 * butonul nu adaugă „o notă", ci **mărește nota de plată a unui om**. Un ecran care ar tăcea
 * despre asta ar fi o unealtă în care se apasă din greșeală.
 *
 * ⚠️ **Câmpul „Amount charged" de mai sus în dialog NU se rescrie de aici**, deliberat: e un
 * formular nesalvat, iar suprascrierea a ceea ce tastează cineva în timp ce tastează e o cale
 * bună de a pierde o cifră. Panoul arată suma NOUĂ, venită de la server, și spune că e cea
 * reală. Un `Reload` al dialogului aduce formularul la ea.
 */

import { useEffect, useState, useCallback } from 'react';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Loader2, Info, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { getJobServiceExtras, addJobServiceExtra, removeJobServiceExtra, type JobServiceExtrasResponse } from '@/lib/endpoints';
import { errMsg } from '@/lib/errorMessage';

const gbp = (n: number) => `£${n.toFixed(2)}`;

export default function JobServiceExtrasSection({ jobId }: { jobId: string }) {
  const req = useTrackedRequest<JobServiceExtrasResponse>({ timeoutMs: 20000 });
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ description: '', price: '' });

  const { fire } = req;
  const load = useCallback(() => { fire(() => getJobServiceExtras({ jobId })); }, [fire, jobId]);
  useEffect(() => { load(); }, [load]);

  const data = req.data;
  const loading = !data && !req.error;
  const extras = data?.extras ?? [];

  const handleAdd = async () => {
    if (saving) return;
    const price = Number(form.price);
    /**
     * ⚠️ Verificat și aici, nu doar pe server: un câmp gol dă `Number('') === 0`, deci fără
     * rândul ăsta „Add" ar trimite tăcut o linie de 0 £ pe care serverul o acceptă (zero e
     * permis, e cazul „din partea casei"). Biroul ar crede că a scris un preț.
     */
    if (!form.description.trim()) { toast.error('Describe what the extra was.'); return; }
    if (form.price.trim() === '' || Number.isNaN(price)) { toast.error('Enter a price — use 0 if it is free of charge.'); return; }
    setSaving(true);
    try {
      const next = await addJobServiceExtra({ jobId, description: form.description.trim(), price });
      req.setData(next);
      toast.success(`Added — this job now totals ${gbp(next.amountCharged)}`);
      setForm({ description: '', price: '' });
      setShowAdd(false);
    } catch (e) {
      // Mesajul serverului se arată așa cum e: el spune ce să facă biroul în schimb
      // („void the invoice and re-issue", „change the amount on the visit itself").
      toast.error(errMsg(e) || 'Could not add the extra.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * §48 „Undo for safe actions" (Sesiunea 154) — SCOATEREA UNEI LINII SCHIMBĂ PREȚUL VIZITEI.
   *
   * 🔴 Era o singură apăsare, fără confirmare și fără întoarcere: cine nimerea coșul de gunoi al
   * rândului greșit trebuia să-și amintească **exact** ce scria și cât costa, apoi să tasteze la loc.
   *
   * ⛔ Răspunsul NU e o casetă de confirmare. Rândul se scoate des și pe drept; o întrebare „ești
   * sigur?" la fiecare apăsare se învață pe dinafară în două zile și se apasă la fel de din reflex ca
   * butonul. ✅ Un „Undo" costă nimic când nu-l folosești și rezolvă tot când îl folosești.
   *
   * ⚠️ Întoarcerea **re-adaugă** linia, nu o „dez-șterge": rămâne o scoatere și o adăugare în audit,
   * iar asta e adevărul — cineva chiar a făcut amândouă.
   */
  const handleRemove = async (extraId: string, description: string, price: number) => {
    try {
      const next = await removeJobServiceExtra({ jobId, extraId });
      req.setData(next);
      toast.success(`Removed — this job now totals ${gbp(next.amountCharged)}`, {
        action: {
          label: 'Undo',
          onClick: () => void handleUndoRemove(description, price),
        },
      });
    } catch (e) {
      toast.error(errMsg(e) || `Could not remove "${description}".`);
    }
  };

  const handleUndoRemove = async (description: string, price: number) => {
    try {
      const next = await addJobServiceExtra({ jobId, description, price });
      req.setData(next);
      toast.success(`Put back — this job totals ${gbp(next.amountCharged)} again`);
    } catch (e) {
      // ⚠️ Mesajul spune ce s-a pierdut, ca omul să nu fie nevoit să și-l amintească.
      toast.error(errMsg(e) || `Could not put "${description}" (${gbp(price)}) back.`);
    }
  };

  const editable = data?.editable ?? false;
  const atLimit = !!data && extras.length >= data.maxExtras;

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Extra work on this job</h3>
        {editable && !showAdd && !atLimit && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAdd(true)}>
            <Plus className="h-3 w-3 mr-1" />Add
          </Button>
        )}
      </div>

      {/* 🔴 Rândul care împiedică o apăsare din reflex. Vezi antetul fișierului. */}
      <p className="text-xs text-muted-foreground flex items-start gap-1">
        <Info className="h-3 w-3 shrink-0 mt-0.5" aria-hidden="true" />
        Adding or removing a line changes what this job costs, and the customer is told.
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />Loading…
        </p>
      ) : req.error ? (
        <p className="text-xs text-destructive">Could not load the extras for this job.</p>
      ) : (
        <>
          {extras.length === 0 && <p className="text-xs text-muted-foreground">Nothing extra was done on this job.</p>}

          {extras.length > 0 && (
            <div className="space-y-1">
              {extras.map(e => (
                <div key={e.id} className="flex items-start justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5">
                  <div className="min-w-0">
                    <span className="text-sm">{e.description}</span>
                    {e.createdBy && <p className="text-xs text-muted-foreground">Added by {e.createdBy}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm tabular-nums">{gbp(e.price)}</span>
                    {editable && (
                      <button
                        className="p-1 rounded hover:bg-destructive/10 text-destructive"
                        title={`Remove ${e.description}`}
                        aria-label={`Remove ${e.description}`}
                        onClick={() => void handleRemove(e.id, e.description, e.price)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/*
                🔴 Defalcarea, nu doar totalul extraselor. „Din 90 £, 30 £ sunt extrase" e
                singura formă care spune și cât costă curățenia în sine — cifra pe care biroul
                o compară cu prețul obișnuit al clientului.
              */}
              <div className="flex items-center justify-between gap-2 px-2 pt-1 text-xs">
                <span className="text-muted-foreground">Cleaning {gbp(data!.baseAmount)} + extras {gbp(data!.extrasTotal)}</span>
                <span className="font-medium tabular-nums">Job total {gbp(data!.amountCharged)}</span>
              </div>

              {/*
                ⚠️ Nu e o eroare de reparat, e o stare legitimă de arătat: cineva a coborât suma
                vizitei de mână după ce extrasele au fost adăugate. Ecranul o numește, ca să nu
                fie descoperită pe factură.
              */}
              {data!.extrasExceedCharge && (
                <p className="text-xs text-amber-600 dark:text-amber-500 px-2">
                  The extras add up to more than this job is charged. Someone changed the amount by hand — check which figure is right.
                </p>
              )}
            </div>
          )}

          {!editable && data?.reason && (
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <Lock className="h-3 w-3 shrink-0 mt-0.5" aria-hidden="true" />
              {data.reason}
            </p>
          )}

          {editable && atLimit && (
            <p className="text-xs text-muted-foreground">
              This job already has {data!.maxExtras} extras — combine some lines before adding another.
            </p>
          )}
        </>
      )}

      {showAdd && (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <div>
              <Label htmlFor="jobextra-description" className="text-xs">What was done *</Label>
              <Input
                id="jobextra-description"
                className="h-8 text-sm"
                value={form.description}
                maxLength={200}
                placeholder="Oven cleaned"
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="jobextra-price" className="text-xs">Price (£) *</Label>
              <Input
                id="jobextra-price"
                className="h-8 text-sm"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                placeholder="30.00"
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The customer sees this line and gets a notification. Use 0 if it was free of charge.
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={() => void handleAdd()}>
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}Add extra
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowAdd(false); setForm({ description: '', price: '' }); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

