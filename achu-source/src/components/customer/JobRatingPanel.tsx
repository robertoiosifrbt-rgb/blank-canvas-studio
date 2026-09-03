import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { rateJob } from '@/lib/endpoints';
import { errMsg } from '@/lib/errorMessage';

/**
 * ACHU-537 (Sesiunea 119) — clientul dă o notă vizitei încheiate, și scrie de ce, dacă vrea.
 *
 * 🔴 **PE FAȚA CARDULUI, nu în spatele „View Details" — și e o abatere deliberată** de la
 * regula scrisă în `CustomerJobCard.tsx`, care ține butoanele de cerere ascunse fiindcă
 * *„un mis-tap ajunge la birou ca o cerere reală"*. Aici nu ajunge: nota **se poate
 * schimba** oricând de către cel care a dat-o, iar nimic nu se întâmplă din ea în afară de
 * o notificare. Iar o notă ascunsă la două atingeri nu se dă niciodată, deci
 * funcționalitatea ar măsura satisfacția clienților care caută unde s-o măsoare.
 *
 * ⚠️ **Steaua se salvează la atingere, fără buton de Save** — dar comentariul NU. O notă
 * fără text e cazul obișnuit și trebuie să coste o singură atingere; un text scris pe
 * jumătate salvat automat ar trimite biroului o propoziție neterminată.
 */
export type JobRating = { score: number; comment: string | null; updatedAt?: string | null };

const SCORE_WORD: Record<number, string> = {
  1: 'Very poor', 2: 'Poor', 3: 'OK', 4: 'Good', 5: 'Excellent',
};

/**
 * ACHU-553 (Sesiunea 121) — invitația la o recenzie publică, **cerută de Archana pe
 * 12/08/2026** (*„4.b"*): după o vizită bine notată, **niciodată după o reclamație**.
 *
 * 🔴 **Aici, lângă nota tocmai dată, fiindcă ăsta e MOMENTUL.** Link-ul exista deja în portal,
 * dar era penultimul card din tabul „Account", între exportul GDPR și ștergerea contului —
 * Archana l-a semnalat exact așa: *„e ascuns sub detalii pe undeva"*. Un om care tocmai a
 * apăsat a cincea stea e la un pas de a scrie o recenzie; același om, trei taburi mai încolo,
 * lângă un buton de ștergere a contului, nu e.
 *
 * ⛔ **Verdictul vine de la server, nu se calculează aici** (`backend/src/lib/publicReviewPolicy.ts`).
 * Ecranul nu vede reclamațiile clientului și nu are cum să uite condiția.
 */
export type ReviewInviteState = {
  /** Dacă i se poate cere ACESTUI client o recenzie publică acum. Decis pe server. */
  allowed: boolean;
  /** Link-ul, sau `null` dacă nimeni nu l-a completat în Invoice Settings. */
  url: string | null;
  /** De la câte stele merită invitația. Vine de la server, ca ecranul să nu-l rescrie. */
  fromScore: number;
};

function ReviewInvite({ rating, invite }: { rating: JobRating; invite?: ReviewInviteState }) {
  // ⚠️ Trei condiții, și fiecare e o stare reală, nu o eroare: nu există link (nimeni nu l-a
  // completat), clientul are o reclamație (serverul a spus nu), nota nu e destul de bună.
  if (!invite?.allowed || !invite.url) return null;
  if (rating.score < invite.fromScore) return null;

  return (
    <div className="pt-1.5 border-t border-border flex items-center justify-between gap-2 flex-wrap">
      <p className="text-xs text-muted-foreground">Thank you! Would you tell others?</p>
      <Button variant="outline" size="sm" className="text-xs h-7" asChild>
        <a href={invite.url} target="_blank" rel="noopener noreferrer">
          <Star className="h-3 w-3 mr-1" />Leave a Google review
        </a>
      </Button>
    </div>
  );
}

