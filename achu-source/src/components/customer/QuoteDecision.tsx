import { useState } from 'react';
import { respondToQuote } from '@/lib/endpoints';
import QuoteExtrasPicker, { type QuoteSplit } from './QuoteExtrasPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, X, Loader2, PencilLine } from 'lucide-react';
import { fmtDate } from '@/lib/format';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';

/**
 * ACHU-238 — the customer's yes or no on a quote.
 *
 * Rejecting asks for a reason; accepting does not. Deliberate asymmetry: a rejection is the
 * one case where the office can still save the job by knowing why, and it costs the customer
 * nothing to skip it. Making acceptance conditional on typing something would be friction
 * on the outcome you want.
 *
 * 🆕 Sesiunea 118 — AL TREILEA BUTON: „Request a change" (ultimul rând de Nivel 1 din
 * `docs/Backlog_Client_Prioritar.md`). Până acum un client care voia oferta, dar cu o
 * modificare, nu avea decât REFUZUL — un răspuns definitiv, care îl pune pe birou să-l sune
 * ca să afle ce n-a fost bine. Deci ecranul îl împingea să refuze ceea ce voia.
 *
 * ⛔ La modificare textul e OBLIGATORIU, la refuz nu: „schimbă ceva" fără să spui ce nu e o
 * cerere. Asimetria de mai sus rămâne, aceasta se adaugă.
 *
 * 🔴 Și e NETERMINALĂ: după ce biroul trimite oferta revizuită, butoanele revin. Vezi
 * `backend/src/lib/customerRequestPolicy.ts` pentru de ce, și ce ar fi stricat altfel.
 */
type Response = 'Accepted' | 'Rejected' | 'RevisionRequested';

/** Câmpurile pe care ecranul le randează, citite din ruta care le produce
 *  (`backend/src/lib/customerPortalAggregation.ts:327` pentru `customerResponse`,
 *  `backend/prisma/schema.prisma` model `PriceQuote` pentru celelalte). */
type PortalQuote = {
  /**
   * §6 (Sesiunea 160) — de la cât pornește și ce poate adăuga. ⚠️ Vine de la server, gata
   * împărțită. ⛔ **Opțional deliberat:** un pachet vechi, dinaintea coloanei, nu are voie să
   * strice ecranul de răspuns — aceeași regulă ca la listele noi din §22.
   */
  split?: QuoteSplit;
  /** Ce a bifat și la ce sumă a spus „da" — înghețate la răspuns, nu recalculate la citire. */
  acceptedExtras?: string[];
  acceptedTotal?: number | null;
  /**
   * §6 „Multiple quote options" (Sesiunea 160) — oferta e o VARIANTĂ dintr-un set.
   * ⚠️ `optionChosen` = numărul variantei deja luate din set, oricare ar fi ea. `null` = niciuna.
   */
  optionGroupId?: string | null;
  optionLabel?: string | null;
  optionChosen?: string | null;
  quoteNumber?: string;
  id: string;
  customerResponse?: string | null;
  customerRespondedAt?: string | null;
};

