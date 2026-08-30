import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, AlertCircle } from 'lucide-react';

/**
 * ── The stage-1 boundary and the rates-verification status ──────────────────
 * Extracted verbatim from `PayrollSimulatorPage.tsx`: the amber "this is an
 * estimating tool" notice, the green "checked against gov.uk" card, and the red
 * "not checked" card. All three are pure presentation off `meta`/`selectedYear` —
 * no state of their own, no setters.
 */
export function PayrollSimulatorRatesStatus({ meta, selectedYear }) {
  return (
    <>
      {/* The stage-1 boundary, stated first and not as a footnote. */}
      <Card className="border-amber-400">
        <CardContent className="pt-5 text-sm space-y-2">
          <p className="flex items-start gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
            This is an estimating tool, not a payroll system
          </p>
          <p className="text-muted-foreground">
            It calculates and shows you the figures, but it <strong>sends nothing to HMRC</strong> and produces
            no document with legal standing. It saves nothing — no payslip is kept in the app.
          </p>
          <p className="text-muted-foreground">
            Paying real people on the back of this needs reporting to HMRC <strong>at every payment</strong>,
            pension auto-enrolment and holiday calculations. That is stage 2, and it needs a separate decision
            from you — tell me when you want to talk it through.
          </p>
          {meta?.notModelled?.length > 0 && (
            <div>
              {/* Listed rather than left to be discovered. A payslip that silently
                  omits sick pay for a week off sick is wrong in a way that looks
                  completely normal. */}
              <p className="font-medium">What THIS SIMULATOR does not do</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {meta.notModelled.map((n: string) => <li key={n}>{n}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedYear?.verified && (
        <Card className="border-emerald-400">
          <CardContent className="pt-5 text-sm space-y-1">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">
              ✓ The figures for {selectedYear.taxYear} have been checked against gov.uk
            </p>
            <p className="text-muted-foreground">
              {selectedYear.verifiedAgainstHmrc.by}, {selectedYear.verifiedAgainstHmrc.on}.
              Tax, National Insurance, thresholds and minimum wage — all read off the official page.
            </p>
            {selectedYear.unverifiedFields?.length > 0 && (
              <p className="text-muted-foreground">
                <strong>Except:</strong> {selectedYear.unverifiedFields.join('; ')}. The warning only appears
                when the calculation includes a pension.
              </p>
            )}
            {/* Kept as its own line rather than merged into the sentence above: the
                auto-enrolment figures come from a different regulator on a different
                site, and saying "checked against gov.uk" would vouch for something
                that page does not carry. */}
            {selectedYear.pensionFiguresVerified && (
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                ✓ The pension figures have been checked against The Pensions Regulator —{' '}
                {selectedYear.pensionFiguresVerified.on}. Nothing in this year is now unchecked.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {selectedYear && !selectedYear.verified && (
        <Card className="border-destructive/60">
          <CardContent className="pt-5 text-sm space-y-2">
            <p className="flex items-start gap-2 font-medium text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {selectedYear.partiallyVerified
                ? `The figures for ${selectedYear.taxYear} have only been partly checked`
                : `The figures for ${selectedYear.taxYear} have not been checked by anybody`}
            </p>

            {/* Two different messages, because "partly checked" and "not checked at
                all" call for different action. Showing the same caution for both
                would waste the work already done and hide what is left. */}
            {selectedYear.partiallyVerified ? (
              <>
                <p className="text-muted-foreground">
                  Checked against gov.uk by {selectedYear.partiallyVerified.by}, {selectedYear.partiallyVerified.on}.
                </p>
                <div>
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">✓ Confirmed</p>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground">
                    {selectedYear.partiallyVerified.confirmed.map((c: string) => <li key={c}>{c}</li>)}
                  </ul>
                </div>
                {selectedYear.partiallyVerified.confirmedFromSecondarySource?.length > 0 && (
                  <div>
                    {/* A generated summary citing gov.uk is weaker than the page.
                        Shown separately because this table has already been wrong
                        twice with numbers that looked entirely plausible. */}
                    <p className="font-medium text-amber-600">~ Taken from secondary sources (not straight off gov.uk)</p>
                    <ul className="list-disc pl-5 text-xs text-muted-foreground">
                      {selectedYear.partiallyVerified.confirmedFromSecondarySource.map((c: string) => <li key={c}>{c}</li>)}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="font-medium text-destructive">Still to be confirmed</p>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground">
                    {selectedYear.partiallyVerified.outstanding.map((o: string) => <li key={o}>{o}</li>)}
                  </ul>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">
                  The thresholds and percentages were written from memory, not read off gov.uk — the environment
                  I work in cannot reach it. They are almost certainly right, but <strong>unchecked</strong>.
                </p>
                <p className="text-muted-foreground">
                  That is the real risk in this module, and it is not a programming one: an out-of-date threshold
                  does not throw an error, it gives believable wrong figures forever. Search gov.uk for
                  "rates and thresholds for employers" for {selectedYear.taxYear}, compare it against the table
                  below, and tell me.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