export default function JobRatingPanel({ jobId, rating, onSaved, reviewInvite }: {
  jobId: string;
  rating: JobRating | null;
  onSaved: (rating: JobRating) => void;
  /** ACHU-553 — omis când portalul nu l-a trimis (backend mai vechi): invitația nu apare. */
  reviewInvite?: ReviewInviteState;
}) {
  const [editing, setEditing] = useState(!rating);
  const [comment, setComment] = useState(rating?.comment ?? '');
  /**
   * 🔴 ACHU-566 — **a treia copie a aceleiași greșeli, și cea care ținea ecranul blocat.**
   *
   * `editing` porneşte din `!rating`, iar `useState` citeşte asta **o singură dată, la
   * montare**. Deci chiar după ce `CustomerJobCard` s-a resincronizat şi a trimis nota reală
   * în props, panoul rămânea în modul de editare şi continua să întrebe *„How was this
   * clean?"* pentru o vizită deja notată.
   *
   * ⚠️ **Numai la trecerea `null` → notă.** Un client care apasă „Change" intră deliberat în
   * editare, iar o resincronizare care l-ar scoate de acolo i-ar șterge textul din mână.
   */
  const [saving, setSaving] = useState(false);
  /**
   * Steaua pe care ecranul o ARATĂ, care nu e mereu cea salvată: între atingere și
   * răspunsul serverului trebuie să se vadă alegerea, altfel atingerea pare pierdută.
   * Pe eroare se întoarce la nota reală — vezi `catch`.
   */
  const [shownScore, setShownScore] = useState(rating?.score ?? 0);

  const save = async (score: number, nextComment: string) => {
    if (saving) return;
    setSaving(true);
    setShownScore(score);
    try {
      const trimmed = nextComment.trim();
      const saved = await rateJob({ jobId, score, comment: trimmed || undefined });
      onSaved({ score: saved.rating.score, comment: saved.rating.comment, updatedAt: saved.rating.updatedAt });
      setEditing(false);
      toast.success('Thank you — your feedback has been sent to ACHU.');
    } catch (e) {
      // ⚠️ Steaua se întoarce la ce e SALVAT, nu la ce s-a atins. Altfel ecranul ar arăta
      // o notă pe care serverul nu o are, iar clientul ar crede că a răspuns.
      setShownScore(rating?.score ?? 0);
      toast.error(errMsg(e) || 'We could not save your rating. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Nota dată, cu textul ei — starea în care ecranul stă după ce clientul a răspuns.
  if (!editing && rating) {
    return (
      <div className="rounded-lg bg-muted/30 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Stars score={rating.score} />
            <span className="text-xs text-muted-foreground">{SCORE_WORD[rating.score] ?? ''}</span>
          </div>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setEditing(true); setComment(rating.comment ?? ''); }}>
            <Pencil className="h-3 w-3 mr-1" />Change
          </Button>
        </div>
        {rating.comment && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{rating.comment}</p>}
        <ReviewInvite rating={rating} invite={reviewInvite} />
      </div>
    );
  }

  return (
    /**
     * `fieldset` + `legend`, nu un `<Label>` deasupra grupului (lecția ACHU-522/523): cele
     * cinci stele sunt un grup de controale, iar un `Label` fără `htmlFor` nu e asociat cu
     * niciunul dintre ele — un cititor de ecran ar anunța cinci butoane fără să spună la ce.
     */
    <fieldset className="rounded-lg bg-muted/30 p-2.5 space-y-2" disabled={saving}>
      <legend className="text-xs font-medium px-1">How was this clean?</legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(score => (
          <button
            key={score}
            type="button"
            aria-label={`${score} ${score === 1 ? 'star' : 'stars'} — ${SCORE_WORD[score]}`} title={`${score} ${score === 1 ? 'star' : 'stars'} — ${SCORE_WORD[score]}`}
            aria-pressed={shownScore === score}
            className="p-0.5 disabled:opacity-60"
            disabled={saving}
            onClick={() => void save(score, comment)}
          >
            <Star className={`h-6 w-6 ${score <= shownScore ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
          </button>
        ))}
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-1" />}
        {!saving && shownScore > 0 && <span className="text-xs text-muted-foreground ml-1">{SCORE_WORD[shownScore]}</span>}
      </div>
      <Textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Anything you would like us to know? (optional)"
        maxLength={2000}
        rows={2}
        className="text-xs"
        aria-label="Your feedback about this job"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="text-xs h-7"
          // ⛔ Dezactivat fără stea, fiindcă serverul refuză un text fără notă: un buton care
          // trimite ceva ce ruta respinge cere clientului să afle regula din eroare.
          disabled={saving || shownScore === 0}
          onClick={() => void save(shownScore, comment)}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send feedback'}
        </Button>
        {rating && (
          <Button variant="ghost" size="sm" className="text-xs h-7" disabled={saving} onClick={() => { setEditing(false); setShownScore(rating.score); setComment(rating.comment ?? ''); }}>
            Cancel
          </Button>
        )}
      </div>
    </fieldset>
  );
}

function Stars({ score }: { score: number }) {
  return (
    // `aria-label` pe grup, nu cinci iconițe fără nume: nota citită cu voce tare e „4 din 5",
    // nu „stea stea stea stea".
    <span className="flex items-center gap-0.5" role="img" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`h-4 w-4 ${s <= score ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`} />
      ))}
    </span>
  );
}

