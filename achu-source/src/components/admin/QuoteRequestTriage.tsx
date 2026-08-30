/**
 * 🔴 §6 „Internal assessment" + „Site visit required" (Sesiunea 158) — CE CREDE BIROUL.
 *
 * ─── ⛔ DE CE EXISTĂ ────────────────────────────────────────────────────────
 * O cerere de ofertă purta numai cuvintele **clientului**. Ce crede biroul despre ea — „casa e mai
 * mare decât spune", „nu se poate da preț fără s-o vedem" — se spunea pe chat și se pierdea, iar
 * întrebarea revenea la următorul om care deschidea cererea.
 *
 * ─── ⚠️ FIȘIER PROPRIU, ȘI NU DIN ESTETICĂ ────────────────────────────────
 * `QuoteRequestPage` are **585 de rânduri**, deci e peste plafonul de 500 (`AGENT_RULES` §7):
 * o capabilitate nouă scrisă acolo ar fi cerut o extragere în aceeași felie. 📜 Regula §9 spune
 * oricum același lucru — o capabilitate nouă intră în fișierul ei, iar pagina doar o conectează.
 *
 * ─── 🔴 TREI STĂRI LA VIZITA PE TEREN, NU DOUĂ ─────────────────────────────
 * `null` = nu s-a hotărât · `true` = trebuie văzută · `false` = s-a hotărât că **nu** e nevoie.
 * ⛔ Un simplu comutator ar fi făcut ca o cerere neatinsă să arate identic cu una despre care s-a
 * hotărât ceva — aceeași alegere ca la registrul destinatarilor, din felia de dinainte.
 *
 * ⚠️ **Nu ajunge la client.** Nici exportul lui de date, nici portalul nu trimit câmpul; iar la o
 * cerere de ștergere se golește, ca `Job.adminNotes` (hotărârea lui Roberto, 22/08, ACHU-761).
 */
