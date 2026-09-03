import { useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { getMyPayslips, type MyPayslipsResponse, type Payslip } from '@/lib/endpoints';
import { generatePayslipPdf } from '@/lib/payslipPdf';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fmt, fmtDate } from '@/lib/format';

/**
 * ACHU-335 (Sesiunea 80n) — the cleaner's own payslips, downloadable.
 *
 * ─── Why this is the build, and not an email ────────────────────────────────
 * Employment Rights Act 1996 s.8 requires the worker to RECEIVE a payslip at or
 * before payday. It does not say by email: a payslip in a secure account they can
 * reach counts as given. Archana chose this on 02/08/2026 over an email service,
 * which would have cost money, needed DNS changes on achu.uk, and required the
 * PDF generator to be rebuilt on the server — the PDF is built in the browser.
 *
 * ⚠️ Which is exactly why the download works the way it does: the SAME generator
 * the office uses (`generatePayslipPdf`) runs here, on data the server sends from
 * the stored line. Not a second, simpler payslip for employees — one payslip, one
 * generator. Two would drift, and the one that drifted would be the one the person
 * being paid is holding.
 *
 * ⚠️ Loaded separately from the rest of the page. Up to sixty run lines with their
 * earnings and deductions must not hold up the holiday balance, which is what
 * somebody opens this tab for.
 */
export function PayslipsSection() {
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; data: MyPayslipsResponse } | { kind: 'error' }>({ kind: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getMyPayslips()
      .then(r => { if (alive) setState({ kind: 'ready', data: r }); })
      .catch(() => { if (alive) setState({ kind: 'error' }); });
    return () => { alive = false; };
  }, []);

  if (state.kind === 'loading') return <Skeleton className="h-28 rounded-xl" />;

  // ⚠️ Silent on failure, deliberately. The rest of the page is the reason a
  // cleaner opened this tab; a red error block over the payslips would make a
  // working page look broken. The Refresh button retries everything.
  if (state.kind === 'error') return null;

  const list = state.kind === 'ready' ? state.data.payslips : [];

  async function download(p: Payslip) {
    setBusy(p.id);
    try {
      await generatePayslipPdf({
        employer: state.kind === 'ready' ? (state.data.employer ?? {}) : {},
        employeeName: p.nameSnapshot ?? '',
        // ACHU-382. So the payslip an employee downloads says the same thing as the one
        // the office prints — two generators would drift, two payloads must not.
        employeeNumber: p.employeeNumber ?? null,
        taxCode: p.taxCode,
        niCategory: p.niCategory,
        taxYear: p.taxYear,
        frequency: p.frequency,
        periodNumber: p.periodNumber,
        payDate: p.payDate,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        version: p.version,
        runStatus: p.runStatus,
        gross: p.gross,
        basicPay: p.basicPay,
        holidayRemainingHours: p.holidayRemainingHours,
        earnings: p.earnings,
        incomeTax: p.incomeTax,
        nationalInsurance: p.nationalInsurance,
        pension: p.pension,
        studentLoan: p.studentLoan,
        postgraduateLoan: p.postgraduateLoan,
        postTaxDeductions: p.postTaxDeductions,
        netPay: p.netPay,
        grossToDate: p.grossToDate,
        taxToDate: p.taxToDate,
        hoursWorked: p.hoursWorked,
      });
    } finally { setBusy(null); }
  }

  return (
    <section className="bg-card border border-border rounded-xl p-4" aria-labelledby="pay-payslips">
      <div className="flex items-center gap-2 mb-3">
        <FileDown className="h-4 w-4 text-muted-foreground shrink-0" />
        <h2 id="pay-payslips" className="font-medium text-sm">Your payslips</h2>
      </div>

      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {/* Says WHY it is empty. "No payslips" alone reads as a broken page to
              somebody who knows they have been paid. */}
          Nothing here yet. A payslip appears once the office has approved the pay run it belongs to.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map(p => (
            <li key={p.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{fmt(p.netPay)}<span className="text-muted-foreground font-normal"> take-home</span></p>
                <p className="text-xs text-muted-foreground">
                  Paid {fmtDate(p.payDate)} · {p.taxYear} period {p.periodNumber}
                </p>
              </div>
              <Button
                variant="outline" size="sm" className="min-h-[44px] shrink-0"
                aria-label={`Download payslip for ${fmtDate(p.payDate)}`}
                disabled={busy === p.id}
                onClick={() => download(p)}
              >
                <FileDown className="h-4 w-4 mr-1.5" />PDF
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

