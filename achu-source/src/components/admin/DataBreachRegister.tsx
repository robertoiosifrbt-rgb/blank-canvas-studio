/**
 * 🔴 ACHU-770 / §45 „Breach-response workflow" (Sesiunea 148) — REGISTRUL BREȘELOR, PE ECRAN.
 *
 * ─── ⛔ DE CE EXISTĂ ────────────────────────────────────────────────────────
 * Pagina de deasupra spunea deja, corect: *„The law requires a record of EVERY breach, including the
 * ones you decide not to report, with the reason why"*. ⛔ Iar aplicația nu avea unde să se scrie,
 * deci trimitea omul la un caiet — exact în ziua în care are 72 de ore.
 *
 * ─── ⚠️ FIȘIER PROPRIU, ȘI ASTA APĂRĂ CEVA ────────────────────────────────
 * `DataBreachPage` e **static, fără nicio cerere către server**, deliberat: se citește în clipa în
 * care ceva e stricat, iar un ecran care se încarcă de undeva are o stare în care nu arată nimic.
 * 🔴 Registrul are nevoie de server — deci stă **aici**, iar dacă cererea lui cade, pașii de deasupra
 * rămân pe ecran, întregi.
 *
 * ─── 🔴 CE ARATĂ ÎNTÂI ──────────────────────────────────────────────────────
 * Ceasul. ⚠️ Nu e o cifră de raport: e singura de pe ecran cu consecință legală, iar ea vine de la
 * SERVER (ceasul unui telefon poate fi greșit).
 *
 * ⛔ **Formularul cere DOUĂ lucruri** — ce s-a întâmplat și când s-a aflat. Restul se poate completa
 * mai târziu, iar ce lipsește e **spus**, nu impus: un formular care ar refuza în prima oră ar face
 * ca breșa să nu fie consemnată deloc (aceeași alegere ca la clasificarea reclamațiilor, ACHU-560).
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Loader2, ShieldCheck, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';
import {
  getDataBreaches, recordDataBreach, updateDataBreach,
  type BreachRecord, type BreachRegister,
} from '@/lib/dataBreachEndpoints';

/** ⚠️ Culoarea urmează CONSECINȚA, nu starea: „depășit" și „fără motiv scris" sunt amândouă roșu. */
const CLOCK_STYLE: Record<BreachRecord['clock']['state'], string> = {
  overdue: 'text-destructive font-semibold',
  'not-reported-no-reason': 'text-destructive font-semibold',
  due: 'text-amber-600 dark:text-amber-500 font-medium',
  reported: 'text-emerald-700 dark:text-emerald-400',
  'reported-late': 'text-amber-600 dark:text-amber-500',
  'not-reported': 'text-muted-foreground',
};

function fmtWhen(iso: string) {
  // ⚠️ Data ȘI ora: la un termen de 72 de ore, ziua singură nu spune destul.
  return new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' });
}

