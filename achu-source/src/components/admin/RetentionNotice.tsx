/**
 * ACHU-218 — the retention review, on screen.
 *
 * ⛔ THIS EXISTS BECAUSE THE ROUTES WOULD OTHERWISE BE INVISIBLE. `/retention/run`
 * and `/retention/status` with nothing reaching them is exactly the shape of
 * ACHU-392 — four capabilities sitting on the server that the office cannot see
 * and therefore does not know it has. Building that on the same day as fixing it
 * would be its own joke.
 *
 * What the office needs from this is two facts and one button: enquiries go away
 * by themselves after twelve months, here is when that last happened, and press
 * this if you want it to happen now rather than tonight.
 */
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getRetentionStatus, runRetentionReview } from '@/lib/endpointsBackup';
import { errMsg } from '@/lib/errorMessage';

type Status = { retentionDays: number; lastRunAt: string | null; lastRunSummary: string | null };

export default function RetentionNotice() {
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try { setStatus(await getRetentionStatus()); } catch { /* the list still works without it */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async () => {
    setRunning(true);
    try {
      const result = await runRetentionReview();
      /**
       * ⚠️ "Nothing needed deleting" is a RESULT, not a failure, and it is the
       * normal one. Reported as plainly as a deletion, so nobody presses again
       * wondering whether it worked.
       */
      toast.success(
        result.deleted > 0
          ? `${result.deleted} old enquir${result.deleted === 1 ? 'y' : 'ies'} deleted.`
          : 'Checked — nothing has passed twelve months yet.',
      );
      load();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not run the review.');
    } finally {
      setRunning(false);
    }
  };

  const months = status ? Math.round(status.retentionDays / 30.44) : 12;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <div className="flex items-start gap-2">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <p>
            Enquiries that never became a customer are deleted automatically after{' '}
            <strong>{months} months</strong> — this is what the public quote form promises the
            person when they send it.
          </p>
          <p className="text-xs text-muted-foreground">
            {status?.lastRunAt
              ? `Last deletion: ${new Date(status.lastRunAt).toLocaleDateString('en-GB', { timeZone: 'Europe/London' })} — ${status.lastRunSummary}`
              : 'Nothing has needed deleting yet.'}
          </p>
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={run} disabled={running}>
        {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Check now
      </Button>
    </div>
  );
}

