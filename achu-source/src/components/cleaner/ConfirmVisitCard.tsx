import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, X, ThumbsUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { respondToVisit } from '@/lib/cleanerEndpoints';
import { errMsg } from '@/lib/errorMessage';
import type { CleanerJob } from './CleanerApp';

/**
 * §15 „Accept job" / „Decline job" (Sesiunea 158) — CURĂȚĂTORUL SPUNE DACĂ VINE.
 *
 * ✅ Hotărârea lui Roberto, 28/08/2026: confirmă sau refuză, cu **motiv obligatoriu la refuz**; fără
 * răspuns până seara dinainte, vizita apare în Action Centre; ⛔ **nicio penalizare automată**.
 *
 * ─── ⚠️ De ce un fișier propriu, și nu două butoane în `JobCard` ────────────
 * `JobCard.tsx` e **exact** la clichetul lui de mărime (486 de rânduri de cod) și nu are voie să
 * crească (`AGENT_RULES` §7.3). 📜 A cincea felie la rând care IESE din el în loc să intre —
 * ultima a fost `WorkDetailsSection` în Sesiunea 142.
 *
 * ─── 🔴 Ce apără forma cardului ─────────────────────────────────────────────
 *   - **Dispare după răspuns**, înlocuit de ce a spus omul. Un buton care rămâne invită la o a doua
 *     apăsare, iar cel care apasă crede că prima n-a mers (aceeași alegere ca la „am plecat").
 *   - 🔴 **Caseta de motiv apare DOAR după „I can't do this"**, iar butonul de trimitere e stins cât
 *     timp e goală. ⛔ Un refuz trimis fără motiv ar fi fost refuzat de server, adică omul ar fi
 *     apăsat și ar fi primit o eroare — pe telefon, în drum spre altă casă.
 *   - ⚠️ **Se poate schimba răspunsul**: cine a confirmat luni și s-a îmbolnăvit miercuri apasă
 *     „Change my answer". 🔴 Fără rândul ăsta, singura cale ar fi fost un telefon la birou.
 */
export default function ConfirmVisitCard({ job, onRefresh }: { job: CleanerJob; onRefresh?: () => void }) {
  const [asking, setAsking] = useState(false);
  /**
   * 🔴 **De ce e nevoie de starea asta, și cum a fost găsită:** cardul se întoarce din ramura „ai
   * răspuns deja" cât timp `job.response` e pus — iar el rămâne pus până se împrospătează lista. ⛔ Deci
   * „Change my answer" nu făcea **nimic** vizibil: se schimba `asking`, dar ramura de sus ieșea prima.
   * ⚠️ Prinsă de două probe, nu de o citire — de asta există amândouă.
   */
  const [changing, setChanging] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'Accepted' | 'Declined' | null>(null);

  /**
   * ⚠️ **Aceleași condiții ca pe server** (`backend/src/lib/assignmentResponsePolicy.ts`): doar din
   * `Booked`/`Confirmed`, și nu pe o vizită trecută. ⛔ Serverul rămâne poarta — asta e comoditate,
   * ca ecranul să nu ofere un buton pe care serverul îl refuză.
   */
  const answerable = job.status === 'Booked' || job.status === 'Confirmed';
  if (!answerable) return null;

  const send = async (response: 'Accepted' | 'Declined') => {
    setBusy(response);
    try {
      await respondToVisit(job.id, response, response === 'Declined' ? reason.trim() : undefined);
      toast.success(response === 'Accepted' ? 'Thanks — the office knows you are coming.' : 'The office has been told.');
      setAsking(false);
      setChanging(false);
      setReason('');
      onRefresh?.();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  if (job.response && !changing) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2">
        {job.response === 'Accepted'
          ? <ThumbsUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          : <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
        <div className="min-w-0 text-sm text-muted-foreground">
          {job.response === 'Accepted'
            ? 'You said you are coming to this one.'
            : `You told them you cannot do this one${job.declineReason ? `: ${job.declineReason}` : ''}.`}
          {/*
            🔴 Se poate schimba, și butonul o spune. ⚠️ Fără el, singura cale ar fi un telefon la
            birou — iar cine s-a îmbolnăvit la 6 dimineața nu sună, amână.
          */}
          <Button variant="link" size="sm" className="h-auto p-0 ml-1 align-baseline"
            onClick={() => { setChanging(true); setAsking(job.response !== 'Declined'); setReason(job.declineReason ?? ''); }}>
            Change my answer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <p className="text-sm font-medium">Can you do this job?</p>
      {/*
        ⚠️ Propoziția spune și CE se întâmplă dacă nu răspunde — „apare la birou", nu o amenințare.
        ⛔ Nicio penalizare, fiindcă nu există niciuna (hotărârea lui Roberto).
      */}
      <p className="text-xs text-muted-foreground">
        Please answer by 6pm the day before. If you do not, the office will follow it up.
      </p>
      {asking ? (
        <div className="space-y-2">
          <Textarea
            id={`decline-reason-${job.id}`}
            /**
             * ⚠️ **Nume accesibil, nu doar `placeholder`** — §52, prins de `fieldLabels.test.ts`: un
             * placeholder dispare la prima tastă, deci cine folosește un cititor de ecran nu mai are
             * cum să afle ce scrie în casetă. ⛔ Fără etichetă vizibilă: propoziția de deasupra o
             * spune deja, iar pe telefon fiecare rând în plus împinge butoanele sub ecran.
             */
            aria-label="Why you cannot do this job"
            value={reason}
            maxLength={500}
            onChange={e => setReason(e.target.value)}
            placeholder="Why can you not do this one? The office needs to know."
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" className="flex-1 min-h-[44px]"
              disabled={!reason.trim() || busy !== null} onClick={() => send('Declined')}>
              {busy === 'Declined' ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Send
            </Button>
            <Button size="sm" variant="outline" className="min-h-[44px]"
              disabled={busy !== null} onClick={() => { setAsking(false); setChanging(false); setReason(''); }}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 min-h-[44px]" disabled={busy !== null} onClick={() => send('Accepted')}>
            {busy === 'Accepted' ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
            Yes, I can
          </Button>
          <Button size="sm" variant="outline" className="flex-1 min-h-[44px]" disabled={busy !== null}
            onClick={() => setAsking(true)}>
            <X className="h-4 w-4 mr-1.5" />I can&apos;t do this
          </Button>
        </div>
      )}
    </div>
  );
}

