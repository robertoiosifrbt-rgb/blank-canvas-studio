import { useState } from 'react';
import {
  getPayrollRunNiCorrection,
  type PayrollRunNiCorrectionResponse, type NiCorrectionPerson,
  type NiRecheckedPerson, type NiNotRecheckedPerson,
} from '@/lib/endpoints';

/**
 * ⚠️ **Predicate, nu simple filtre** — sub `strict: false` o uniune discriminată pe un boolean
 * **nu se îngustează** printr-un `.filter()` obișnuit (lecția feliei 13). Fără ele, ecranul ar
 * citi `route` pe ramura pe care nu există.
 *
 * ⛔ **Locale, nu în catalog:** un mock parțial al lui `@/lib/endpoints` face o funcție lipsă
 * `undefined`, iar componenta ar cădea întreagă (`AGENT_RULES` §10). Tipurile se importă —
 * ele se șterg la compilare — funcțiile nu.
 */
const isRechecked = (p: NiCorrectionPerson): p is NiRecheckedPerson => p.rechecked;
const isNotRechecked = (p: NiCorrectionPerson): p is NiNotRecheckedPerson => !p.rechecked;
import { Button } from '@/components/ui/button';
import { money } from '@/lib/payrollRunsFormat';
import { errMsg } from '@/lib/errorMessage';

/**
 * ─── Is the National Insurance on this period still right? (ACHU-371) ───────
 *
 * ⚠️ Why this is a panel and not an action. It answers a question nothing else in the
 * app answers: **the gross was right and the NI was not.** That happens when somebody
 * corrects a person's record after the money has gone — a category letter, or a
 * director who was not marked as one — and after that, nothing ever mentions the paid
 * period again. Tax would have sorted itself out on the next payslip; NI never does.
 *
 * 🔴 The wording is the server's, all of it. These are sentences somebody acts on with
 * legal consequences attached — an under-deduction recovered after 5 April is an
 * unlawful deduction from wages — and a component that paraphrased one would be the
 * version on screen while the tested one sat in a policy file.
 *
 * ⛔ There is no button that applies anything, and there is no endpoint behind one.
 */
export function NiCorrectionPanel({ runId }: { runId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PayrollRunNiCorrectionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setOpen(true);
    if (data || loading) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getPayrollRunNiCorrection(runId));
    } catch (e) {
      setError(errMsg(e) ?? 'Could not recheck the National Insurance on this period.');
    } finally { setLoading(false); }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={load} className="w-full">
        Recheck National Insurance
      </Button>
    );
  }

  // ⚠️ Predicatele vin din catalog: sub `strict: false` un `.filter()` obișnuit nu îngustează
  // uniunea, iar ecranul ar citi câmpuri de pe ramura pe care nu există.
  const changed = (data?.people ?? []).filter(isRechecked).filter(p => p.difference.direction !== 'unchanged');
  const notRechecked = (data?.people ?? []).filter(isNotRechecked);

  return (
    <div className="rounded border p-3 space-y-2">
      <p className="font-medium">National Insurance on this period</p>

      {loading && <p className="text-xs text-muted-foreground">Rechecking…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {data && (
        <>
          {/* The two notices come before any figure, and in this order. Somebody
              scrolling to the numbers must have passed "nothing was changed" first —
              a list of differences is exactly what reads as a list of adjustments. */}
          <p className="text-xs text-muted-foreground">{data.notice}</p>
          <p className="text-xs text-muted-foreground">{data.niIsNotTax}</p>
          <p className="text-xs text-muted-foreground">{data.stanceSentence}</p>

          {changed.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {/* Said as a measurement, not as reassurance: it is only true of the
                  people who could be rechecked, and the rest are listed below. */}
              Every person who could be rechecked has the National Insurance this period paid them.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium">
                {changed.length} {changed.length === 1 ? 'person needs' : 'people need'} a correction
                {data.totalOwedToHmrcPence !== 0 && (
                  <> · {data.totalOwedToHmrcPence > 0 ? 'owed to HMRC' : 'owed back by HMRC'}{' '}
                    {money(Math.abs(data.totalOwedToHmrcPence) / 100)}</>
                )}
              </p>

              {changed.map(p => (
                <div key={p.cleanerId} className="rounded border p-2 space-y-1">
                  <p className="text-xs font-medium">
                    {p.name}
                    {p.categoryChanged && (
                      <span className="font-normal text-muted-foreground">
                        {' '}· worked out on category {p.categoryAtTheTime}, their record says {p.categoryNow} today
                      </span>
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Employee NI</span>{' '}
                      {money(p.paid.employeePence / 100)} → {money(p.correct.employeePence / 100)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Employer NI</span>{' '}
                      {money(p.paid.employerPence / 100)} → {money(p.correct.employerPence / 100)}
                    </div>
                  </div>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                    {p.route?.sentences?.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                  {p.route?.obligations?.length > 0 && (
                    <ul className="list-disc pl-5 text-xs text-destructive space-y-0.5">
                      {p.route.obligations.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ⚠️ Listed, never omitted. A director left out silently would read as a
              director with nothing wrong, and the reason they are absent is the thing
              worth knowing: the next run of the same year settles it, and after 5 April
              nothing does. */}
          {notRechecked.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium">{notRechecked.length} not rechecked</p>
              <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                {notRechecked.map(p => <li key={p.cleanerId}><span className="font-medium">{p.name}</span> — {p.sentence}</li>)}
              </ul>
            </div>
          )}
        </>
      )}

      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Hide</Button>
    </div>
  );
}

