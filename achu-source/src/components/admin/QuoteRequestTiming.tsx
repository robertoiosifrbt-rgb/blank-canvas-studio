/**
 * 🔴 §6 „Urgency" + „Flexible date" (Sesiunea 159) — CÂND ÎI TREBUIE, pe ecranul biroului.
 *
 * ─── ⛔ DE CE ARE ȘI BUTOANE, NU DOAR DOUĂ RÂNDURI DE AFIȘAT ────────────────
 *
 * Cele două valori vin de pe formular, dar de multe ori se aud la **telefon**: „de fapt mi-ar
 * trebui săptămâna asta", „nu, data aceea e fixă, mă mut". ⚠️ Fără un loc unde biroul le scrie,
 * ruta ar accepta o corectură pe care nimic nu o poate face — adică o capabilitate de server pe care
 * niciun om nu o vede, chiar tiparul pe care jurnalul îl semnalează de la ACHU-433 încoace.
 *
 * ─── 🔴 CE NU FACE, DELIBERAT ───────────────────────────────────────────────
 *
 * ⛔ Nu sortează lista, nu colorează nimic în roșu, nu trimite niciun mesaj și nu promite niciun
 * termen de răspuns. ⚠️ „Urgent" e ce a spus **clientul**; ce răspundem și în cât timp e ce promitem
 * în scris, deci o hotărâre a owner-ului (`AGENT_RULES` §2).
 *
 * ─── ⚠️ „SE POATE MUTA DATA" APARE NUMAI CÂND EXISTĂ O DATĂ ─────────────────
 *
 * Serverul refuză steagul fără dată preferată (`backend/src/lib/quoteTimingPolicy.ts`), iar aici
 * ecranul spune de ce în loc să ofere un buton care ar fi refuzat.
 */
import { useState } from 'react';
import { Loader2, Clock, CalendarClock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';
import { saveQuoteRequest } from '@/lib/endpoints';
import { VALID_QUOTE_URGENCIES } from '@/lib/validation';

/**
 * ⛔ **Cuvinte, nu „true" / „false".** Un steag pe ecran se citește greșit exact în cazul care
 * contează: cineva care mută o vizită de la un sfârșit de contract de închiriere.
 */
const DATE_FLEXIBILITY_WORDS: Record<'yes' | 'no' | 'unsaid', string> = {
  yes: 'Other dates work too — they said the date can move.',
  no: 'That date is the only one that works for them.',
  unsaid: 'They did not say whether that date can move.',
};

type Props = {
  id: string;
  revision: string | undefined;
  urgency: string | null | undefined;
  dateFlexible: boolean | null | undefined;
  /** ⚠️ Fără dată preferată, steagul nu are înțeles — iar serverul îl refuză. */
  hasPreferredDate: boolean;
  /** ⚠️ Pagina ține rândul; noua amprentă se întoarce aici, altfel a doua salvare cade ca CONFLICT. */
  onSaved: (patch: {
    urgency?: string | null;
    dateFlexible?: boolean | null;
    _revision: string;
  }) => void;
};

export default function QuoteRequestTiming(props: Props) {
  const [busy, setBusy] = useState(false);

  const flexState: 'yes' | 'no' | 'unsaid' =
    props.dateFlexible === true ? 'yes' : props.dateFlexible === false ? 'no' : 'unsaid';

  const save = async (patch: { urgency?: string | null; dateFlexible?: boolean | null }) => {
    setBusy(true);
    try {
      const res = await saveQuoteRequest({ id: props.id, _revision: props.revision, ...patch });
      props.onSaved({ ...patch, _revision: res._revision });
    } catch (e) {
      /* ⚠️ Propoziția serverului, nu una generică: la CONFLICT ea spune să reîncarci. */
      toast.error(errMsg(e) || 'Could not save that. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">When they need it</h3>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        {/* 🔴 Spus o dată, ca nimeni să nu creadă că aplicația face ceva cu „urgent". */}
        <p className="text-xs text-muted-foreground">
          What the customer told us. Nothing happens automatically because of it — no reordering,
          no reply, no promised response time.
        </p>

        <div>
          <Label htmlFor="qr-urgency">How soon they need it</Label>
          <Select
            value={props.urgency ?? ''}
            disabled={busy}
            onValueChange={v => save({ urgency: v })}
          >
            <SelectTrigger id="qr-urgency">
              <SelectValue placeholder="They did not say" />
            </SelectTrigger>
            <SelectContent>
              {VALID_QUOTE_URGENCIES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* ⚠️ Se poate retrage: o alegere pusă din greșeală nu se repară altfel. */}
          {props.urgency && (
            <Button
              size="sm" variant="ghost" className="mt-1 text-xs h-7" disabled={busy}
              onClick={() => save({ urgency: null })}
            >
              Clear
            </Button>
          )}
        </div>

        <div className="border-t pt-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm">Their preferred date</Label>
          </div>
          {!props.hasPreferredDate ? (
            <p className="mt-1 text-xs text-muted-foreground">
              They gave no preferred date, so there is nothing that could move.
            </p>
          ) : (
            <>
              <p className={`mt-1 text-xs ${flexState === 'unsaid' ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'}`}>
                {DATE_FLEXIBILITY_WORDS[flexState]}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {flexState !== 'yes' && (
                  <Button size="sm" variant="outline" className="text-xs h-7" disabled={busy}
                    onClick={() => save({ dateFlexible: true })}>
                    The date can move
                  </Button>
                )}
                {flexState !== 'no' && (
                  <Button size="sm" variant="outline" className="text-xs h-7" disabled={busy}
                    onClick={() => save({ dateFlexible: false })}>
                    That date is fixed
                  </Button>
                )}
                {flexState !== 'unsaid' && (
                  <Button size="sm" variant="ghost" className="text-xs h-7" disabled={busy}
                    onClick={() => save({ dateFlexible: null })}>
                    They did not say
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

