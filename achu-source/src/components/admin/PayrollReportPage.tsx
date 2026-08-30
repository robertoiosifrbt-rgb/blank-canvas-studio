/**
 * Payroll reports (ACHU-295, Sesiunea 74d).
 *
 * One tax year at a time: what the year cost, what each person cost, and the
 * journal an accountant actually asks for.
 *
 * ─── The two things this screen must not soften ───────────────────────────
 * 1. **Drafts are excluded.** The server says how many it left out and the
 *    screen shows that prominently — a year's wage bill that is quietly
 *    incomplete looks exactly like one that is complete.
 * 2. **The journal carries no nominal codes.** Said on the page, because an
 *    accountant handed a journal will look for them, and "they are missing on
 *    purpose, here is why" is a five-second answer where silence is a phone call.
 *
 * ─── ACHU-339 (Sesiunea 81): holiday and sickness ────────────────────────
 * Two more reports, and they sit OUTSIDE the "payments > 0" branch on purpose.
 * Absence exists whether or not a payroll run has ever been approved — put
 * inside, they would be hidden behind "no approved payroll yet" on exactly the
 * setup where they are the only thing there is to report.
 *
 * They also load separately, so a failure in one report leaves the other on the
 * page rather than blanking both.
 *
 * ─── ACHU-343 (Sesiunea 82): cost by department and by cost centre ───────
 * Two more cards, INSIDE the "payments > 0" branch, unlike the absence ones: a
 * split of the wage bill with no wage bill is nothing, not an empty state worth
 * showing.
 *
 * Two things they must not soften, both mirroring rules already on this page:
 * a row whose label came from the person's CURRENT profile rather than from the
 * run that paid it is marked as such on the row itself, and the server's assertion
 * that the rows add up to the year's total is shown when it fails — a split short
 * by a few rows looks exactly like a complete one.
 *
 * ─── ACHU-340 (Sesiunea 81): family leave ────────────────────────────────
 * A third absence card, and the one place on this page where a number could
 * mislead about money. A small employer reclaims 109% of statutory family pay
 * from HMRC — MORE than it paid out — but the claim goes through an EPS this app
 * does not send. So the page shows what was PAID OUT and what is RECLAIMABLE as
 * two separate figures and never nets them. A net cost would quietly assert that
 * the harder half of the job had been done.
 */
import { useEffect, useState } from 'react';
import { getPayrollReport, getAbsenceReport, downloadPayrollExport, getPensionSchedule, downloadPensionSchedule, type PayrollReportResponse, type AbsenceReportResponse, type PensionScheduleResponse } from '@/lib/endpoints';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { money } from '@/lib/payrollReportFormat';
import { PayrollCostPerPersonCard } from './PayrollCostPerPersonCard';
import { PayrollJournalCard } from './PayrollJournalCard';
import { PayrollCostSplitCard } from './PayrollCostSplitCard';
import { PayrollPeriodByPeriodCard } from './PayrollPeriodByPeriodCard';
import { PayrollHolidayReportCard } from './PayrollHolidayReportCard';
import { PayrollSicknessReportCard } from './PayrollSicknessReportCard';
import { PayrollFamilyLeaveReportCard } from './PayrollFamilyLeaveReportCard';
import { PayrollPensionContributionsCard } from './PayrollPensionContributionsCard';
import { errMsg } from '@/lib/errorMessage';
import LoadingSkeleton from '@/components/shared/LoadingSkeleton';

/** The years the engine holds rates for. Kept in step with payrollRates.ts. */
const TAX_YEARS = ['2026/27', '2025/26'];

