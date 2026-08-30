/**
 * ACHU-582 (`Backlog_Client_Prioritar`, Nivel 2) — CASELE ACOPERITE DE UN TERMEN.
 *
 * ─── 🔴 DECIZIILE PE ECRAN ────────────────────────────────────────────────────
 * **Archana, 11/08/2026:** un abonament per persoană, casele ca servicii înăuntru, **o singură
 * factură**. **Roberto, 15/08/2026:** casă nouă **la mijlocul termenului** (cu factură
 * suplimentară) · **aceeași reducere** pe fiecare casă · anularea unei case scoate **doar** linia.
 *
 * ─── 🔴 CELE DOUĂ CIFRE, ȘI DE CE SUNT DOUĂ ───────────────────────────────────
 * **„Paid so far"** = tot ce s-a facturat pe termen, **inclusiv casele ieșite** — o încasare nu
 * dispare când cineva renunță; banii se întorc printr-o rambursare, consemnată separat.
 * **„Still to deliver"** = ce mai e de făcut. ⚠️ Confundate, o rambursare deja plătită devine
 * imposibil de explicat — de aceea ecranul le arată **una lângă alta**, cu etichete diferite.
 *
 * ⚠️ **Fișier propriu**, nu încă 150 de rânduri în `SubscriptionsPage.tsx` — `CLAUDE.md` §3.2.
 */
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Home, Plus, Loader2, Info, X } from 'lucide-react';
import { toast } from 'sonner';
import { fmtDate } from '@/lib/format';
import {
  getSubscriptionLines, previewSubscriptionLine, addSubscriptionLine, cancelSubscriptionLine,
  getCustomerProperties, getRecurringSeriesList,
  type SubscriptionLineList, type SubscriptionLinePreview,
} from '@/lib/endpoints';
import { errMsg } from '@/lib/errorMessage';

type Option = { id: string; label: string };

