/**
 * Sesiunea 42 (ACHU-238) — the customer's side of asking the office for something.
 *
 * Two pieces: a dialog that raises a request, and a list that shows what happened to the
 * ones already raised. The list matters as much as the dialog. A customer who asks to move
 * a visit and then sees nothing has no way to tell whether ACHU is thinking about it or
 * never received it — and unlike a colleague, they cannot walk over and ask. So a request
 * stays visible after it is answered, with the office's actual words.
 *
 * The wording throughout is "request", never "cancel". That is not politeness: nothing here
 * changes a visit. The office decides, because no notice-period or cancellation-charge
 * policy exists yet (see backend/src/lib/customerRequestPolicy.ts). A button labelled
 * "Cancel visit" that only files a request would be a lie the customer acts on.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import DateField from '@/components/shared/DateField';
import TimeField from '@/components/shared/TimeField';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CalendarClock, XCircle, MessageSquareWarning, CheckCircle2, PauseCircle, UserCog, UserX, Sparkles, BanknoteArrowDown } from 'lucide-react';
import { submitCustomerRequest } from '@/lib/endpoints';
import { toast } from 'sonner';
import { fmtDate } from '@/lib/format';
import { errMsg } from '@/lib/errorMessage';
import type { PortalRequest } from './portalTypes';
// §32 (Sesiunea 148) — dovada unei reclamații, cu starea ei, într-un fișier propriu.
import { ComplaintEvidence } from './ComplaintPhotos';
import { useMyComplaintPhotos } from '@/lib/useMyComplaintPhotos';

export type RequestKind = 'Reschedule' | 'Cancellation' | 'Problem' | 'PauseSeries' | 'CancelSeries' | 'ProfileCorrection' | 'AccountClosure' | 'Reclean' | 'RefundRequest' | 'ServiceExtra';

const KIND_COPY: Record<RequestKind, { title: string; description: string; placeholder: string; cta: string }> = {
  Reschedule: {
    title: 'Request a different date',
    description: 'Tell us when would suit you better. We will confirm before anything changes.',
    placeholder: 'e.g. Any morning the following week would work better for us.',
    cta: 'Send request',
  },
  Cancellation: {
    title: 'Request to cancel this job',
    description: 'We will get back to you to confirm. The job stays booked until we do.',
    placeholder: 'e.g. We will be away that week.',
    cta: 'Send request',
  },
  Problem: {
    title: 'Report a problem',
    description: 'Tell us what went wrong and we will look into it.',
    placeholder: 'e.g. The kitchen floor was still sticky after the last clean.',
    cta: 'Send report',
  },
  PauseSeries: {
    title: 'Request to pause this contract',
    description: 'We will get back to you to confirm. Jobs already booked stay as they are until we do.',
    placeholder: 'e.g. We will be away for a month starting next week.',
    cta: 'Send request',
  },
  CancelSeries: {
    title: 'Request to cancel this contract',
    description: 'We will get back to you to confirm. Nothing changes until we do.',
    placeholder: 'e.g. We no longer need the regular clean, please stop it after the next job.',
    cta: 'Send request',
  },
  ProfileCorrection: {
    title: 'Request a name or email correction',
    description: "Your name and email can't be changed here — tell us what they should be and we will update them.",
    placeholder: 'e.g. My name should read "Archana Ramachandra Reddy", not my email address.',
    cta: 'Send request',
  },
  /**
   * ACHU-529 (Sesiunea 118). Decizia Archanei: *„se sterge tot ramane doar ce ne trebuie
   * legal… daca reface cont pierde tot istoricul"*.
   *
   * 🔴 TEXTUL E PARTEA CARE CONTEAZĂ AICI, nu butonul. Trei lucruri trebuie spuse ÎNAINTE,
   * fiindcă acțiunea e ireversibilă și fiecare dintre ele surprinde pe cineva:
   *  1. **ce se șterge** — datele personale;
   *  2. **ce NU se șterge, și de ce** — facturile și plățile rămân, fiindcă legea le cere
   *     păstrate; un client care citește „se șterge tot" și apoi află că firma îi mai are
   *     facturile ar avea dreptate să se simtă înșelat;
   *  3. **că istoricul nu se recuperează** dacă revine — nu ca pedeapsă, ci fiindcă
   *     legătura dintre login și fișă se rupe (ACHU-170).
   *
   * ⛔ Și spune explicit că e o CERERE, nu o ștergere pe loc — altfel clientul crede că
   * s-a întâmplat deja și pleacă.
   */
  /**
   * ACHU-532 (Sesiunea 118, Nivel 2). Clientul cere **refacerea** unei curățenii.
   *
   * ⛔ Textul spune explicit că biroul confirmă, fiindcă **nu există o politică de
   * re-curățare gratuită** — nici de termen, nici de cost. O formulare de tip „vom reveni
   * și o refacem" ar inventa una din greșeală, exact ce evită restul fișierului la anulări.
   */
  Reclean: {
    title: 'Ask us to re-clean',
    description: 'Tell us what was not right and we will look into it. We will come back to you to agree what happens next.',
    placeholder: 'e.g. The bathroom floor and the kitchen sink were still dirty.',
    cta: 'Send request',
  },
  /**
   * ACHU-533 (Sesiunea 118). Archana: *„Request refound sa poate sa ceara"*.
   *
   * 🔴 **TEXTUL E TOT CE ȚINE FELIA ONESTĂ.** Nu există nicio politică de rambursare —
   * `customerRequestPolicy.ts` o spune explicit — deci fiecare cuvânt care ar suna ca o
   * promisiune („vei primi banii înapoi", „îți rambursăm") ar inventa politica lipsă din
   * greșeală, iar biroul ar trebui apoi să refuze o așteptare pe care aplicația a creat-o.
   *
   * ⛔ Deci: „we will look into it", „come back to you", și **explicit** că nu e automat.
   */
  RefundRequest: {
    title: 'Ask for a refund',
    description: 'Tell us what you are asking to be refunded and why. We will look into it and come back to you — this is not an automatic refund.',
    placeholder: 'e.g. We paid for this job but nobody came.',
    cta: 'Send request',
  },
  /**
   * ACHU-556 (Sesiunea 122, Nivel 2). Clientul cere ceva IN PLUS la o vizita programata.
   *
   * 🔴 **Textul nu cere si nu promite un pret, si aceea e regula, nu o omisiune.** Decizia
   * Archanei din 11/08/2026: *„Preturile sunt subiect de modificare… clientul nu trebuie sa
   * vada asta."* Deci nu exista camp de suma, iar descrierea spune ca biroul confirma **si
   * costul** inainte sa se intample ceva — altfel clientul presupune ca e inclus, iar suma
   * mai mare o descopera pe factura.
   */
  ServiceExtra: {
    title: 'Ask for extra work at this job',
    description: 'Tell us what else you would like done. We will confirm whether we can fit it in and what it would cost before anything is added.',
    placeholder: 'e.g. Could you also clean the oven and the inside of the windows this time?',
    cta: 'Send request',
  },
  AccountClosure: {
    title: 'Request to close your account',
    description: 'We will remove your personal details. Your invoices and payments have to be kept — the law requires it — but they will no longer be linked to a login. This cannot be undone, and if you come back later you will start with a fresh account and no history. Tell us below and we will confirm once it is done.',
    placeholder: 'e.g. We have moved away and no longer need cleaning.',
    cta: 'Send closure request',
  },
};