export default function PayrollReportPage() {
  const [taxYear, setTaxYear] = useState(TAX_YEARS[0]);
  const [d, setD] = useState<PayrollReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  /** ACHU-339 — its own state, so one report failing does not blank the other. */
  const [a, setA] = useState<AbsenceReportResponse | null>(null);
  const [absenceError, setAbsenceError] = useState<string | null>(null);
  /** ACHU-384 — same reason again: the pension schedule failing must not blank the rest. */
  const [pension, setPension] = useState<PensionScheduleResponse | null>(null);
  const [pensionError, setPensionError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getPayrollReport(taxYear)
      .then(r => { if (live) { setD(r); setError(null); } })
      .catch(e => { if (live) setError(e?.message ?? 'Could not load the report.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [taxYear]);

  useEffect(() => {
    let live = true;
    getAbsenceReport(taxYear)
      .then(r => { if (live) { setA(r); setAbsenceError(null); } })
      .catch(e => { if (live) setAbsenceError(e?.message ?? 'Could not load holiday and sickness.'); });
    return () => { live = false; };
  }, [taxYear]);

  useEffect(() => {
    let live = true;
    getPensionSchedule(taxYear)
      .then(r => { if (live) { setPension(r); setPensionError(null); } })
      .catch(e => { if (live) setPensionError(e?.message ?? 'Could not load the pension contributions.'); });
    return () => { live = false; };
  }, [taxYear]);

  /** ACHU-384 — its own download, because it is not one of the report `kind`s. */
  async function downloadPension() {
    setDownloading('pension');
    try {
      await downloadPensionSchedule(taxYear);
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not download the pension contributions.');
    } finally { setDownloading(null); }
  }

  async function download(
    kind: 'people' | 'journal' | 'holiday' | 'sickness' | 'family' | 'departments' | 'cost-centres',
  ) {
    setDownloading(kind);
    try {
      await downloadPayrollExport(taxYear, kind);
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not download that export.');
    } finally { setDownloading(null); }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Payroll reports</h1>
        <div className="flex items-center gap-2">
          <Label htmlFor="pr-year" className="text-sm">Tax year</Label>
          <Select value={taxYear} onValueChange={setTaxYear}>
            <SelectTrigger id="pr-year" className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TAX_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/**
        * 🆕 §48 „Loading skeletons" (Sesiunea 154) — ultimul ecran care avea o singură linie de text.
        * ⚠️ Payroll e oprit; asta nu e o funcționalitate nouă, e forma ecranului cât se încarcă.
        */}
      {loading && (
        <LoadingSkeleton heights={['h-24', 'h-24']} label="Loading…" />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {d && (
        <>
          {/* Drafts left out — shown before any figure, because the figures below
              are what makes it matter. */}
          {d.notice && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
              <p className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{d.notice}</span>
              </p>
            </div>
          )}

          {d.totals.payments === 0 && (
            <p className="text-sm text-muted-foreground">
              No approved or locked payroll in {taxYear} yet. Runs are approved under
              <strong> Team → Payroll Runs</strong>.
            </p>
          )}

          {d.totals.payments > 0 && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['People paid', String(d.totals.people)],
                  ['Gross', money(d.totals.gross)],
                  ['Net paid', money(d.totals.netPay)],
                  ['Total cost', money(d.totals.totalEmployerCost)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded border p-2">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="font-medium">{value}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {/* Named, because "people paid" is read as headcount and a payment
                    count would be ten times larger for a monthly payroll. */}
                {d.totals.people} {d.totals.people === 1 ? 'person' : 'people'} across {d.totals.payments} payments.
                Total cost is <strong>{money(d.totals.onTopOfWage)}</strong> more than the wages themselves — that is
                employer National Insurance and the employer's pension share.
              </p>

              <PayrollCostPerPersonCard
                people={d.people} downloading={downloading} onDownload={() => download('people')}
              />

              <PayrollJournalCard
                journal={d.journal} journalBalanced={d.journalBalanced} nominalCodesNotice={d.nominalCodesNotice}
                downloading={downloading} onDownload={() => download('journal')}
              />

              {/* ── Cost by department, cost by cost centre (ACHU-343) ─ */}
              {(['departments', 'costCentres'] as const).map(dimension => {
                const split = d[dimension];
                if (!split) return null;
                const isDept = dimension === 'departments';
                const title = isDept ? 'What each department costs' : 'What each cost centre costs';
                const columnHeader = isDept ? 'Department' : 'Cost centre';
                const kind = isDept ? 'departments' as const : 'cost-centres' as const;
                return (
                  <PayrollCostSplitCard
                    key={dimension}
                    title={title} columnHeader={columnHeader} split={split} taxYear={taxYear}
                    downloadKind={kind} downloading={downloading} onDownload={() => download(kind)}
                  />
                );
              })}

              {/* ONCE, under both cards rather than inside each. The sentence
                  applies to both dimensions equally, and printing it twice would
                  make a reader look for the difference between the two copies. */}
              {d.groupingNotice && (d.departments || d.costCentres) && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{d.groupingNotice}</span>
                </p>
              )}

              <PayrollPeriodByPeriodCard periods={d.periods} />
            </>
          )}
        </>
      )}

      {/* ── Holiday and sickness (ACHU-339) ────────────────────────────
          Outside the `payments > 0` branch above, and outside `d` entirely:
          absence is recorded whether or not a payroll has ever been run. */}
      {absenceError && <p className="text-sm text-destructive">{absenceError}</p>}

      {a && (
        <>
          <PayrollHolidayReportCard
            leaveYearLabel={a.leaveYear.label} holiday={a.holiday}
            downloading={downloading} onDownload={() => download('holiday')}
          />

          <PayrollSicknessReportCard
            leaveYearLabel={a.leaveYear.label} sickness={a.sickness}
            downloading={downloading} onDownload={() => download('sickness')}
          />

          <PayrollFamilyLeaveReportCard
            leaveYearLabel={a.leaveYear.label} family={a.family}
            downloading={downloading} onDownload={() => download('family')}
          />

          <PayrollPensionContributionsCard
            pension={pension} pensionError={pensionError}
            downloading={downloading} onDownload={downloadPension}
          />
        </>
      )}
    </div>
  );
}

