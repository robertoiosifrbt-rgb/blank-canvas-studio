/**
 * 🔴 §45 „Third-party sharing record" (Sesiunea 158) — CINE PRIMEȘTE DATELE, PE ECRAN.
 *
 * ─── ⛔ DE CE EXISTĂ ────────────────────────────────────────────────────────
 * UK GDPR art. 30(1)(d) cere firmei să poată spune **cui** îi pleacă datele personale, iar art. 28
 * cere un contract scris cu oricine le prelucrează în numele ei. ⛔ Întrebarea „cui i-am dat datele
 * astea?" nu avea până azi niciun răspuns în aplicație — deci răspunsul era în capul cuiva.
 *
 * ─── 🔴 ECRANUL PLEACĂ GOL, ȘI SPUNE DE CE ─────────────────────────────────
 * ⛔ Nu e preumplut cu furnizorii pe care i-aș putea ghici din cod (bază, găzduire, intrare cu
 * Google). 🔴 O listă de destinatari e o **afirmație despre firmă**, iar afirmația o face un owner —
 * una scrisă de mine ar fi arătat la fel de sigură și ar fi putut fi greșită exact în ziua în care
 * cineva o citește ca să răspundă unei întrebări de la ICO.
 *
 * ─── ⚠️ SE CER DOUĂ LUCRURI, RESTUL SE SPUNE ───────────────────────────────
 * **Cine** și **ce**. 🔴 Restul (temeiul, contractul, transferul în afara UK) apare ca lipsă, nu ca
 * refuz: un rând notat în graba în care biroul trimite o listă contabilului ar fi rămas nescris.
 * 📜 Aceeași alegere ca la registrul breșelor și ca la clasificarea reclamațiilor (ACHU-560).
 *
 * ⚠️ **Cele două stări și lipsurile vin de la SERVER** — ecranul nu le compune, ca un export de
 * mâine să nu spună altceva despre același rând.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, Globe, Loader2, Plus, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';
import {
  getDataSharing, recordDataSharing, updateDataSharing,
  type SharingRecord, type SharingRegister,
} from '@/lib/thirdPartySharingEndpoints';

/** ⚠️ Culoarea urmează CONSECINȚA: „fără motiv scris" e roșu, „nu s-a răspuns" e doar chihlimbar. */
const CONTRACT_STYLE: Record<SharingRecord['contract']['state'], string> = {
  'none-no-reason': 'text-destructive font-semibold',
  unanswered: 'text-amber-600 dark:text-amber-500',
  'in-writing-no-reference': 'text-amber-600 dark:text-amber-500',
  'in-writing': 'text-emerald-700 dark:text-emerald-400',
  'none-with-reason': 'text-muted-foreground',
};

const TRANSFER_STYLE: Record<SharingRecord['transfer']['state'], string> = {
  'outside-uncovered': 'text-destructive font-semibold',
  unanswered: 'text-amber-600 dark:text-amber-500',
  'outside-covered': 'text-muted-foreground',
  uk: 'text-muted-foreground',
};

