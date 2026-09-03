import { useState } from 'react';
import { getPayrollRunRti, type PayrollRunRtiResponse } from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { errMsg } from '@/lib/errorMessage';

/**
 * Sesiunea 80c (ACHU-316) — what HMRC would be told about this run.
 *
 * ⚠️ Collapsed by default, and it stays that way. The office's job on this screen
 * is to check what people are paid; the RTI assembly is a compliance question that
 * matters before a first submission, not during every payroll. Expanded by default
 * it would be noise, and noise on this screen is how the two lists that MUST be
 * read — errors, and who is missing — stop being read.
 *
 * ─── Why this panel is worth having at all ─────────────────────────────────
 * Nothing is sent to HMRC and nothing can be. What the panel shows is the list of
 * things that would make a submission impossible today: no National Insurance
 * number, no address, no employer PAYE or Accounts Office reference. None of those
 * are stored anywhere, and that stays invisible until somebody assembles an FPS.
 *
 * The wording is the server's. Rewording a compliance sentence in a component is
 * how the two versions drift, and the one on screen is the one somebody acts on.
 */
export function RtiPanel({ runId }: { runId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PayrollRunRtiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setOpen(true);
    if (data || loading) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getPayrollRunRti(runId));
    } catch (e) {
      setError(errMsg(e) ?? 'Could not work out what HMRC would be told.');
    } finally { setLoading(false); }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={load} className="w-full">
        What HMRC would be told
      </Button>
    );
  }

  return (
    <div className="rounded border p-3 space-y-2">
      <p className="font-medium">What HMRC would be told</p>

      {loading && <p className="text-xs text-muted-foreground">Working it out…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {data && (
        <>
          {/* The refusal comes first, before any figure. Somebody scrolling past a
              screen of correct FPS fields must not be able to reach them without
              having read that none of it was sent. */}
          <p className="text-xs text-muted-foreground">{data.notice}</p>
          <p className="text-xs text-muted-foreground">{data.submission?.reason}</p>

          <div className="text-xs">
            Tax year {data.fps?.taxYear}
            {data.fps?.taxWeek != null && <> · tax week {data.fps.taxWeek}</>}
            {data.fps?.taxMonth != null && <> · tax month {data.fps.taxMonth}</>}
            {' · '}{data.fps?.employees?.length ?? 0} people
          </div>

          {data.fps?.complete ? (
            <p className="text-xs text-muted-foreground">
              Every field an FPS needs is present. That is not permission to send one — see above.
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-medium">
                {data.fps?.blocking?.length} thing{data.fps?.blocking?.length === 1 ? '' : 's'} would stop a real
                submission:
              </p>
              <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                {data.fps.blocking.map((b, i) => <li key={i}>{b.message}</li>)}
              </ul>
            </div>
          )}
        </>
      )}

      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Hide</Button>
    </div>
  );
}