export default function QuoteDecision({ quote, onResponded }: { quote: PortalQuote; onResponded?: () => void }) {
  const [pending, setPending] = useState<Response | null>(null);
  /** Care formular de text e deschis, dacă vreunul. Cele două cer texte diferite. */
  const [asking, setAsking] = useState<'Rejected' | 'RevisionRequested' | null>(null);
  const [note, setNote] = useState('');
  /** §6 (Sesiunea 160) — extrele bifate. ⛔ Pleacă doar la acceptare; motivele: `QuoteExtrasPicker`. */
  const [extras, setExtras] = useState<string[]>([]);

  const send = async (response: Response) => {
    setPending(response);
    try {
      await respondToQuote({
        id: quote.id, response,
        ...(note.trim() ? { note: note.trim() } : {}),
        // Trimis doar daca a bifat ceva: serverul citeste lipsa ca „numai baza”.
        ...(response === 'Accepted' && extras.length ? { acceptedExtras: extras } : {}),
      });
      toast.success(
        response === 'Accepted' ? 'Thank you — we will be in touch to book it in.'
        : response === 'RevisionRequested' ? 'Thanks — we will look at it and send you an updated quote.'
        : 'Thanks for letting us know.',
      );
      setAsking(null);
      setNote('');
      onResponded?.();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not send your answer. Please try again.');
    } finally {
      setPending(null);
    }
  };

  /**
   * 🔴 `isTerminalQuoteResponse` în formă de UI, și rândul acesta spunea
   * `if (quote.customerResponse)` (Sesiunea 118). Cu al treilea răspuns, forma veche
   * ar fi ascuns butoanele **și** ar fi scris „You declined this quote" unui client care
   * ceruse o modificare — adică i-ar fi spus că a refuzat o ofertă pe care o voia.
   *
   * O cerere de modificare NU e un răspuns final: după ce biroul trimite oferta
   * revizuită, aceleași butoane trebuie să fie acolo. Deci se afișează starea **și**
   * se cade prin, la butoane.
   */
  /**
   * 🔴 §6 (Sesiunea 160) — ALTĂ VARIANTĂ DIN SET E DEJA LUATĂ.
   *
   * ⛔ Fără propoziția asta, celelalte variante ar fi rămas pe ecran cu butoanele lor, omul ar fi
   * crezut că mai poate alege, ar fi apăsat — și ar fi primit un refuz care se citește ca o
   * defecțiune. ⚠️ Serverul refuză oricum; ecranul face refuzul de prisos.
   */
  const altaLuata = !!quote.optionChosen && quote.optionChosen !== quote.quoteNumber;
  if (altaLuata && quote.customerResponse !== 'Accepted') {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        You chose {quote.optionChosen} instead. Contact ACHU if you would rather have this one.
      </p>
    );
  }

  const terminal = quote.customerResponse === 'Accepted' || quote.customerResponse === 'Rejected';
  /** Numele extrelor bifate, nu cheile lor: „oven" e o cheie de câmp, „Oven Cleaning" e ce a luat omul. */
  const acceptedLabels = (quote.acceptedExtras ?? [])
    .map(f => quote.split?.extras.find(e => e.field === f)?.label)
    .filter(Boolean).join(', ');
  if (terminal) {
    return (
      <p className={`mt-2 text-xs font-medium ${quote.customerResponse === 'Accepted' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
        {quote.customerResponse === 'Accepted' ? 'You accepted this quote' : 'You declined this quote'}
        {quote.customerRespondedAt ? ` on ${fmtDate(quote.customerRespondedAt)}` : ''}
        {/*
          🔴 §6 (Sesiunea 160) — SUMA LA CARE A SPUS „DA", și ce a luat. ⛔ E cea înghețată atunci,
          nu una recalculată acum: o corectură a ofertei de a doua zi n-are voie să schimbe
          retroactiv ce i se arată omului că a acceptat.
        */}
        {quote.customerResponse === 'Accepted' && quote.acceptedTotal != null && (
          <> — £{quote.acceptedTotal.toFixed(2)}{acceptedLabels ? `, including ${acceptedLabels}` : ''}</>
        )}
      </p>
    );
  }

  if (asking) {
    const revision = asking === 'RevisionRequested';
    return (
      <div className="mt-2 space-y-2">
        <Label htmlFor="quotedecis-note" className="text-xs">
          {revision
            ? <>What would you like changed?</>
            : <>Anything you would like us to know? <span className="text-muted-foreground font-normal">(optional)</span></>}
        </Label>
        <Input
          id="quotedecis-note"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={revision ? 'e.g. only the kitchen and bathroom, and fortnightly instead' : 'e.g. more than we budgeted for'}
          maxLength={2000}
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => { setAsking(null); setNote(''); }} disabled={!!pending}>
            Back
          </Button>
          {/* ⛔ Textul e OBLIGATORIU la o cerere de modificare — „schimbă ceva" nu e o cerere.
              Serverul o impune oricum (`customerPortal.ts`), butonul o face doar vizibilă. */}
          <Button size="sm" className="flex-1 text-xs" onClick={() => send(asking)} disabled={!!pending || (revision && !note.trim())}>
            {pending === asking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {quote.customerResponse === 'RevisionRequested' && (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
          You asked us for changes{quote.customerRespondedAt ? ` on ${fmtDate(quote.customerRespondedAt)}` : ''} — we will send you an updated quote.
        </p>
      )}
      <QuoteExtrasPicker
        split={quote.split} chosen={extras} onChange={setExtras} disabled={!!pending}
      />
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 text-xs" onClick={() => send('Accepted')} disabled={!!pending}>
          {pending === 'Accepted' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Accept quote</>}
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setAsking('RevisionRequested')} disabled={!!pending}>
          <PencilLine className="h-3.5 w-3.5 mr-1" />Request a change
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setAsking('Rejected')} disabled={!!pending}>
          <X className="h-3.5 w-3.5 mr-1" />Decline
        </Button>
      </div>
    </div>
  );
}