export default function SubscriptionPropertiesSection({ subscriptionId, customerId, termStatus, onChanged }: {
  subscriptionId: string;
  customerId: string;
  /** ⚠️ Decide dacă adăugarea produce o factură separată — vezi mesajul de previzualizare. */
  termStatus: string;
  onChanged: () => void;
}) {
  const [data, setData] = useState<SubscriptionLineList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const [properties, setProperties] = useState<Option[]>([]);
  const [contracts, setContracts] = useState<Option[]>([]);
  const [form, setForm] = useState({ propertyId: '', recurringSeriesId: '', service: '', fullPricePerVisit: '', fromDate: '' });
  const [preview, setPreview] = useState<SubscriptionLinePreview | null>(null);

  const load = useCallback(() => {
    setError(null);
    getSubscriptionLines({ subscriptionId })
      .then(setData)
      .catch((e: unknown) => setError(errMsg(e) ?? 'Could not load the properties on this term.'));
  }, [subscriptionId]);

  useEffect(() => { load(); }, [load]);

  /** ⚠️ Încărcate abia la deschiderea formularului: lista de case nu e nevoie până atunci. */
  const openAdd = async () => {
    setAdding(true);
    setPreview(null);
    try {
      const [props, series] = await Promise.all([
        getCustomerProperties({ customerId }),
        getRecurringSeriesList({ customerId, status: 'active' }),
      ]);
      setProperties((props.records ?? [])
        .filter((p: { isActive: boolean }) => p.isActive)
        .map((p: { id: string; summary: string }) => ({ id: p.id, label: p.summary })));
      // ⚠️ `reference`, NU `recurringSeriesId`: ruta de listă redenumește câmpul pe ieșire
      // (`backend/src/routes/recurringSeries.ts:245`). Cât timp tipul era `any`, eticheta
      // scria literal „#undefined · Deep clean".
      setContracts((series?.records ?? []).map(c => ({
        id: c.id, label: `#${c.reference} · ${c.service}`,
      })));
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not load the customer’s properties.');
    }
  };

  const ready = form.propertyId && form.recurringSeriesId && form.service.trim() && Number(form.fullPricePerVisit) > 0;

  const body = () => ({
    subscriptionId,
    propertyId: form.propertyId,
    recurringSeriesId: form.recurringSeriesId,
    service: form.service.trim(),
    fullPricePerVisit: Number(form.fullPricePerVisit),
    ...(form.fromDate ? { fromDate: form.fromDate } : {}),
  });

  const doPreview = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      setPreview(await previewSubscriptionLine(body()));
    } catch (e) {
      setPreview(null);
      // Mesajul serverului AȘA CUM E: el spune ce se poate face în loc.
      toast.error(errMsg(e) ?? 'Could not price that property.');
    } finally { setBusy(false); }
  };

  const doAdd = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      const res = await addSubscriptionLine(body());
      toast.success(res.explanation);
      setAdding(false);
      setForm({ propertyId: '', recurringSeriesId: '', service: '', fullPricePerVisit: '', fromDate: '' });
      setPreview(null);
      load(); onChanged();
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not add that property.');
    } finally { setBusy(false); }
  };

  const remove = async (id: string, label: string) => {
    const reason = window.prompt(`Why is ${label} coming off this term?`);
    if (!reason?.trim()) return;
    try {
      const res = await cancelSubscriptionLine({ id, reason: reason.trim() });
      toast.success(res.refund.explanation);
      load(); onChanged();
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not take that property off.');
    }
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-semibold flex items-center gap-1.5">
        <Home className="h-4 w-4" aria-hidden="true" />
        Properties covered by this term
      </p>

      {!data && !error && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading…
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <>
          {/*
            🔴 Cele două cifre, una lângă alta. Vezi antetul: „încasat" nu scade când iese o
            casă, fiindcă banii se întorc printr-o rambursare consemnată.
          */}
          <div className="flex flex-wrap gap-4 text-sm">
            <span><span className="text-muted-foreground">Paid so far:</span> <strong>£{data.totalPaid.toFixed(2)}</strong></span>
            <span><span className="text-muted-foreground">Still to deliver:</span> <strong>£{data.stillToDeliver.toFixed(2)}</strong></span>
          </div>

          <ul className="space-y-1.5">
            {data.records.map(l => (
              <li key={l.id} className="rounded border p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {l.property?.label ?? l.service}
                      {l.status === 'Cancelled' && <Badge variant="outline" className="ml-2">Off the term</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {l.expectedVisits} job{l.expectedVisits === 1 ? '' : 's'} at £{l.pricePerVisit} · from {fmtDate(l.coveredFrom)}
                    </p>
                    {/* ⚠️ Explicația rambursării, nu doar suma: un număr fără propoziție e un
                        număr pe care biroul nu-l poate repeta clientului la telefon. */}
                    {l.refundExplanation && (
                      <p className="text-xs text-muted-foreground mt-0.5">{l.refundExplanation}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm tabular-nums">£{l.amountForThisProperty}</span>
                    {l.status === 'Active' && (
                      <Button
                        type="button" variant="ghost" size="sm"
                        aria-label={`Take ${l.property?.label ?? l.service} off this term`} title={`Take ${l.property?.label ?? l.service} off this term`}
                        onClick={() => remove(l.id, l.property?.label ?? l.service)}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {!adding && (
            <Button type="button" size="sm" variant="outline" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" aria-hidden="true" />Add a property
            </Button>
          )}
        </>
      )}

      {adding && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Property</Label>
              <Select value={form.propertyId} onValueChange={v => { setForm(f => ({ ...f, propertyId: v })); setPreview(null); }}>
                <SelectTrigger aria-label="Property"><SelectValue placeholder="Choose one" /></SelectTrigger>
                <SelectContent>
                  {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Recurring contract</Label>
              <Select value={form.recurringSeriesId} onValueChange={v => { setForm(f => ({ ...f, recurringSeriesId: v })); setPreview(null); }}>
                <SelectTrigger aria-label="Recurring contract"><SelectValue placeholder="Choose one" /></SelectTrigger>
                <SelectContent>
                  {contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {/* ⛔ Spus pe ecran: două case nu pot împărți un orar, altfel vizitele lor nu se
                  pot deosebi când una iese. */}
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Each property needs its own contract — otherwise their jobs cannot be told apart.
              </p>
            </div>
            <div>
              <Label htmlFor="line-service" className="text-xs">Service</Label>
              <Input id="line-service" value={form.service} onChange={e => { setForm(f => ({ ...f, service: e.target.value })); setPreview(null); }} />
            </div>
            <div>
              <Label htmlFor="line-price" className="text-xs">Full price per job (£)</Label>
              <Input
                id="line-price" type="number" min={0} step="0.01"
                value={form.fullPricePerVisit}
                onChange={e => { setForm(f => ({ ...f, fullPricePerVisit: e.target.value })); setPreview(null); }}
              />
              {/* ⚠️ Reducerea nu se tastează: e a TERMENULUI, aceeași pe fiecare casă. */}
              <p className="mt-0.5 text-[11px] text-muted-foreground">The term’s discount is applied to this.</p>
            </div>
            <div className="col-span-2">
              <Label htmlFor="line-from" className="text-xs">Covered from (leave blank for the start of the term)</Label>
              <Input id="line-from" type="date" value={form.fromDate} onChange={e => { setForm(f => ({ ...f, fromDate: e.target.value })); setPreview(null); }} />
            </div>
          </div>

          {preview && (
            <p className="rounded border border-sky-500/40 bg-sky-500/5 p-2 text-xs flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              {preview.explanation}
            </p>
          )}

          <div className="flex gap-2">
            {/* 🔴 Previzualizarea ÎNAINTE de a adăuga: cifra pe care o vede biroul e cifra care
                se scrie, iar suma suplimentară se citește clientului la telefon. */}
            <Button type="button" size="sm" variant="outline" disabled={!ready || busy} onClick={doPreview}>
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />}What would it cost?
            </Button>
            <Button type="button" size="sm" disabled={!ready || busy} onClick={doAdd}>Add</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setPreview(null); }}>Cancel</Button>
          </div>
          {termStatus === 'Active' && (
            <p className="text-[11px] text-muted-foreground">
              This term is already paid, so the new property is invoiced separately for the rest of it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