export default function DataSharingRegister() {
  const [data, setData] = useState<SharingRegister | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [form, setForm] = useState({
    recipient: '', dataShared: '', purpose: '', legalBasis: '', startedOn: '',
  });

  const load = () => {
    getDataSharing()
      .then(res => { setData(res); setFailed(false); })
      /**
       * 🔴 Eșecul se SPUNE. ⛔ Un registru care arată gol fiindcă cererea a picat e cel mai prost
       * răspuns posibil aici: cine se uită ar citi „nu dăm datele nimănui".
       */
      .catch(() => setFailed(true));
  };
  useEffect(load, []);

  const submit = async () => {
    if (!form.recipient.trim() || !form.dataShared.trim()) {
      toast.error('Say who receives the data and what they receive. The rest can wait.');
      return;
    }
    setSaving(true);
    try {
      await recordDataSharing({
        recipient: form.recipient.trim(),
        dataShared: form.dataShared.trim(),
        purpose: form.purpose.trim() || null,
        legalBasis: form.legalBasis.trim() || null,
        startedOn: form.startedOn || null,
      });
      setForm({ recipient: '', dataShared: '', purpose: '', legalBasis: '', startedOn: '' });
      setAdding(false);
      toast.success('Written down. Anything still missing is listed on the row.');
      load();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not save that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id: string, body: Parameters<typeof updateDataSharing>[0]) => {
    setBusyRow(id);
    try {
      await updateDataSharing({ ...body, id });
      load();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not update that record.');
    } finally {
      setBusyRow(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold">Who we share data with</h2>
        <p className="text-sm text-muted-foreground">
          Everyone outside the company who receives customer or staff data — the accountant, an
          insurer, HMRC, a supplier. The law expects you to be able to answer this from a record,
          not from memory.
        </p>
      </div>

      {/* 🔴 Spus o dată, sus: altfel un ecran gol se citește ca „nu dăm datele nimănui". */}
      <Card className="border-amber-400">
        <CardContent className="p-5 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm">
            <strong>Nothing was filled in for you.</strong> Who ACHU shares data with is a statement
            about the company, so it has to be written by one of you — not guessed by the app. An
            empty list here means nobody has written it down yet, not that nothing leaves.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">The record</h3>
          <p className="text-xs text-muted-foreground">
            Two things are needed to start a row: who they are and what they get.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(v => !v)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />Add someone
        </Button>
      </div>

      {failed && (
        <p className="text-sm text-destructive">
          We could not load the record. Reload before deciding anything — do not read this as
          “we do not share data with anybody”.
        </p>
      )}

      {adding && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="sharing-recipient">Who receives the data?</Label>
                <Input
                  id="sharing-recipient"
                  value={form.recipient}
                  onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))}
                  placeholder="our accountant, HMRC, the insurer"
                />
              </div>
              <div>
                <Label htmlFor="sharing-started">Since when, if you know</Label>
                <Input
                  id="sharing-started"
                  type="date"
                  value={form.startedOn}
                  onChange={e => setForm(f => ({ ...f, startedOn: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="sharing-data">What do they get?</Label>
              <Textarea
                id="sharing-data"
                rows={2}
                value={form.dataShared}
                onChange={e => setForm(f => ({ ...f, dataShared: e.target.value }))}
                placeholder="e.g. Staff names, NI numbers and pay figures, every month."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="sharing-purpose">Why do they get it?</Label>
                <Input
                  id="sharing-purpose"
                  value={form.purpose}
                  onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                  placeholder="to file our payroll"
                />
              </div>
              <div>
                <Label htmlFor="sharing-basis">On what lawful basis?</Label>
                <Input
                  id="sharing-basis"
                  value={form.legalBasis}
                  onChange={e => setForm(f => ({ ...f, legalBasis: e.target.value }))}
                  placeholder="legal obligation"
                />
                {/* ⛔ Text liber, nu o listă: temeiul e o judecată, nu o opțiune de meniu. */}
                <p className="mt-1 text-xs text-muted-foreground">In your own words. Leave it empty if you are not sure yet.</p>
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
          <Loader2 className="h-3 w-3 animate-spin" />Loading the record…
        </p>
      )}

      {data && data.records.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing written down yet. Start with the ones you already know: whoever does the books,
          whoever insures the work, and HMRC.
        </p>
      )}

      {data && data.records.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {data.records.length} recorded · {data.activeCount} still active
            {data.withoutContractCount > 0 && ` · ${data.withoutContractCount} with no contract and no reason`}
            {data.uncoveredTransferCount > 0 && ` · ${data.uncoveredTransferCount} leaving the UK uncovered`}
            {data.unansweredCount > 0 && ` · ${data.unansweredCount} still unanswered`}
          </p>
          {data.records.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      #{r.sharingId} · {r.recipient}
                      {r.status === 'Ended' && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          stopped{r.endedOn ? ` ${r.endedOn}` : ''}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap">{r.dataShared}</p>
                  </div>
                  {r.contract.state === 'in-writing' ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>

                {(r.purpose || r.legalBasis || r.startedOn) && (
                  <p className="text-xs text-muted-foreground">
                    {r.purpose && <>Why: {r.purpose}. </>}
                    {r.legalBasis && <>Basis: {r.legalBasis}. </>}
                    {r.startedOn && <>Since {r.startedOn}.</>}
                  </p>
                )}

                {/* 🔴 Propozițiile serverului — nu unele compuse aici. */}
                <p className={`text-xs ${CONTRACT_STYLE[r.contract.state]}`}>{r.contract.label}</p>
                <p className={`text-xs ${TRANSFER_STYLE[r.transfer.state]}`}>{r.transfer.label}</p>

                {r.agreementReference && (
                  <p className="text-xs text-muted-foreground">Contract kept: {r.agreementReference}</p>
                )}
                {r.noAgreementReason && (
                  <p className="text-xs text-muted-foreground">No contract because: {r.noAgreementReason}</p>
                )}
                {r.transferSafeguard && (
                  <p className="text-xs text-muted-foreground">Transfer covered by: {r.transferSafeguard}</p>
                )}

                {/*
                  ⚠️ Ce lipsește e SPUS, nu impus — un rând scris în graba unei zile e incomplet prin
                  natura lui, iar a-l refuza atunci ar fi însemnat să nu existe deloc.
                */}
                {r.missing.length > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-500 flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>Still missing: {r.missing.join(' · ')}</span>
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {r.hasWrittenAgreement !== true && (
                    <Button
                      size="sm" variant="outline" className="text-xs h-7"
                      disabled={busyRow === r.id}
                      onClick={() => {
                        const reference = window.prompt('Where is that contract kept?');
                        if (reference === null) return;
                        void patch(r.id, {
                          id: r.id, hasWrittenAgreement: true,
                          agreementReference: reference.trim() || null, noAgreementReason: null,
                        });
                      }}
                    >
                      There is a written contract
                    </Button>
                  )}
                  {r.hasWrittenAgreement !== false && (
                    <Button
                      size="sm" variant="outline" className="text-xs h-7"
                      disabled={busyRow === r.id}
                      onClick={() => {
                        /* 🔴 Motivul se CERE: „fără contract" e corect pentru HMRC, nu pentru un furnizor. */
                        const reason = window.prompt(
                          'Why is no written contract needed? (e.g. they are not processing the data on our behalf)',
                        );
                        if (reason === null) return;
                        void patch(r.id, { id: r.id, hasWrittenAgreement: false, noAgreementReason: reason.trim() });
                      }}
                    >
                      No contract needed
                    </Button>
                  )}
                  {r.leavesUk === null && (
                    <>
                      <Button
                        size="sm" variant="outline" className="text-xs h-7"
                        disabled={busyRow === r.id}
                        onClick={() => void patch(r.id, { id: r.id, leavesUk: false })}
                      >
                        Stays in the UK
                      </Button>
                      <Button
                        size="sm" variant="outline" className="text-xs h-7"
                        disabled={busyRow === r.id}
                        onClick={() => {
                          const safeguard = window.prompt('What covers the transfer out of the UK?');
                          if (safeguard === null) return;
                          void patch(r.id, {
                            id: r.id, leavesUk: true, transferSafeguard: safeguard.trim() || null,
                          });
                        }}
                      >
                        Leaves the UK
                      </Button>
                    </>
                  )}
                  {r.status === 'Active' && (
                    <Button
                      size="sm" variant="outline" className="text-xs h-7"
                      disabled={busyRow === r.id}
                      onClick={() => void patch(r.id, {
                        id: r.id, status: 'Ended', endedOn: new Date().toISOString().slice(0, 10),
                      })}
                    >
                      We stopped sharing
                    </Button>
                  )}
                  {busyRow === r.id && <Loader2 className="h-3.5 w-3.5 animate-spin self-center" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

