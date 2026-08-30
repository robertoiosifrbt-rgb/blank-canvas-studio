import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Info } from 'lucide-react';

/**
 * The two info cards on the sickness screen: what is genuinely unmodelled (amber,
 * a question for the office), and what used to be unverified but got settled from
 * gov.uk on 01/08/2026 (grey, an answer). See SicknessPage.tsx's own docblock for
 * why that split matters — a warning that has stopped being true is worse than none.
 */
export default function SicknessInfoCards({ data }) {
  return (
    <>
      {/* ⚠️ Above the figures, deliberately. Two things are genuinely unconfirmed,
          and a caveat under a total is a caveat nobody reads. */}
      {/* ⚠️ NOTHING is unverified any more — the four-day rule was the last one, and
          HMRC's transitional guidance settled it on 01/08/2026. What replaced it is a
          different and more honest kind of warning: rules HMRC HAS that this app does
          not implement. The old amber box was a question; this one is a boundary.
          A warning that has stopped being true is worse than none, because it teaches
          the reader to skip the line and then the real one gets skipped too. */}
      {data?.notModelled && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-6 space-y-2 text-sm">
            <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              One thing to ask before you pay sick pay
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Employment and Support Allowance.</strong> Somebody who has had ESA in the last 85 days
              is not eligible for sick pay at all. The app holds no ESA information and cannot get any, so this
              is a question for the person — the figures below assume the answer is no.
            </p>
            {/* ⚠️ The transitional rules for absences spanning 6 April 2026 were named
                here too, until the owner confirmed on 01/08/2026 that ACHU has no
                employees and had none on that date (ACHU-302). Such an absence cannot
                exist, and cannot come into existence later — a future hire cannot have
                been off sick before they were employed. So the warning came out: a
                caution about a situation that cannot arise teaches the reader to skip
                the line, and then the ESA one above gets skipped too. The rules stay
                described in SSP_NOT_MODELLED, where a reader looks on purpose. */}
          </CardContent>
        </Card>
      )}

      {/* Deliberately calm and grey, not amber: these are answers, and the screen
          should show that the ground under the figures got firmer, not raise an alarm. */}
      {data?.unverified?.settled && (
        <Card>
          <CardContent className="pt-6 space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
              Settled from the gov.uk pages on 1 August 2026
            </p>
            <p><strong>No minimum length.</strong> {data.unverified.settled.fourDayRule}</p>
            <p><strong>No waiting days.</strong> {data.unverified.settled.waitingDays}</p>
            <p><strong>No earnings test.</strong> {data.unverified.settled.lowerEarningsLimit}</p>
            <p><strong>Daily rate rounding.</strong> {data.unverified.settled.dailyRateRounding}</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

