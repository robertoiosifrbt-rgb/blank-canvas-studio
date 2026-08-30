import jsPDF from 'jspdf';
import {
  BRAND_BLUE, PAGE_MARGIN, drawPdfHeader, drawPdfFooter, drawPdfTotals,
  deliverPdf, fmtCurrency, fmtDocDate, type PdfOutput,
} from './pdfShared';

/**
 * Payslip PDF (ACHU-294, Sesiunea 74).
 *
 * Uses the same chrome as the invoice and the price quote — `pdfShared.ts` — so
 * there is one header, one footer and one currency format across every document
 * the company sends out. A second PDF style is a second thing to keep in step.
 *
 * ─── What a payslip legally has to show ───────────────────────────────────
 * Employment Rights Act 1996 s.8: gross pay, the amount and purpose of every
 * variable deduction, and net pay. Since April 2019 it must also show HOURS
 * where pay varies by hours worked — which is the normal case for a cleaner —
 * so `hoursWorked` is printed whenever it is known rather than only on request.
 *
 * ⚠️ THIS DOCUMENT IS STILL STAGE 1. The engine's `isSimulation` is hard-coded
 * true, and the notice below says so on the page itself. A document that looks
 * like a legal record and is not is exactly how stage 1 becomes stage 2 by
 * accident, and a payslip is the most convincing-looking thing this app makes.
 */

export interface PdfPayslipEmployer {
  name?: string | null;
  address?: string | null;
  companyRegNumber?: string | null;
}

export interface PdfPayslipData {
  employer: PdfPayslipEmployer;

  employeeName: string;
  /**
   * ACHU-382. The employee number (`ACHU-001`), the format Archana chose on 04/08/2026 —
   * she named payslips as one of the two places she wanted it.
   *
   * ⚠️ Optional, so a payslip still renders without it. This generator also reprints OLD
   * payslips, and a required field would turn every historical reprint into a crash. The
   * number is safe to print on a reprint even though it was not on the original: it is
   * derived from an id that never changes, so it identifies the same person it always did.
   */
  employeeNumber?: string | null;
  taxCode: string;
  niCategory: string;

  taxYear: string;
  frequency: string;
  periodNumber: number;
  payDate: string;      // ISO
  periodStart: string;  // ISO
  periodEnd: string;    // ISO
  /** Bumped when a period was reopened after being approved or paid. */
  version: number;
  /** Draft | Approved | Locked — a draft payslip must not read as a final one. */
  runStatus: string;

  gross: number;
  incomeTax: number;
  nationalInsurance: number;
  pension: number;
  studentLoan: number;
  postgraduateLoan: number;
  netPay: number;

  grossToDate: number;
  taxToDate: number;

  /** Null for a salaried person: their pay does not vary by hours. */
  hoursWorked?: number | null;

  /** The engine's own lines, so the payslip says what the calculation said. */
  deductionLines?: Array<{ label: string; amountPence: number; note?: string }>;

  /**
   * ACHU-333 (Sesiunea 80m). What made up the gross, and what came off the net.
   *
   * ⚠️ `postTaxDeductions` is not decoration and not optional in law. Employment
   * Rights Act 1996 s.8 requires the amount AND THE PURPOSE of every VARIABLE
   * deduction. A union fee or an advance recovery taken off a wage and absent
   * from the payslip is a breach on its own — and it also makes the page
   * incoherent, because "Total deductions" is gross minus net and would exceed
   * the sum of the lines printed above it.
   *
   * ⚠️ `basicPay` and `earnings` are NOT required by s.8 — it asks for gross,
   * not its parts. They are here because a payslip that shows £2,250 with no
   * explanation is the one that generates the phone call, and the parts are
   * already stored on the line.
   *
   * Both default to absent, which is a real state: runs created before these
   * existed have no breakdown, and inventing one would be worse than omitting it.
   */
  basicPay?: number | null;
  /**
   * ACHU-338 (Sesiunea 80p). Holiday left, in hours, AS AT THE END OF THIS
   * PERIOD — read from the frozen figure on the run line, never worked out here.
   *
   * ⚠️ It will legitimately differ from the balance in the cleaner's portal,
   * which is as at today. Both are right, so the line says WHICH date it is —
   * otherwise the difference reads as a disagreement instead of a date.
   *
   * ⚠️ Absent (null/undefined) for runs from before it was measured, and absent
   * must print NOTHING. Zero is a real and worrying balance; printing it for a
   * run that never measured one would invent a fact.
   */
  holidayRemainingHours?: number | null;
  earnings?: Array<{ label: string; amount: number; note?: string | null }>;
  postTaxDeductions?: Array<{ label: string; amount: number; authority?: string | null; note?: string | null }>;
  /** Anything the office should have looked at. Printed — not silently dropped. */
  warnings?: string[];
}

