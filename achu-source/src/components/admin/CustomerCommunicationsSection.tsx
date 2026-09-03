/**
 * 🔴 §20 „Communication centre" (Sesiunea 152) — **CE S-A VORBIT CU OMUL ĂSTA.**
 *
 * ─── De ce există ───────────────────────────────────────────────────────────
 * Aplicația știe tot ce s-a întâmplat **în** ea. ⛔ Dar cea mai mare parte a relației cu un client de
 * curățenie se petrece la **telefon**, iar aceea nu era scrisă nicăieri. ⚠️ Consecința se vede la al
 * doilea telefon: cine sună a doua zi nu are de unde să știe **ce s-a promis** ieri, iar când clientul
 * spune *„mi-ați zis că vine joi"*, biroul nu are nimic de citit.
 *
 * ⛔ **Nu trimite nimic** — e un registru. Emailul și SMS-ul cer un furnizor și o hotărâre despre ce
 * scrie în ele.
 *
 * ─── ⚠️ Se încarcă la CERERE ───────────────────────────────────────────────
 * Ca galeria de dovezi a incidentelor și ca istoricul de audit: fișa unui client se deschide de zeci
 * de ori pe zi, iar o cerere de fiecare dată ar fi zeci de cereri pentru un panou pe care nimeni nu-l
 * deschide. ⛔ Un asemenea defect nu se vede în interfață — se vede în factura de la Supabase.
 */
import { useState } from 'react';
import { MessageSquare, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCustomerCommunications, logCustomerCommunication,
  type CommunicationRecord, type CommunicationOption, type ContactPreference,
} from '@/lib/endpoints';
import { errMsg } from '@/lib/errorMessage';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fmtDateTime } from '@/lib/format';