export function CustomerRequestDialog({ open, kind, jobId, jobLabel, recurringSeriesId, seriesLabel, responsePromise, onClose, onSubmitted }: {
  open: boolean;
  kind: RequestKind;
  jobId?: string;
  jobLabel?: string;
  recurringSeriesId?: string;
  seriesLabel?: string;
  /**
   * ACHU-563 — „We aim to reply within 2 working days.", **primită de la server**.
   *
   * ⛔ **Nu se scrie aici și nu are valoare implicită.** O valoare implicită ar supraviețui
   * unei schimbări a numărului și ar arăta clientului o promisiune pe care firma nu o mai
   * face — iar el e singurul din sistem care nu poate întreba pe nimeni care e cea adevărată.
   * Absentă (portal vechi, server mai vechi) → nu se afișează nimic, ceea ce e onest.
   *
   * ⚠️ Doar la o reclamație. Celelalte feluri de cerere n-au termen promis.
   */
  responsePromise?: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [message, setMessage] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const copy = KIND_COPY[kind];
  const wantsSlot = kind === 'Reschedule';

  const reset = () => { setMessage(''); setPreferredDate(''); setPreferredTime(''); setError(''); };

  const handleSend = async () => {
    if (!message.trim()) { setError('Please tell us a little about what you need.'); return; }
    setSaving(true);
    setError('');
    try {
      await submitCustomerRequest({
        kind,
        ...(jobId ? { jobId } : {}),
        ...(recurringSeriesId ? { recurringSeriesId } : {}),
        message: message.trim(),
        // Only sent for a reschedule: the backend rejects a preferred slot on other kinds
        // rather than storing something no screen reads.
        ...(wantsSlot && preferredDate ? { preferredDate } : {}),
        ...(wantsSlot && preferredTime ? { preferredTime } : {}),
      });
      toast.success('Sent — we will come back to you.');
      reset();
      onSubmitted();
      onClose();
    } catch (e) {
      // The backend's messages are written for the customer (including the "you already
      // have an open request" case), so they are shown as-is rather than replaced with a
      // generic failure.
      setError(errMsg(e) || 'Could not send that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {copy.description}
            {/*
              ACHU-563 — promisiunea de răspuns, lângă textul care o cere.

              🔴 **Aici, nu pe ecranul de confirmare de după trimitere**: e informația care îl
              face pe om să aștepte în loc să sune a doua zi, deci trebuie citită ÎNAINTE de a
              apăsa. Lecția ACHU-561, prinsă de teste: un mesaj afișat pe un ecran care se
              înlocuiește în aceeași clipă nu e citit de nimeni.

              ⛔ Doar la o reclamație, și doar dacă serverul a trimis-o.
              */}
            {kind === 'Problem' && responsePromise && (
              <span className="mt-1 block font-medium text-foreground">{responsePromise}</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {(jobLabel || seriesLabel) && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">About: </span>{jobLabel || seriesLabel}
            </div>
          )}
          {wantsSlot && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="customerre-preferred-date-optional">Preferred date <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <DateField id="customerre-preferred-date-optional" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="customerre-preferred-time-optional">Preferred time <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <TimeField id="customerre-preferred-time-optional" value={preferredTime} onChange={e => setPreferredTime(e.target.value)} />
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="customerre-message">Message</Label>
            <Textarea id="customerre-message" rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder={copy.placeholder} maxLength={2000} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { reset(); onClose(); }} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={handleSend} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Sending…</> : copy.cta}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const KIND_ICON: Record<string, typeof CalendarClock> = {
  Reschedule: CalendarClock,
  Cancellation: XCircle,
  Problem: MessageSquareWarning,
  PauseSeries: PauseCircle,
  CancelSeries: XCircle,
  ProfileCorrection: UserCog,
  AccountClosure: UserX,
  Reclean: Sparkles,
  RefundRequest: BanknoteArrowDown,
};

const KIND_LABEL: Record<string, string> = {
  Reschedule: 'Date change requested',
  Cancellation: 'Cancellation requested',
  Problem: 'Problem reported',
  PauseSeries: 'Contract pause requested',
  CancelSeries: 'Contract cancellation requested',
  ProfileCorrection: 'Name/email correction requested',
  AccountClosure: 'Account closure requested',
  Reclean: 'Re-clean requested',
  RefundRequest: 'Refund requested',
  ServiceExtra: 'Extra work requested',
};

const STATUS_STYLE: Record<string, string> = {
  Open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  Resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  Declined: 'bg-muted text-muted-foreground',
};

/** What the customer sees about asks they have already made. */
export function CustomerRequestsList({ requests }: { requests: PortalRequest[] }) {
  /**
   * §32 „Complaint evidence" (Sesiunea 148) — pozele TUTUROR reclamațiilor, într-o singură chemare,
   * și numai dacă omul a raportat vreodată o problemă. Motivele: `ComplaintPhotos.tsx`.
   *
   * ⚠️ Hook-ul stă înaintea `return null`-ului de mai jos fiindcă un hook nu are voie să fie
   * condiționat — `enabled` face munca, nu poziția apelului.
   */
  const photoState = useMyComplaintPhotos((requests ?? []).some(r => r.kind === 'Problem'));

  if (!requests || requests.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Your requests</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {requests.map(r => {
          const Icon = KIND_ICON[r.kind] ?? MessageSquareWarning;
          return (
            <div key={r.customerRequestId} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{KIND_LABEL[r.kind] ?? r.kind}</p>
                    <p className="text-xs text-muted-foreground">Sent {fmtDate(r.createdAt)}</p>
                  </div>
                </div>
                <Badge className={STATUS_STYLE[r.status] ?? ''}>
                  {/* "Open" is office jargon; to the person waiting it means "we have it". */}
                  {r.status === 'Open' ? 'Awaiting reply' : r.status}
                </Badge>
              </div>
              <p className="mt-1.5 text-sm whitespace-pre-wrap">{r.message}</p>
              {r.preferredDate && (
                <p className="mt-1 text-xs text-muted-foreground">
                  You suggested: {fmtDate(r.preferredDate)}{r.preferredTime ? ` at ${r.preferredTime}` : ''}
                </p>
              )}
              {/* §32 (Sesiunea 148) — dovada, doar pe o reclamație: pe celelalte feluri serverul o refuză. */}
              {r.kind === 'Problem' && (
                <ComplaintEvidence requestRef={r.customerRequestId} status={r.status} state={photoState} />
              )}
              {r.adminResponse && (
                <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />ACHU replied{r.resolvedAt ? ` · ${fmtDate(r.resolvedAt)}` : ''}
                  </p>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{r.adminResponse}</p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

