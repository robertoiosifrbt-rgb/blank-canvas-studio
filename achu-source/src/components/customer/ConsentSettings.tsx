import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { getCustomerConsents, saveCustomerConsents } from '@/lib/endpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';

/**
 * ACHU-427 (Sesiunea 93) — the customer answers for themselves.
 *
 * ─── The gap this closes ─────────────────────────────────────────────────
 * Owner: *„Si cum is da acordul?"* — and the honest answer was: they cannot.
 * The consent form existed only as a PDF the office downloaded and had signed
 * on paper. Nothing in the database recorded any of it, and the portal's "Edit
 * Details" covers phone and address, not permissions.
 *
 * ⚠️ Meanwhile the portal already ASKS for a gate code, in "Getting in", with
 * no recorded permission to hold one. That is the one item where the gap was
 * live rather than theoretical, which is why access is first in the list.
 *
 * ─── Rules this screen is built to obey ──────────────────────────────────
 * ⛔ **Nothing is bundled.** Seven separate answers, seven separate saves. A
 * single "I agree to all of this" is not valid consent, and refusing any one of
 * them must not affect the service — the copy says so.
 * ⛔ **Unanswered is not "no".** A topic nobody has answered shows as such,
 * because rendering it as a refusal would put words in the customer's mouth and
 * make the record claim an act that never happened.
 * ⛔ **Withdrawal is as easy as giving** — the same two buttons, always both
 * live, never a hidden "contact us to withdraw". That is a legal requirement,
 * not a courtesy.
 *
 * ⚠️ Each answer saves on click rather than behind a Save button: a form that
 * batches would let someone tap "No" to marketing, wander off, and remain
 * subscribed because they never scrolled to the bottom.
 */

interface Topic {
  key: string;
  label: string;
  question: string;
  detail: string;
  version: string;
  granted: boolean | null;
  answeredAt: string | null;
  wordingChanged: boolean;
}

export default function ConsentSettings() {
  const req = useTrackedRequest<{ topics: Topic[] }>({ timeoutMs: 20000 });
  const topics = req.data?.topics ?? [];
  const [saving, setSaving] = useState<string | null>(null);

  // Destructured rather than `[req.fire]`: the linter cannot see that a member
  // expression is stable, and the repo's lint gate is an exact ratchet at 888
  // warnings (`CLAUDE.md` §2.1a) — one new warning fails the build.
  const { fire } = req;
  const load = useCallback(() => { fire(() => getCustomerConsents()); }, [fire]);
  useEffect(() => { load(); }, [load]);

  const answer = async (topic: Topic, granted: boolean) => {
    setSaving(topic.key);
    try {
      // 🔴 ACHU-725 — se trimite înapoi versiunea AFIȘATĂ, ca serverul să refuze dacă textul
      // s-a schimbat cât a stat fila deschisă. Nu se scrie din ea nimic; doar se compară.
      await saveCustomerConsents([{ topic: topic.key, granted, wordingVersion: topic.version }]);
      toast.success(granted ? 'Thank you — noted.' : 'Noted. We will not do that.');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not save that. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <h2 className="font-semibold">Your permissions</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        These are the things that are entirely up to you. You can say no to any of them and it will
        not affect your service or your price, and you can change your mind at any time — including
        after saying yes.
      </p>

      {!req.data && !req.error && (
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      )}

      {req.error && !req.data && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">Could not load your permissions.</p>
          <Button variant="outline" size="sm" onClick={load}>Try again</Button>
        </div>
      )}

      {topics.map(t => (
        <div key={t.key} className="border-t border-border pt-3 space-y-2">
          <p className="text-sm font-medium">{t.question}</p>
          <p className="text-xs text-muted-foreground">{t.detail}</p>

          {/* ⚠️ Both buttons are always live, including the one already chosen.
              Withdrawing has to be exactly as easy as agreeing. */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={t.granted === true ? 'default' : 'outline'}
              className="flex-1"
              disabled={saving === t.key}
              onClick={() => answer(t, true)}
            >
              {saving === t.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Yes</>}
            </Button>
            <Button
              size="sm"
              variant={t.granted === false ? 'default' : 'outline'}
              className="flex-1"
              disabled={saving === t.key}
              onClick={() => answer(t, false)}
            >
              <X className="h-3.5 w-3.5 mr-1" />No
            </Button>
          </div>

          {/* "Not answered" is its own state, distinct from "said no". */}
          {t.granted === null ? (
            <p className="text-xs text-muted-foreground">Not answered yet.</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t.granted ? 'You agreed' : 'You said no'}
              {t.answeredAt && ` on ${new Date(t.answeredAt).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' })}`}.
            </p>
          )}

          {/* The question has been reworded since they answered it. Saying
              nothing would let an old yes stand against text they never saw. */}
          {t.wordingChanged && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              We have reworded this question since you answered. Please have another look.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

