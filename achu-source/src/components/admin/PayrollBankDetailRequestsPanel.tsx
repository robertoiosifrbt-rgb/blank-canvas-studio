import { useCallback, useEffect, useState } from 'react';
import {
  getBankDetailRequests, approveBankDetailRequest, rejectBankDetailRequest,
  type BankDetailRequestsResponse, type ApproveBankDetailRequestResponse,
} from '@/lib/endpoints';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
// ACHU-377 adds `fmtDateTime`: WHEN a bank change was asked for is part of deciding it
// — a request that arrived four minutes ago and one from last Tuesday are different
// situations, and the date alone loses that.
import { fmtDateTime } from '@/lib/format';
import RefreshButton from '@/components/shared/RefreshButton';
import { errMsg } from '@/lib/errorMessage';

/**
 * ─── ACHU-377: bank-detail changes the EMPLOYEE asked for ───────────────────
 *
 * The office can already change where a wage is sent (ACHU-373). This is the other
 * direction — the employee asks, the office decides — and it exists because the
 * pending state is **the only moment a request from a compromised account can still be
 * stopped.** Once the profile carries the new account there is nothing left to check.
 *
 * 🔴 EVERY SENTENCE ON THIS PANEL IS THE SERVER'S. `howToCheck` and `recoveryNotice`
 * come down with the list and are rendered verbatim. They are not decoration:
 *   · `howToCheck` says the digits cannot tell you anything and the person must be rung
 *     on a route the request did not arrive through — that sentence is the entire value
 *     of the approval step, and without it the step is a click.
 *   · `recoveryNotice` says approving does nothing about money already sent.
 * A component that paraphrased either would be the version on screen while the tested
 * one sat in a policy file.
 *
 * ⚠️ Both sides of every field are MASKED, by the server, and that is not an oversight
 * to fix. The question the office answers is *did this person really ask for this?* —
 * the last four digits and the sort code answer it. Reading a full account number is a
 * separate recorded act (`revealPayrollBankDetails`) and is not needed to decide, so it
 * is not offered as part of deciding.
 *
 * ⛔ Renders NOTHING when there is nothing waiting. A permanently empty panel on a
 * screen the office opens daily is a panel that stops being read — and this one has to
 * be read on the day it is not empty. Discovery is the notification, which is already
 * built and already fires on submission.
 */