import { useState } from 'react';
import { Loader2, ClipboardCheck, Home, HelpCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';
import { saveQuoteRequest } from '@/lib/endpoints';

type Props = {
  id: string;
  revision: string | undefined;
  internalAssessment: string | null | undefined;
  siteVisitRequired: boolean | null | undefined;
  /** §6 „More information required" (Sesiunea 160) — întrebarea scrisă pentru client. */
  infoNeededNote: string | null | undefined;
  /** ⚠️ Pagina ține rândul; noua amprentă se întoarce aici, altfel a doua salvare cade ca CONFLICT. */
  onSaved: (patch: {
    internalAssessment?: string | null;
    siteVisitRequired?: boolean | null;
    infoNeededNote?: string | null;
    _revision: string;
  }) => void;
};

/**
 * ⚠️ **Cuvântul „visit" NU se folosește** — cuvântul aplicației e „job" (Roberto, 25/08/2026), iar
 * `terminology.test.ts` citește sursa. 🔴 Aici nici nu ar fi fost corect: ce se hotărăște e dacă
 * merge cineva **să se uite la casă înainte de a da preț**, ceea ce nu e nici job, nici vizită de
 * curățenie. ⛔ Deci nu o excepție în listă, ci cuvintele potrivite.
 */
const LOOK_LABEL: Record<'yes' | 'no' | 'unset', string> = {
  yes: 'Someone has to see the property before we price it.',
  no: 'Decided: we can price it from what they sent — no need to go and look.',
  unset: 'Nobody has decided yet whether someone should go and look first.',
};

export default function QuoteRequestTriage(props: Props) {
  const [text, setText] = useState(props.internalAssessment ?? '');
  const [saving, setSaving] = useState(false);
  const [busyLook, setBusyLook] = useState(false);
  const [ask, setAsk] = useState(props.infoNeededNote ?? '');
  const [savingAsk, setSavingAsk] = useState(false);
  const askDirty = (props.infoNeededNote ?? '') !== ask;

  const lookState: 'yes' | 'no' | 'unset' =
    props.siteVisitRequired === true ? 'yes' : props.siteVisitRequired === false ? 'no' : 'unset';

  const dirty = (props.internalAssessment ?? '') !== text;

  const save = async (patch: { internalAssessment?: string | null; siteVisitRequired?: boolean | null; infoNeededNote?: string | null }) => {
    try {
      const res = await saveQuoteRequest({ id: props.id, _revision: props.revision, ...patch });
      props.onSaved({ ...patch, _revision: res._revision });
      return true;
    } catch (e) {
      /* ⚠️ Propoziția serverului, nu una generică: la CONFLICT ea spune să reîncarci. */
      toast.error(errMsg(e) || 'Could not save that. Please try again.');
      return false;
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">What the office thinks</h3>
        </div>
        {/* 🔴 Spus o dată: altfel cineva scrie aici crezând că răspunde clientului. */}
        <p className="text-xs text-muted-foreground">
          Internal only. The customer never sees this — not in the portal, not in their data
          download. It is erased if they ask us to erase their data.
        </p>

        <div>
          <Label htmlFor="qr-assessment">Our assessment</Label>
          <Textarea
            id="qr-assessment"
            rows={3}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="e.g. Photos show a much bigger kitchen than the form says — price for 4 hours, not 2."
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              disabled={!dirty || saving}
              onClick={async () => {
                setSaving(true);
                const ok = await save({ internalAssessment: text.trim() || null });
                if (ok) toast.success('Saved. The next person to open this sees it.');
                setSaving(false);
              }}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save assessment
            </Button>
          </div>
        </div>

        {/*
          🔴 §6 „More information required" (Sesiunea 160) — SUB evaluarea internă, și de asta
          despărțite printr-o linie: una NU iese niciodată din birou, cealaltă e scrisă ca s-o
          citească clientul. ⛔ Lipite, prima greșeală ar fi fost trimiterea părerii biroului către
          om.
        */}
        <div className="border-t pt-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="qr-info-needed" className="text-sm">What we still need from them</Label>
          </div>
          <p className="text-xs text-muted-foreground mt-1 mb-2">
            Write it the way you would say it to them. The enquiry stays where it is — this is not
            a rejection.
          </p>
          <Textarea
            id="qr-info-needed"
            rows={2}
            value={ask}
            onChange={e => setAsk(e.target.value)}
            placeholder="e.g. A photo of the oven, and how many bedrooms are being cleaned."
          />
          {/*
            🔴 **Propoziția care ține felia cinstită.** Aplicația nu are niciun expeditor de email
            sau SMS (`ACHU-805`), deci fără ea biroul ar scrie întrebarea și ar aștepta un răspuns
            care n-avea cum să vină. ⚠️ Spune și unde reapare, altfel nota s-ar pierde în fișă.
          */}
          <p className="text-xs text-muted-foreground mt-2">
            <strong>Nobody is told automatically</strong> — the app cannot send email or texts yet.
            Ring or message them yourself. The enquiry then sits in the Action Centre, under
            “Enquiries Missing Details”, until you clear this box.
          </p>
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={!askDirty || savingAsk}
              onClick={async () => {
                setSavingAsk(true);
                const ok = await save({ infoNeededNote: ask.trim() || null });
                if (ok) toast.success(ask.trim() ? 'Saved. Now ring them.' : 'Cleared.');
                setSavingAsk(false);
              }}
            >
              {savingAsk && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {ask.trim() ? 'Save what we need' : 'Clear'}
            </Button>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm">Seeing the property</Label>
          </div>
          <p className={`mt-1 text-xs ${lookState === 'unset' ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'}`}>
            {LOOK_LABEL[lookState]}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {lookState !== 'yes' && (
              <Button
                size="sm" variant="outline" className="text-xs h-7" disabled={busyLook}
                onClick={async () => { setBusyLook(true); await save({ siteVisitRequired: true }); setBusyLook(false); }}
              >
                Go and look first
              </Button>
            )}
            {lookState !== 'no' && (
              <Button
                size="sm" variant="outline" className="text-xs h-7" disabled={busyLook}
                onClick={async () => { setBusyLook(true); await save({ siteVisitRequired: false }); setBusyLook(false); }}
              >
                No need to go
              </Button>
            )}
            {/* ⚠️ Se poate reveni la „nu s-a hotărât" — o hotărâre pusă din greșeală nu se repară altfel. */}
            {lookState !== 'unset' && (
              <Button
                size="sm" variant="ghost" className="text-xs h-7" disabled={busyLook}
                onClick={async () => { setBusyLook(true); await save({ siteVisitRequired: null }); setBusyLook(false); }}
              >
                Undecide
              </Button>
            )}
            {busyLook && <Loader2 className="h-3.5 w-3.5 animate-spin self-center" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