export default function DataBreachRegister() {
  const [data, setData] = useState<BreachRegister | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [form, setForm] = useState({
    discoveredAt: '', summary: '', dataTypes: '', peopleCount: '', containment: '',
  });

  const load = () => {
    getDataBreaches()
      .then(res => { setData(res); setFailed(false); })
      /**
       * 🔴 Eșecul se SPUNE. ⛔ Un registru care arată gol fiindcă cererea a picat e cel mai prost
       * răspuns posibil pe ecranul ăsta: cine se uită ar citi „nu s-a întâmplat niciodată nimic".
       */
      .catch(() => setFailed(true));
  };
  useEffect(load, []);

  const submit = async () => {
    if (!form.discoveredAt || !form.summary.trim()) {
      toast.error('Say what happened and when you found out — the 72 hours run from that moment.');
      return;
    }
    setSaving(true);
    try {
      await recordDataBreach({
        discoveredAt: new Date(form.discoveredAt).toISOString(),
        summary: form.summary.trim(),
        dataTypes: form.dataTypes.trim() || null,
        peopleCount: form.peopleCount === '' ? null : Number(form.peopleCount),
        containment: form.containment.trim() || null,
      });
      setForm({ discoveredAt: '', summary: '', dataTypes: '', peopleCount: '', containment: '' });
      setAdding(false);
      toast.success('Written down. Now the clock is visible to everyone here.');
      load();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not save that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id: string, body: Parameters<typeof updateDataBreach>[0]) => {
    setBusyRow(id);
    try {
      await updateDataBreach({ ...body, id });
      load();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not update that record.');
    } finally {
      setBusyRow(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">The register</h3>
          <p className="text-xs text-muted-foreground">
            {/* ⚠️ Propoziția spune de ce există rândul, nu doar ce e ecranul. */}
            Every breach goes in here — including the ones you decide not to report, with the reason.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(v => !v)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />Write one down
        </Button>
      </div>

      {failed && (
        <p className="text-sm text-destructive">
          We could not load the register. Reload before deciding anything — do not read this as
          “nothing has ever been recorded”.
        </p>
      )}

      {adding && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="breach-found">When did we find out?</Label>
                <Input
                  id="breach-found"
                  type="datetime-local"
                  value={form.discoveredAt}
                  onChange={e => setForm(f => ({ ...f, discoveredAt: e.target.value }))}
                />
                {/* 🔴 Art. 33: ceasul curge de când AFLĂM, nu de când s-a întâmplat. */}
                <p className="mt-1 text-xs text-muted-foreground">The 72 hours run from this moment.</p>
              </div>
              <div>
                <Label htmlFor="breach-people">How many people, if you know</Label>
                <Input
                  id="breach-people"
                  type="number"
                  min={0}
                  value={form.peopleCount}
                  onChange={e => setForm(f => ({ ...f, peopleCount: e.target.value }))}
                />
                <p className="mt-1 text-xs text-muted-foreground">Leave empty if you do not know yet.</p>
              </div>
            </div>
            <div>
              <Label htmlFor="breach-summary">What happened?</Label>
              <Textarea
                id="breach-summary"
                rows={3}
                value={form.summary}
                onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                placeholder="e.g. A rota with 12 customers' addresses was emailed to the wrong cleaner."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="breach-types">What kind of data</Label>
                <Input
                  id="breach-types"
                  value={form.dataTypes}
                  onChange={e => setForm(f => ({ ...f, dataTypes: e.target.value }))}
                  placeholder="addresses, phone numbers"
                />
              </div>
              <div>
                <Label htmlFor="breach-containment">What did you do to stop it?</Label>
                <Input
                  id="breach-containment"
                  value={form.containment}
                  onChange={e => setForm(f => ({ ...f, containment: e.target.value }))}
                  placeholder="asked them to delete it, confirmed they had"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAdding(false)} disabled={saving}>Cancel</Button>
              <Button onClick={submit} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save it
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {data === null && !failed && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />Loading the register…
        </p>
      )}

      {data && data.records.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {/* ⚠️ „Nimic încă" e o afirmație bună aici, și trebuie să se vadă că e MĂSURATĂ. */}
          Nothing recorded yet. That is the right state until something happens — and the moment it
          does, it goes here, not in a notebook.
        </p>
      )}

      {data && data.records.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {data.records.length} recorded · {data.openCount} still open
            {data.overdueCount > 0 && ` · ${data.overdueCount} past the 72 hours`}
            {data.withoutReasonCount > 0 && ` · ${data.withoutReasonCount} with no reason written`}
          </p>
          {data.records.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      #{r.breachId} · found {fmtWhen(r.discoveredAt)}
                      {r.status === 'Closed' && <span className="ml-2 text-xs text-muted-foreground">closed</span>}
                    </p>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap">{r.summary}</p>
                  </div>
                  {r.clock.state === 'reported' ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>

                {/* 🔴 Ceasul, cu propoziția serverului — nu una compusă aici. */}
                <p className={`text-xs ${CLOCK_STYLE[r.clock.state]}`}>{r.clock.label}</p>

                {(r.dataTypes || r.peopleCount != null || r.containment) && (
                  <p className="text-xs text-muted-foreground">
                    {r.dataTypes && <>What got out: {r.dataTypes}. </>}
                    {r.peopleCount != null && <>People affected: {r.peopleCount}. </>}
                    {r.containment && <>Done: {r.containment}.</>}
                  </p>
                )}

                {r.icoReference && (
                  <p className="text-xs text-muted-foreground">ICO reference: {r.icoReference}</p>
                )}
                {r.notReportedReason && (
                  <p className="text-xs text-muted-foreground">Not reported because: {r.notReportedReason}</p>
                )}

                {/*
                  ⚠️ Ce lipsește e SPUS, nu impus — un rând scris în prima oră e incomplet prin
                  natura lui, iar a-l refuza atunci ar fi însemnat să nu existe deloc.
                */}
                {r.missing.length > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-500 flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>Still missing: {r.missing.join(' · ')}</span>
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {!r.reportedToIco && (
                    <>
                      <Button
                        size="sm" variant="outline" className="text-xs h-7"
                        disabled={busyRow === r.id}
                        onClick={() => {
                          const reference = window.prompt('ICO reference number (from their confirmation):');
                          if (reference === null) return;
                          void patch(r.id, {
                            id: r.id, reportedToIco: true,
                            reportedAt: new Date().toISOString(), icoReference: reference.trim() || null,
                          });
                        }}
                      >
                        I told the ICO
                      </Button>
                      <Button
                        size="sm" variant="outline" className="text-xs h-7"
                        disabled={busyRow === r.id}
                        onClick={() => {
                          /* 🔴 Motivul se CERE aici: un „nu raportăm" fără el e chiar întrebarea ICO. */
                          const reason = window.prompt('Why are you not reporting this? The law requires the reason.');
                          if (reason === null) return;
                          void patch(r.id, { id: r.id, notReportedReason: reason.trim() });
                        }}
                      >
                        We are not reporting it
                      </Button>
                    </>
                  )}
                  {!r.peopleTold && (
                    <Button
                      size="sm" variant="outline" className="text-xs h-7"
                      disabled={busyRow === r.id}
                      onClick={() => void patch(r.id, {
                        id: r.id, peopleTold: true, peopleToldAt: new Date().toISOString(),
                      })}
                    >
                      Told the people affected
                    </Button>
                  )}
                  {r.status === 'Open' && (
                    <Button
                      size="sm" variant="outline" className="text-xs h-7"
                      disabled={busyRow === r.id}
                      onClick={() => void patch(r.id, { id: r.id, status: 'Closed' })}
                    >
                      Close this record
                    </Button>
                  )}
                  {busyRow === r.id && <Loader2 className="h-3.5 w-3.5 animate-spin self-center" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