export function BankDetailRequestsPanel() {
  const [data, setData] = useState<BankDetailRequestsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Which request is having a refusal typed, and what has been typed so far. */
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  /**
   * 🔴 ACHU-754 — cine tocmai a fost aprobat și dacă a AJUNS înștiințarea la el.
   *
   * ⚠️ Ținut în stare, nu spus într-un toast, și **nu** e o preferință de stil: aprobarea
   * scoate cererea din listă, iar panoul întreg dispare când lista se golește. Un toast pe
   * ultima cerere ar fi singurul loc unde s-a spus vreodată că omul **nu a putut fi anunțat**,
   * și dispare singur în câteva secunde.
   */
  const [approved, setApproved] = useState<{ name: string; res: ApproveBankDetailRequestResponse } | null>(null);

  const load = useCallback(() => {
    setError(null);
    getBankDetailRequests()
      .then(setData)
      .catch(e => setError(e?.message ?? 'Could not load the bank detail changes people asked for.'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const requests = data?.requests ?? [];

  async function decide(id: string, name: string, approve: boolean) {
    // 🔴 ACHU-621 — se trimite revizia datelor bancare pe care ecranul ĂSTA le arată, ca o aprobare
    // pe un ecran vechi să fie refuzată. Serverul explică refuzul; noi îl arătăm verbatim, mai jos.
    const shown = requests.find(r => r.id === id)?.profileRevision;
    setBusyId(id);
    setError(null);
    try {
      if (approve) {
        // ⚠️ `undefined` pentru notă, nu `null`: aprobarea nu trimite notă, iar `null` ar fi schimbat
        // gratuit forma apelului — chiar ce a prins o a doua suită care montează panoul ăsta.
        const res = await approveBankDetailRequest(id, undefined, shown);
        setApproved({ name, res });
        toast.success(`Bank details updated for ${name}. The next payment goes to the new account.`);
      } else {
        await rejectBankDetailRequest(id, note);
        toast.success(`${name} has been told the change was not made, with your reason.`);
      }
      setRejecting(null);
      setNote('');
      load();
    } catch (e) {
      // The server's refusal verbatim — "somebody already decided this one" and "a
      // reason is required" are different problems and the office needs to know which.
      setError(errMsg(e) ?? 'Could not record that decision.');
    } finally { setBusyId(null); }
  }

  /**
   * An error with nothing waiting is still worth showing: it means we do not KNOW.
   * ⚠️ ACHU-754: și o aprobare tocmai făcută ține panoul în viață — altfel ce s-a întâmplat
   * cu înștiințarea ar dispărea odată cu ultimul rând din listă.
   */
  if (requests.length === 0 && !error && !approved) return null;

  return (
    <Card className="border-amber-400">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
          <div className="mr-auto">
            <p className="text-sm font-medium">
              {requests.length} bank detail change{requests.length === 1 ? '' : 's'} waiting for a decision
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Decide before the next payment run — a pay run that goes out first pays the OLD account.
            </p>
          </div>
          <RefreshButton onRefresh={load} />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Said once per screen, not per row. A sentence repeated on every request is a
            sentence that stops being read, and this is the one that keeps approval from
            becoming a click. */}
        {data?.howToCheck && (
          <p className="text-xs bg-amber-50 dark:bg-amber-950/30 rounded p-2">{data.howToCheck}</p>
        )}

        {requests.map(r => (
          <div key={r.id} className="rounded border p-3 space-y-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <p className="text-sm font-medium mr-auto">{r.name}</p>
              <span className="text-xs text-muted-foreground">asked {fmtDateTime(r.submittedAt)}</span>
            </div>

            <div className="space-y-1">
              {r.comparison.map(c => (
                <div
                  key={c.field}
                  className={`grid grid-cols-[9rem_1fr_1fr] gap-2 text-xs items-baseline ${c.changed ? 'font-medium' : 'text-muted-foreground'}`}
                >
                  <span>{c.label}</span>
                  {/* An empty side is said, not left blank: "nothing on file" and "we
                      failed to load it" look identical as a gap. */}
                  <span className={c.changed ? 'line-through text-muted-foreground' : ''}>
                    {c.before ?? <span className="italic">nothing on file</span>}
                  </span>
                  <span>
                    {c.after ?? <span className="italic">nothing</span>}
                    {c.changed && <span className="text-amber-600 ml-1">changed</span>}
                  </span>
                </div>
              ))}
            </div>

            {rejecting === r.id ? (
              <div className="space-y-2">
                {/* ⚠️ The server REQUIRES a reason and refuses an empty one. A refusal
                    with no reason is one the employee sends again unchanged — and when
                    the reason is "we could not reach you to check", that is precisely
                    what they need to hear. So the box is required here too, rather than
                    letting the round-trip fail. */}
                {/* ⚠️ `htmlFor`/`id` rather than a bare label: a screen reader on a
                    refusal box that announces nothing is a box somebody fills in
                    blind, and the reason typed here is sent to the person verbatim. */}
                <Label htmlFor={`reject-note-${r.id}`} className="text-xs">
                  Why is it not being made? They are told your reason, word for word.
                </Label>
                <Textarea
                  id={`reject-note-${r.id}`}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  placeholder="We rang you and could not reach you — please call the office."
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busyId === r.id || note.trim() === ''}
                    onClick={() => decide(r.id, r.name, false)}
                  >
                    {busyId === r.id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Send refusal
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setRejecting(null); setNote(''); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" disabled={busyId === r.id} onClick={() => decide(r.id, r.name, true)}>
                  {busyId === r.id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Approve — pay the new account
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === r.id}
                  onClick={() => { setRejecting(r.id); setNote(''); }}
                >
                  Refuse
                </Button>
              </div>
            )}
          </div>
        ))}

        {/* 🔴 ACHU-754 — ce s-a întâmplat cu înștiințarea celui tocmai aprobat. Cazul „nu
            era cui să i se spună" arată DIFERIT, fiindcă apărarea pe care se bazează toată
            lumea nu s-a aplicat schimbării ăsteia. */}
        {approved?.res.nobodyToTell && (
          <div className="rounded border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 space-y-1">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-400">
              {approved.name} was NOT told — they have no active portal account, so nothing could reach them.
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-400">
              Tell {approved.name} yourself, by phone or face to face. If somebody else asked for this change,
              they are the only person who can say so.
            </p>
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setApproved(null)}>
              I have told them
            </Button>
          </div>
        )}

        {approved && !approved.res.nobodyToTell && (
          <p className="text-xs text-muted-foreground">
            {/* ⚠️ Un FAPT, nu o intenție — notificarea a fost chiar scrisă. */}
            {approved.name} was told the account changed. {approved.res.recoveryNotice}
          </p>
        )}

        {/* ⛔ LAST, and deliberately after the buttons. It is the sentence somebody
            needs the moment they discover a wrong account, which is the moment they
            start looking for a button — so it sits where that search ends. */}
        {data?.recoveryNotice && (
          <p className="text-xs text-muted-foreground">{data.recoveryNotice}</p>
        )}
      </CardContent>
    </Card>
  );
}

