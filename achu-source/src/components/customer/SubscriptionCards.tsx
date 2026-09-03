import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BadgePoundSterling } from 'lucide-react';
import { fmtDate, fmt } from '@/lib/format';
import type { PortalSubscription } from './portalTypes';

/** ACHU-236 — their regular clean, in the same words the office reads. */
/**
 * Sesiunea 45 (backlog 53) — what the customer has paid for up front.
 *
 * Shows the saving explicitly. A customer who committed to a year and paid in one
 * go should be able to see what that bought them; a number with no comparison is
 * just a large amount of money leaving their account.
 *
 * Only paid terms reach here — the route filters out Drafts, so nothing on this
 * card is a figure the office has not actually quoted.
 */
export default function SubscriptionCards({ subscriptions }: { subscriptions: PortalSubscription[] }) {
  if (subscriptions.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-1.5">
          <BadgePoundSterling className="h-4 w-4 text-muted-foreground" />Your prepaid plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {subscriptions.map((sub, i) => {
          const saving = (sub.fullPricePerVisit - sub.pricePerVisit) * sub.visitsIncluded;
          return (
            <div key={i} className={i > 0 ? 'border-t pt-3' : ''}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <p className="text-sm font-medium">
                  {sub.service} · {sub.termMonths} {sub.termMonths === 1 ? 'month' : 'months'}
                </p>
                <span className="text-xs text-muted-foreground">{sub.reference}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {fmtDate(sub.startDate)} – {fmtDate(sub.endDate)} • {sub.visitsIncluded} jobs included
              </p>
              <p className="mt-1 text-sm">
                Paid in full: <strong>{fmt(sub.paidTotal)}</strong>
                {sub.paidOn && <span className="text-muted-foreground"> on {fmtDate(sub.paidOn)}</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmt(sub.pricePerVisit)} per job
                {sub.discountPercent > 0 && <> instead of {fmt(sub.fullPricePerVisit)} — you saved {fmt(saving)}</>}
              </p>
              {sub.status === 'Active' && (
                // The single most useful sentence on this card: it stops "why have
                // I not had an invoice?" and stops them paying twice.
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                  Jobs in this period are already paid for — you will not be invoiced for them separately.
                </p>
              )}
              {sub.status === 'Completed' && (
                <p className="mt-1 text-xs text-muted-foreground">This period has finished.</p>
              )}
              {sub.status === 'Cancelled' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Cancelled. {sub.refundExplanation ?? ''}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

