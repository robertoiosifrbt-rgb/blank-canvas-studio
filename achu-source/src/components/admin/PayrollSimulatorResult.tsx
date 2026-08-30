import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { fmt } from '@/lib/format';
import type { SimulateResponse, PayrollTaxYearRates } from '@/lib/endpoints';

/**
 * ── Result column ────────────────────────────────────────────────────────────
 * Extracted verbatim from `PayrollSimulatorPage.tsx`: the error card, the two
 * result cards (net pay, employer cost), the holiday-accrued note, the
 * warnings, and the "figures in use" reference card. Pure presentation off
 * `result`/`error`/`selectedYear` — no setters, no state of its own.
 *
 * 🔴 ACHU-401, felia 31 — props-urile nu aveau NICIUN tip. Sub `strict: false` asta trece
 * tăcut, iar componenta citea trei obiecte despre care nu se afirma nimic. Acum vin din
 * formele publicate de `payrollSimulatorEndpoints.ts`.
 */
export function PayrollSimulatorResult({ result, error, selectedYear }: {
  /** `null` până se apasă Calculate, sau după o eroare. */
  result: SimulateResponse | null;
  error: string | null;
  /**
   * ⚠️ Anul fiscal al datei de plată alese. `undefined` când data cade în afara anilor pe
   * care aplicația îi cunoaște — ⛔ nu se aproximează, cardul de referință pur și simplu nu
   * se desenează.
   */
  selectedYear: PayrollTaxYearRates | undefined;
}) {
  return (
    <div className="space-y-3">
      {error && (
        <Card className="border-destructive/60"><CardContent className="pt-5 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
          <span>{error}</span>
        </CardContent></Card>
      )}

      {result && (
        <>
          <Card>
            <CardContent className="pt-5 text-sm">
              <p className="text-xs font-semibold tracking-wide text-amber-600 mb-2">SIMULATION — {result.taxYear}</p>

              <div className="flex justify-between py-1">
                <span>Gross</span><span className="font-medium">{fmt(result.employee.gross)}</span>
              </div>
              {result.deductionLines.map((l, i) => (
                <div key={i} className="py-1 border-t">
                  <div className="flex justify-between">
                    <span>{l.label}</span><span>−{fmt(l.amount)}</span>
                  </div>
                  {l.note && <p className="text-xs text-muted-foreground">{l.note}</p>}
                </div>
              ))}
              <div className="flex justify-between py-2 border-t mt-1 text-base font-semibold">
                <span>Net into their account</span><span>{fmt(result.employee.netPay)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-accent/40">
            <CardContent className="pt-5 text-sm">
              <p className="font-medium mb-2">What the person costs, in total</p>
              <div className="flex justify-between py-1"><span>Gross</span><span>{fmt(result.employee.gross)}</span></div>
              {result.employerLines.map((l, i) => (
                <div key={i} className="flex justify-between py-1 border-t"><span>{l.label}</span><span>{fmt(l.amount)}</span></div>
              ))}
              <div className="flex justify-between py-2 border-t mt-1 font-semibold">
                <span>Total cost to the employer</span><span>{fmt(result.employer.totalCost)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                On top of the wage, the person costs a further <strong>{fmt(result.employer.onTopOfWage)}</strong> per
                period. That is the number to build into a price, not the gross wage.
              </p>
            </CardContent>
          </Card>

          {result.holidayAccruedHours != null && (
            <Card><CardContent className="pt-4 text-sm flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span>
                Holiday accrued this period: <strong>{result.holidayAccruedHours} hours</strong> (12.07% of the
                hours worked). It is a legal obligation separate from the wage, and easy to forget when paying by the hour.
              </span>
            </CardContent></Card>
          )}

          {result.warnings?.length > 0 && (
            <Card className="border-amber-400"><CardContent className="pt-4 space-y-2 text-sm">
              {result.warnings.map((w: string, i: number) => (
                <p key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" /><span>{w}</span>
                </p>
              ))}
            </CardContent></Card>
          )}

          <p className="text-xs text-muted-foreground">{result.simulationNotice}</p>
        </>
      )}

      {/* The rates in force, so they can actually be checked against gov.uk. */}
      {selectedYear && (
        <Card><CardContent className="pt-5 text-sm space-y-1">
          <p className="font-medium">The figures in use — {selectedYear.taxYear}</p>
          <p className="text-xs text-muted-foreground mb-1">
            Compare them against gov.uk — search for "rates and thresholds for employers {selectedYear.taxYear.replace('/', ' to 20')}"
            and, separately, "national minimum wage rates". That is everything that needs checking.
          </p>
          <p className="text-xs text-muted-foreground mb-1">
            gov.uk gives the NI thresholds <strong>per week and per month</strong>, not per year — the same
            thresholds, written differently.
            {selectedYear.niThresholdsPerPeriod
              ? ' The per-period figures below are HMRC’s published ones, so they should match the page line for line.'
              : ' The monthly figures below are worked out from the annual one, so they can come out about 50p under HMRC’s published figure; see the note at the bottom.'}
          </p>
          <div className="text-xs space-y-0.5">
            <p>Tax-free allowance: <strong>{fmt(selectedYear.personalAllowance)}</strong>/year</p>
            {/* Shown exactly as the gov.uk EMPLOYER page shows them: "annual
                earnings the rate applies to (above the PAYE threshold)", i.e.
                taxable income. An earlier version added the allowance to make
                them look like the personal-tax page instead, which made the
                45% row read £137,710 and matched neither page. The owner's
                screenshot settled it. */}
            {selectedYear.incomeTaxBands.map(b => (
              <p key={b.label}>
                {b.label}: {b.ratePercent}%{b.to ? ` up to ${fmt(b.to)}` : ` above ${fmt(b.from)}`}
              </p>
            ))}
            <p className="text-muted-foreground">
              The bands are written as income <strong>above the tax-free allowance</strong> — exactly the
              wording in the gov.uk table ("above the PAYE threshold"), so you can compare them line by line.
            </p>
            <p>Employee NI: {selectedYear.niEmployeeMainRatePercent}% above {fmt(selectedYear.niPrimaryThreshold)}/year
              <span className="text-muted-foreground">
                {selectedYear.niThresholdsPerPeriod
                  ? ` (${fmt(selectedYear.niThresholdsPerPeriod.primary.weekly)}/week · ${fmt(selectedYear.niThresholdsPerPeriod.primary.monthly)}/month, as published)`
                  : ` (≈ ${fmt(selectedYear.niPrimaryThreshold / 12)}/month)`}
              </span></p>
            <p>Employer NI: {selectedYear.niEmployerRatePercent}% above {fmt(selectedYear.niSecondaryThreshold)}/year
              <span className="text-muted-foreground">
                {selectedYear.niThresholdsPerPeriod
                  ? ` (${fmt(selectedYear.niThresholdsPerPeriod.secondary.weekly)}/week · ${fmt(selectedYear.niThresholdsPerPeriod.secondary.monthly)}/month, as published)`
                  : ` (≈ ${fmt(selectedYear.niSecondaryThreshold / 12)}/month)`}
              </span></p>
            <p>NI upper earnings limit: {fmt(selectedYear.niUpperEarningsLimit)}/year
              {selectedYear.niThresholdsPerPeriod && (
                <span className="text-muted-foreground">
                  {` (${fmt(selectedYear.niThresholdsPerPeriod.upperEarningsLimit.weekly)}/week · ${fmt(selectedYear.niThresholdsPerPeriod.upperEarningsLimit.monthly)}/month, as published)`}
                </span>
              )}</p>
            <p>Pension qualifying band: {fmt(selectedYear.pensionQualifyingLower)} – {fmt(selectedYear.pensionQualifyingUpper)}/year
              {selectedYear.pensionThresholdsPerPeriod && (
                <span className="text-muted-foreground">
                  {` (${fmt(selectedYear.pensionThresholdsPerPeriod.lower.weekly)} – ${fmt(selectedYear.pensionThresholdsPerPeriod.upper.weekly)}/week · `}
                  {`${fmt(selectedYear.pensionThresholdsPerPeriod.lower.monthly)} – ${fmt(selectedYear.pensionThresholdsPerPeriod.upper.monthly)}/month, as published)`}
                </span>
              )}</p>
            {/* Named as a separate source, not folded into the gov.uk line above.
                These figures are The Pensions Regulator's, on a different site,
                and someone checking the gov.uk page will not find them there. */}
            {selectedYear.pensionFiguresVerified && (
              <p className="text-muted-foreground">
                Pension figures checked against <strong>The Pensions Regulator</strong> (not gov.uk)
                by {selectedYear.pensionFiguresVerified.by.replace(/^[^—]*— /, '')}, {selectedYear.pensionFiguresVerified.on}.
              </p>
            )}
            <p>Minimum wage 21+: <strong>{fmt(selectedYear.minimumWagePerHour.age21Plus)}</strong>/hour · 18–20: {fmt(selectedYear.minimumWagePerHour.age18to20)}/hour · under 18 and apprentices: {fmt(selectedYear.minimumWagePerHour.under18)}/hour</p>
          </div>
          {/* Only shown for a year whose per-period table has NOT been read. Left
              on the screen unconditionally it would describe a rounding the
              engine no longer does — a stale caveat reads as a live one. */}
          {!selectedYear.niThresholdsPerPeriod && (
            <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
              <strong>Small known difference:</strong> HMRC publishes the NI thresholds per period directly
              (e.g. £1,048/month), whereas this divides the annual figure (£1,047.50/month). The ~50p
              difference in the threshold works out at about 4p of NI a month. It goes away once you confirm
              the rates for this year off the gov.uk page, because the published per-period figures are then
              used instead.
            </p>
          )}
        </CardContent></Card>
      )}
    </div>
  );
}

