/**
 * ACHU-238 / ACHU-560 — DIALOGUL ÎN CARE BIROUL RĂSPUNDE UNEI CERERI DE CLIENT.
 *
 * ⛔ **DE CE UN FIȘIER NOU.** `CustomerRequestsPage.tsx` era la 530 de rânduri, adică peste plafonul
 * de 500, iar felia ACHU-629 a atins chiar trimiterea răspunsului: `AGENT_RULES` §7.4 spune ce se
 * întâmplă atunci — **responsabilitatea atinsă se extrage**. ⚠️ Nu e o modularizare de ocazie
 * (oprită de Roberto pe 15/08), e paza de mărime făcută exact unde e activitate.
 *
 * 🔴 **Ce s-a schimbat, nu doar mutat: ACHU-629.** Serverul poate acum spune că clientul **NU** a
 * fost anunțat — n-are cont de portal, sau vestea nu a ajuns la toți. ⛔ Atunci nu se mai scrie
 * „Sent to the customer", fiindcă ar fi o minciună exact pe singurul om din sistem care nu are pe
 * cine să întrebe ce s-a întâmplat.
 */
import { useEffect, useState } from 'react';
import { answerCustomerRequest } from '@/lib/endpoints';
import type { CustomerRequestRow } from '@/lib/customerRequestEndpoints';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
// ⚠️ Dialogul folosește `<select>` nativ pentru clasificarea reclamației, nu Radix: patru liste
// într-un dialog deja înalt, iar unul nativ nu se închide sub altul în jsdom (ACHU-LIM-004).
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';
// §32 (Sesiunea 148) — dovada trimisă de client, doar citită. Motivele: în fișierul ei.
import CustomerRequestPhotos from './CustomerRequestPhotos';
// §43 „Related complaint" (Sesiunea 150) — urmărirea, notată în timp ce se citește reclamația.
import TaskComposer from './TaskComposer';

/** Un rând, plus butonul pe care s-a intrat în dialog. `intent` e doar al ecranului. */
export type AnsweringItem = CustomerRequestRow & { intent: 'Resolved' | 'Declined' };

type Options = { value: string; label: string }[];