const SIMULATION_NOTICE =
  'SIMULATION — this payslip was produced by an internal estimating tool. Nothing on it has been ' +
  'submitted to HMRC and it has no legal standing as a statutory pay statement.';

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  'four-weekly': 'Four-weekly',
  monthly: 'Monthly',
};

export async function generatePayslipPdf(p: PdfPayslipData, output: PdfOutput = 'download'): Promise<string | void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = PAGE_MARGIN;

  let y = await drawPdfHeader(doc, {
    // A draft says so in the title. Somebody handed a payslip does not check a
    // status field, and a draft that reads as final is a figure they will plan on.
    title: p.runStatus === 'Draft' ? 'PAYSLIP (DRAFT)' : 'PAYSLIP',
    business: {
      name: p.employer.name,
      address: p.employer.address,
      companyRegNumber: p.employer.companyRegNumber,
    },
    metaLines: [
      `Pay date: ${fmtDocDate(p.payDate)}`,
      `Period: ${FREQUENCY_LABEL[p.frequency] ?? p.frequency} ${p.periodNumber}, ${p.taxYear}`,
      `${fmtDocDate(p.periodStart)} – ${fmtDocDate(p.periodEnd)}`,
      ...(p.version > 1 ? [`Version ${p.version} (reissued)`] : []),
    ],
    status: null,
  });

  // ─── Who this is for ──────────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee', margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(p.employeeNumber ? `${p.employeeName}   ·   ${p.employeeNumber}` : p.employeeName, margin, y);
  y += 5;
  doc.text(`Tax code ${p.taxCode}   ·   NI category ${p.niCategory}`, margin, y);
  y += 5;
  if (p.hoursWorked != null) {
    // Required on a payslip since April 2019 wherever pay varies by hours, which
    // is the normal case here. Printed whenever known rather than on request.
    doc.text(`Hours paid this period: ${p.hoursWorked}`, margin, y);
    y += 5;
  }
  /**
   * ACHU-338. Holiday left, with the date it is true on.
   *
   * ⚠️ The date is not decoration. The cleaner's portal shows the balance as at
   * TODAY and this shows it as at the period end; without saying which, the two
   * read as a disagreement rather than as two answers to different questions —
   * and the person would be right to ask which one to believe.
   *
   * ⚠️ `!= null` and not a truthiness check: **zero hours left is a real balance
   * and the one most worth printing.** `if (p.holidayRemainingHours)` would hide
   * exactly the case somebody needs to see.
   */
  if (p.holidayRemainingHours != null) {
    doc.text(
      `Holiday left as at ${fmtDocDate(p.periodEnd)}: ${p.holidayRemainingHours} hours`,
      margin, y,
    );
    y += 5;
  }
  y += 5;

  doc.setDrawColor(...BRAND_BLUE);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ─── Payments ─────────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Payments', margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  /**
   * ACHU-333. What the gross is MADE OF, above the gross itself.
   *
   * ⚠️ Inside the existing Payments block, not a second one. The first attempt
   * added its own "Payments" heading and the page ended up with two — caught by
   * a test asserting the heading was absent, which found it present.
   *
   * ⚠️ Printed only when the gross is genuinely made of more than one thing. A
   * lone "Basic pay" line equal to the gross adds nothing and pushes the real
   * content down the page. `basicPay == null` means a run from before the
   * breakdown existed: absent, not zero, and not invented.
   *
   * ⚠️ NOT required by ERA 1996 s.8, which asks for gross and not its parts —
   * unlike the deductions below, which are. It is here because £2,250 with no
   * explanation is the payslip that generates the phone call.
   */
  const earningLines = p.earnings ?? [];
  if (p.basicPay != null && earningLines.length > 0) {
    doc.text('Basic pay', margin, y);
    doc.text(fmtCurrency(p.basicPay), pageWidth - margin, y, { align: 'right' });
    y += 5;

    for (const e of earningLines) {
      // The note is what turns "Bonus £250" into something the person can check
      // against what they were told.
      doc.text(e.note ? `${e.label} — ${e.note}` : e.label, margin, y);
      doc.text(fmtCurrency(e.amount), pageWidth - margin, y, { align: 'right' });
      y += 5;
    }
    doc.setFont('helvetica', 'bold');
  }

  doc.text('Gross pay', margin, y);
  doc.text(fmtCurrency(p.gross), pageWidth - margin, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  y += 10;

  // ─── Deductions ───────────────────────────────────────────────────────
  // Every deduction is named and shown separately. The law wants the amount AND
  // the purpose of each one, and a single "deductions" total is the version that
  // nobody can check.
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Deductions', margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const deductions: Array<[string, number]> = [
    ['Income Tax (PAYE)', p.incomeTax],
    ['National Insurance', p.nationalInsurance],
    ['Pension', p.pension],
    ['Student loan', p.studentLoan],
    ['Postgraduate loan', p.postgraduateLoan],
  ];
  let anyDeduction = false;
  for (const [label, amount] of deductions) {
    // A £0.00 line invites "why was I charged nothing?" — so a deduction that
    // does not apply is absent rather than zero.
    if (amount <= 0) continue;
    anyDeduction = true;
    doc.text(label, margin, y);
    doc.text(fmtCurrency(amount), pageWidth - margin, y, { align: 'right' });
    y += 5;
  }
  /**
   * ACHU-333. Post-tax deductions, printed with their purpose.
   *
   * 🔴 REQUIRED BY LAW, not a nicety. ERA 1996 s.8 wants the amount AND the
   * purpose of every variable deduction, and these are the most variable there
   * are. Omitting them was a breach the moment ACHU-331 made them possible — and
   * it would also have left "Total deductions" larger than the lines above it,
   * because that total is gross minus net.
   *
   * ⚠️ The note is printed when there is one. "Advance recovery — March advance"
   * is what a person can check; "Advance recovery" on its own invites the call
   * this line exists to prevent.
   */
  for (const d of p.postTaxDeductions ?? []) {
    if (d.amount <= 0) continue;
    anyDeduction = true;
    doc.text(d.note ? `${d.label} — ${d.note}` : d.label, margin, y);
    doc.text(fmtCurrency(d.amount), pageWidth - margin, y, { align: 'right' });
    y += 5;
  }

  if (!anyDeduction) {
    doc.text('None', margin, y);
    y += 5;
  }
  y += 5;

  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  y = drawPdfTotals(doc, [
    { label: 'Gross pay', value: fmtCurrency(p.gross) },
    { label: 'Total deductions', value: fmtCurrency(p.gross - p.netPay) },
    { label: 'Net pay', value: fmtCurrency(p.netPay), emphasise: true },
  ], y);

  // ─── Year to date ─────────────────────────────────────────────────────
  y += 4;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('This tax year to date', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(`Gross ${fmtCurrency(p.grossToDate)}   ·   Tax ${fmtCurrency(p.taxToDate)}`, margin, y);
  y += 8;

  // ─── Anything the office should have looked at ────────────────────────
  // Printed rather than dropped. A minimum-wage warning that reaches only the
  // office screen is a warning the person it is about never sees.
  if (p.warnings?.length) {
    doc.setFontSize(8);
    doc.setTextColor(150, 60, 0);
    for (const w of p.warnings) {
      const wrapped = doc.splitTextToSize(w, pageWidth - margin * 2) as string[];
      doc.text(wrapped, margin, y);
      y += wrapped.length * 4 + 2;
    }
    doc.setTextColor(0, 0, 0);
    y += 2;
  }

  // ─── The notice that keeps this inside stage 1 ────────────────────────
  doc.setFontSize(8);
  doc.setTextColor(150, 60, 0);
  const notice = doc.splitTextToSize(SIMULATION_NOTICE, pageWidth - margin * 2) as string[];
  doc.text(notice, margin, y);
  doc.setTextColor(0, 0, 0);

  drawPdfFooter(doc, p.employer.name);

  const safeName = p.employeeName.replace(/[^A-Za-z0-9]+/g, '-');
  return deliverPdf(doc, `ACHU-Payslip-${safeName}-${p.taxYear.replace('/', '-')}-P${p.periodNumber}.pdf`, output);
}

