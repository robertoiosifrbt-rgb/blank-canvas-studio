import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Repeat } from 'lucide-react';
import { fmt } from '@/lib/format';
import type { RequestKind } from './CustomerRequests';
import type { PortalContract } from './portalTypes';

export default function RecurringContracts({ contracts, onRequest }: {
  contracts: PortalContract[];
  onRequest: (kind: RequestKind, series: { id: string; description?: string | null }) => void;
}) {
  if (contracts.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-1.5">
          <Repeat className="h-4 w-4 text-muted-foreground" />Your regular clean
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {contracts.map((c, i) => (
          <div key={c.id ?? i}>
            <p className="text-sm font-medium">{c.description}</p>
            <p className="text-xs text-muted-foreground">
              {c.service}
              {c.startTime && <> • {c.startTime}{c.finishTime ? `–${c.finishTime}` : ''}</>}
              {c.amountCharged != null && <> • {fmt(c.amountCharged)} per job</>}
            </p>
            {c.status === 'paused' && (
              // Paused is temporary and usually at their own request; saying so
              // prevents "have you cancelled me?".
              <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">Currently paused — no jobs are being booked.</p>
            )}
            {/* Sesiunea 97 (Backlog_Client_Prioritar §1): these RAISE A REQUEST, same as
                Reschedule/Cancellation on a visit — they never touch this contract
                directly. `c.id` is required; a contract without one predates this
                change on a stale cached response, so the buttons are withheld rather
                than sent with nothing to point at. */}
            {c.id && (
              <div className="mt-1.5 flex gap-3">
                {c.status !== 'paused' && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    onClick={() => onRequest('PauseSeries', { id: c.id, description: c.description })}
                  >
                    Ask to pause
                  </button>
                )}
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={() => onRequest('CancelSeries', { id: c.id, description: c.description })}
                >
                  Ask to cancel
                </button>
              </div>
            )}
          </div>
        ))}
        <p className="pt-1 text-xs text-muted-foreground">
          Your booked jobs appear under <strong>Upcoming</strong>.
        </p>
      </CardContent>
    </Card>
  );
}