export default function AnswerDialog({ item, options, onClose, onAnswered }: {
  item: AnsweringItem | null;
  /**
   * ACHU-560 — cele patru liste, venite de la server. ⛔ Nu scrise aici: sursa e
   * `backend/src/lib/complaintPolicy.ts`, iar o a doua copie s-ar desincroniza la prima
   * categorie adăugată — exact tiparul ACHU-543, unde o listă ținută de mână în alt fișier a
   * lăsat șase feluri de cerere fără text.
   */
  options?: { categories: Options; severities: Options; causes: Options; outcomes: Options };
  onClose: () => void;
  onAnswered: () => void;
}) {
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState({ complaintCategory: '', complaintSeverity: '', complaintCause: '', complaintOutcome: '' });

  useEffect(() => {
    setReply(''); setError('');
    // Pornește de la ce s-a clasificat deja la primire, nu de la gol.
    setDetail({
      complaintCategory: item?.complaint?.complaintCategory ?? '',
      complaintSeverity: item?.complaint?.complaintSeverity ?? '',
      complaintCause: item?.complaint?.complaintCause ?? '',
      complaintOutcome: item?.complaint?.complaintOutcome ?? '',
    });
  }, [item?.id, item?.intent, item?.complaint]);

  if (!item) return null;
  const declining = item.intent === 'Declined';
  const isComplaintItem = !!item.complaint;

  const send = async () => {
    if (!reply.trim()) { setError('Write what you are telling the customer.'); return; }
    setSaving(true);
    setError('');
    try {
      const done = await answerCustomerRequest({
        id: item.id, status: item.intent, adminResponse: reply.trim(),
        // ⚠️ Golul se trimite ca `null`, nu ca șir gol: „nu am clasificat" și „am șters
        // clasificarea" trebuie să ajungă la aceeași valoare, altfel raportul numără un gol.
        ...(isComplaintItem ? {
          complaintCategory: detail.complaintCategory || null,
          complaintSeverity: detail.complaintSeverity || null,
          complaintCause: detail.complaintCause || null,
          complaintOutcome: detail.complaintOutcome || null,
        } : {}),
      });
      // 🔴 ACHU-629 — „trimis" se spune doar dacă a fost trimis. Altfel biroul află pe loc.
      if (done.notifyWarning) toast.warning(done.notifyWarning, { duration: 12000 });
      else toast.success('Sent to the customer.');
      onAnswered();
    } catch (e) {
      setError(errMsg(e) || 'Could not send that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{declining ? 'Decline this request' : 'Resolve this request'}</DialogTitle>
          <DialogDescription>
            {/* The reply is mandatory on both paths. From the customer's side a status with
                no words is indistinguishable from being ignored, and they are the one
                person here who cannot ask a colleague what happened. */}
            The customer sees this reply in their portal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground">#{item.customerRequestId} · {item.customerName}</p>
            <p className="mt-0.5 whitespace-pre-wrap">{item.message}</p>
          </div>
          {/*
            🔴 §32 (Sesiunea 148) — dovada, IMEDIAT sub cuvintele clientului și DEASUPRA răspunsului.
            ⚠️ Ordinea e argumentul: cine scrie „Declined" citește mai întâi ce a trimis omul. O
            galerie pusă la sfârșitul dialogului s-ar fi citit după ce decizia era deja scrisă.
          */}
          {isComplaintItem && <CustomerRequestPhotos requestId={item.id} />}
          {/*
            🔴 §43 „Related complaint" (Sesiunea 150) — **urmărirea se notează AICI, în momentul în
            care se citește ce a scris omul.**
            ⛔ Pe un ecran separat nu s-ar nota niciodată: cineva răspunde, apasă „Resolve", închide —
            iar „trebuie sunat furnizorul de detergent" rămâne în capul lui. Exact argumentul cu care
            clasificarea reclamației (ACHU-560) a fost pusă în dialogul ăsta, nu în altul.
            ⚠️ Salvează pe cont propriu, deci nu ține de butonul de mai jos: o sarcină notată rămâne
            notată chiar dacă răspunsul se scrie mai târziu.
          */}
          <TaskComposer
            about={{ kind: 'request', id: item.id, label: `${item.kind.toLowerCase()} #${item.customerRequestId}` }}
            onCreated={() => toast.success('Task noted.')}
          />
          <div>
            <Label htmlFor="customerre-your-reply">Your reply</Label>
            <Textarea id="customerre-your-reply"
              rows={4}
              value={reply}
              onChange={e => setReply(e.target.value)}
              maxLength={2000}
              placeholder={declining ? 'e.g. Sorry, that is too close to the date to move — the job stands as booked.' : 'e.g. Moved to Tuesday the 18th at 10am, see you then.'}
            />
          </div>
          {/*
            🔴 ACHU-560 — clasificarea se cere AICI, în momentul în care se închide reclamația.
            Pe un ecran separat nu s-ar completa niciodată: cineva răspunde, apasă „Resolve",
            închide, iar cauza rămâne goală pentru totdeauna — și cauza e singurul câmp care
            se poate acționa.

            ⛔ Nimic nu e obligatoriu. Un birou care nu știe de ce s-a întâmplat trebuie să
            poată închide oricum; „Never established" e o alegere cinstită, iar un câmp
            obligatoriu ar produce clasificări la nimereală, adică date pe care raportul nu
            le poate folosi.
          */}
          {isComplaintItem && options && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-medium">For the complaint record</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="complaint-category" className="text-xs">What it was about</Label>
                  <select id="complaint-category" className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={detail.complaintCategory} onChange={e => setDetail(d => ({ ...d, complaintCategory: e.target.value }))}>
                    <option value="">Not set</option>
                    {options.categories.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="complaint-severity" className="text-xs">How serious</Label>
                  <select id="complaint-severity" className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={detail.complaintSeverity} onChange={e => setDetail(d => ({ ...d, complaintSeverity: e.target.value }))}>
                    <option value="">Not set</option>
                    {options.severities.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="complaint-cause" className="text-xs">Why it happened</Label>
                  <select id="complaint-cause" className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={detail.complaintCause} onChange={e => setDetail(d => ({ ...d, complaintCause: e.target.value }))}>
                    <option value="">Not set</option>
                    {options.causes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="complaint-outcome" className="text-xs">What we did</Label>
                  <select id="complaint-outcome" className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={detail.complaintOutcome} onChange={e => setDetail(d => ({ ...d, complaintOutcome: e.target.value }))}>
                    <option value="">Not set</option>
                    {options.outcomes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              {/* ⚠️ Recording only — nimic de aici nu mișcă bani și nu programează nimic. */}
              <p className="text-xs text-muted-foreground">
                This records what was decided. A refund or a re-clean still has to be done on its own screen.
              </p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={send} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Sending…</> : declining ? 'Decline & send' : 'Resolve & send'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