/** ⚠️ `datetime-local` cere „YYYY-MM-DDTHH:MM" în ora LOCALĂ, nu ISO cu Z. */
function localNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CustomerCommunicationsSection({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [records, setRecords] = useState<CommunicationRecord[] | null>(null);
  const [options, setOptions] = useState<{ channels: CommunicationOption[]; directions: CommunicationOption[] }>({ channels: [], directions: [] });
  const [listNote, setListNote] = useState<string | null>(null);
  /**
   * 🆕 §20 „Preferred channel" (Sesiunea 158) — cum vrea omul să fie contactat.
   *
   * 🔴 Preferința se putea **edita** pe fișă din Sesiunea 152, dar nu ajungea niciodată **acolo unde
   * e folosită**: cine notează un telefon nu deschide altă filă ca să afle că omul a cerut să fie
   * sunat după 18:00. ⚠️ Vine cu lista, în același răspuns.
   */
  const [preference, setPreference] = useState<ContactPreference | null>(null);
  const [adding, setAdding] = useState(false);
  const [channel, setChannel] = useState('phone');
  const [direction, setDirection] = useState('out');
  const [occurredAt, setOccurredAt] = useState(localNow);
  const [summary, setSummary] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      const res = await getCustomerCommunications({ customerId });
      setRecords(res.records);
      setOptions(res.options);
      setListNote(res.listNote ?? null);
      const pref = res.contactPreference ?? null;
      setPreference(pref);
      /**
       * ⚠️ **Formularul pornește din preferință, dar numai dacă ea SE POTRIVEȘTE unui canal** —
       * `suggestedChannel` e `null` când omul preferă mesajele din aplicație sau n-a spus nimic, iar
       * atunci rămâne `phone`, ca până acum. ⛔ Nu se inventează o potrivire.
       * 🔴 Și numai la ÎNCĂRCARE: dacă biroul a schimbat deja canalul, o reîncărcare n-are voie să-i
       * mute alegerea sub mână.
       */
      if (pref?.suggestedChannel && !adding) setChannel(pref.suggestedChannel);
    } catch (e) {
      toast.error(errMsg(e) || 'Could not load the conversations for this customer.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (records === null) await load();
  };

  const save = async () => {
    setBusy(true);
    try {
      await logCustomerCommunication({
        customerId, channel, direction,
        // ⚠️ Trimis ca ISO: serverul refuză o dată în viitor, iar ora locală s-ar citi greșit.
        occurredAt: new Date(occurredAt).toISOString(),
        summary,
      });
      setSummary('');
      setAdding(false);
      await load();
      toast.success('Conversation recorded.');
    } catch (e) {
      // Mesajul serverului AȘA CUM E: el spune ce lipsește sau de ce a fost refuzat.
      toast.error(errMsg(e) || 'Could not record it.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border px-3 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Conversations
          {records && <span className="font-normal">· {records.length}</span>}
        </p>
        <Button size="sm" variant="ghost" onClick={() => void toggle()} disabled={busy}>
          {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
          {open ? 'Hide' : 'Open'}
        </Button>
      </div>

      {open && (
        <div className="space-y-2">
          {/*
            ⚠️ Spune ce NU e lista, ca la hârtiile curățătorilor: cine o citește altfel presupune că
            aplicația a trimis mesajele astea. ⛔ Nu a trimis nimic — cineva a vorbit și a scris.
          */}
          <p className="text-[11px] text-muted-foreground">
            What was said on the phone, by letter or in person — written down by the office. Nothing here was
            sent by the app.
          </p>
          {listNote && <p className="text-[11px] text-muted-foreground">{listNote}</p>}

          {/*
            ─── 🆕 §20 „Preferred channel" (Sesiunea 158) ───────────────────────────────────
            🔴 **Preferința, ACOLO unde e folosită.** Se putea edita pe fișă din Sesiunea 152, dar
            cine notează un telefon nu deschide altă filă ca să afle că omul a cerut să fie sunat
            după 18:00 — iar atunci preferința e o casetă completată degeaba.
            ⚠️ Se arată și când NU se potrivește niciun canal din registru („prin aplicație"): e tot
            o informație despre om. ⛔ Nu apare nimic dacă n-a spus nimic — o linie „nicio preferință"
            pe fiecare fișă e zgomot pe toate ecranele ca să spună ceva pe unul.
          */}
          {preference && (preference.methodLabel || preference.windowLabel || preference.note) && (
            <p className="text-[11px] text-amber-800" data-testid="contact-preference">
              {preference.methodLabel && <>Prefers <strong>{preference.methodLabel}</strong></>}
              {preference.windowLabel && <>{preference.methodLabel ? ', ' : ''}{preference.windowLabel.toLowerCase()}</>}
              {preference.note ? ` — ${preference.note}` : ''}
            </p>
          )}

          {!adding && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Record a conversation
            </Button>
          )}

          {adding && (
            <div className="rounded-md border p-2 space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor="comm-channel" className="text-xs">How</Label>
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger id="comm-channel"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {options.channels.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="comm-direction" className="text-xs">Who started it</Label>
                  <Select value={direction} onValueChange={setDirection}>
                    <SelectTrigger id="comm-direction"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {options.directions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="comm-when" className="text-xs">When</Label>
                {/* ⚠️ Cu ORĂ: „a sunat la 8 dimineața" e altceva decât „a sunat seara". */}
                <input
                  id="comm-when"
                  type="datetime-local"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={occurredAt}
                  onChange={e => setOccurredAt(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="comm-summary" className="text-xs">What was said</Label>
                <Textarea id="comm-summary" rows={3} maxLength={4000} value={summary}
                  onChange={e => setSummary(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setAdding(false); setSummary(''); }} disabled={busy}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void save()} disabled={busy || !summary.trim()}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Record it'}
                </Button>
              </div>
            </div>
          )}

          {records?.length === 0 && (
            <p className="text-xs text-muted-foreground">Nothing recorded yet.</p>
          )}

          {records?.map(r => (
            <div key={r.id} className="border-l-2 pl-2 py-1 space-y-0.5">
              <p className="text-xs font-medium">
                {r.headline}
                <span className="font-normal text-muted-foreground"> · {fmtDateTime(r.occurredAt)}</span>
              </p>
              <p className="text-xs whitespace-pre-wrap">{r.summary}</p>
              <p className="text-[11px] text-muted-foreground">
                Written by {r.recordedBy}
                {r.jobLabel ? ` · about job ${r.jobLabel}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

