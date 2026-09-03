/**
 * §36 „Negative-feedback escalation" — butonul cu care biroul închide o notă mică.
 *
 * ─── 🔴 CE ÎNCHIDE, ȘI CE NU PROMITE ────────────────────────────────────────
 * „Am vorbit cu clientul" scoate rândul de pe Action Centre și scrie **cine** a vorbit și
 * **când**. ⛔ Nu programează o re-curățare, nu întoarce bani și nu trimite nimic clientului —
 * aplicația nu are o politică de compensare, iar un buton care ar suna ca o rezolvare ar inventa
 * una (același raționament ca la cererea de rambursare din portal).
 *
 * ⚠️ **Nota nu e obligatorie.** „Nu era nevoie" e un rezultat legitim, iar un câmp obligatoriu ar
 * fi produs propoziții scrise ca să treacă formularul.
 *
 * ⛔ **Nota e INTERNĂ.** Clientul nu o vede niciodată; textul de pe ecran o spune, ca nimeni să nu
 * scrie acolo un mesaj pentru el.
 *
 * ─── De ce un fișier propriu ─────────────────────────────────────────────────
 * `AGENT_RULES` §9: o capabilitate nouă intră în fișierul ei, iar `CustomerFeedbackPage.tsx` doar
 * o așează pe cardul notei.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PhoneCall, Loader2, CheckCircle2 } from 'lucide-react';
import { followUpJobRating } from '@/lib/endpoints';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';
import { fmtDate } from '@/lib/format';

export type FollowUpState = { at: string; by: string; note: string | null } | null;

export default function RatingFollowUp({ ratingId, followUp, needsFollowUp, onDone }: {
  ratingId: string;
  followUp: FollowUpState;
  /** ⚠️ Vine de la SERVER — pragul de „notă mică" e al lui, nu al ecranului. */
  needsFollowUp: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (followUp) {
    return (
      <div className="text-xs text-emerald-700 flex items-start gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          Followed up by {followUp.by} on {fmtDate(String(followUp.at).slice(0, 10))}
          {followUp.note && <> — <span className="italic">{followUp.note}</span></>}
        </span>
      </div>
    );
  }

  // ⛔ O notă bună nu cere un telefon. Butonul apare doar unde serverul spune că e nevoie.
  if (!needsFollowUp) return null;

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await followUpJobRating({ id: ratingId, note: note.trim() || null });
      /**
       * ⚠️ Propoziția vine de la server (`message`), inclusiv cea pentru „altcineva a apucat
       * primul" — două texte pentru același răspuns ar început să difere.
       */
      if (res.alreadyFollowedUp) toast.warning(res.message);
      else toast.success(res.message);
      setOpen(false);
      setNote('');
      onDone();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not record that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-amber-900">
          Nobody has called this customer about it yet. It stays on the Action Centre until somebody does.
        </p>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <PhoneCall className="h-3.5 w-3.5 mr-1" aria-hidden="true" />I have spoken to them
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 space-y-2">
      <label htmlFor={`follow-up-${ratingId}`} className="text-xs text-amber-900 block">
        What happened? Optional, and only the office sees it.
      </label>
      <Textarea
        id={`follow-up-${ratingId}`}
        rows={2}
        value={note}
        maxLength={1000}
        placeholder="Called her — she was upset about the late start, we agreed a free hour next job."
        onChange={e => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden="true" />}Record it
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}

