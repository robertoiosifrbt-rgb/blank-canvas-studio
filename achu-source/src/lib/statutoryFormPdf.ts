import jsPDF from 'jspdf';
import {
  BRAND_BLUE, PAGE_MARGIN, drawPdfHeader, drawPdfFooter,
  deliverPdf, fmtCurrency, fmtDocDate, type PdfOutput,
} from './pdfShared';

/**
 * P60 and P45 as PDFs (ACHU-354, Sesiunea 82).
 *
 * ACHU-350 assembled both documents; this turns them into something a person can
 * hold. That is not a presentation detail — it is the half of the duty that was
 * missing. A P60 must be **given** to everybody still employed on 5 April, by 31 May;
 * a P45 must be **given** without unreasonable delay when somebody leaves. Figures
 * visible to the office discharge neither.
 *
 * ⚠️ **Same chrome as the payslip and the invoice** (`pdfShared.ts`), for the reason
 * that file already exists: one header, one footer, one currency format. A second
 * PDF style is a second thing to keep in step, and the one that falls behind is the
 * one nobody prints often — which is precisely a P60.
 *
 * ⚠️ **Nothing is computed here.** Every figure arrives assembled by
 * `statutoryFormsPolicy` on the server. A PDF that added up its own totals would be
 * a third implementation of a statutory figure, and it would be the one printed
 * onto the document somebody files a tax return from.
 *
 * ─── ⚠️ These are NOT HMRC's own forms ────────────────────────────────────
 * HMRC publishes a P60 layout, and a substitute is allowed only if it carries the
 * required information. This prints the required information in ACHU's own layout,
 * and says on the page that it is a substitute. It does **not** claim to be an
 * HMRC-approved form, because that is an approval nobody has sought.
 */

/** Said on the P60 itself. A document about a tax year has to be keepable. */
const P60_KEEP_NOTICE =
  'Keep this certificate. You will need it if you claim a tax refund, complete a tax return, or apply for a loan or '
  + 'a mortgage. ACHU cannot issue a duplicate marked as an original.';

/**
 * 🔴 ACHU-755 — the Part 1 warning is NOT written here any more.
 *
 * 📜 This file used to hold its own wording of it, beside a `toDateReason` it correctly took
 * from the server. Two versions of one compliance sentence, two rows apart — and they reached
 * the SAME person: the portal showed the server's, the PDF printed this one. ⛔ Now the server
 * composes it once (`P45_PART_1_NOT_SENT`) and this file prints `data.part1NotSent`, exactly as
 * it already prints `data.toDateReason`.
 */

/** A substitute form has to say it is one, on the page rather than in a covering note. */
const SUBSTITUTE_NOTICE =
  'This is a substitute form produced by ACHU, showing the information HMRC requires. It is not an HMRC-printed form.';

export interface PdfFormEmployer {
  employerName?: string | null;
  payeReference?: string | null;
}

export interface PdfP60Data {
  taxYear: string;
  yearEnd: string;
  dueBy: string;
  employer: PdfFormEmployer;
  employee: { name: string; niNumber: string | null; address: string | null };
  thisEmployment: { payPence: number; taxPence: number };
  previousEmployment: { payPence: number; taxPence: number } | null;
  total: { payPence: number; taxPence: number };
  nationalInsurance: Array<{ category: string; employeePence: number; employerPence: number }>;
  studentLoanPounds: number;
  postgraduateLoanPounds: number;
  employeePensionPence: number;
  finalTaxCode: string;
  periods: number;
}

const pounds = (pence: number) => fmtCurrency(pence / 100);

/** A label/value pair table, the shape both forms are almost entirely made of. */
function drawRows(
  doc: jsPDF,
  rows: Array<{ label: string; value: string; emphasise?: boolean }>,
  startY: number,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = startY;
  for (const row of rows) {
    doc.setFont('helvetica', row.emphasise ? 'bold' : 'normal');
    doc.setFontSize(row.emphasise ? 11 : 10);
    doc.setTextColor(row.emphasise ? 0 : 60, row.emphasise ? 0 : 60, row.emphasise ? 0 : 60);
    doc.text(row.label, PAGE_MARGIN, y);
    doc.text(row.value, pageWidth - PAGE_MARGIN, y, { align: 'right' });
    y += row.emphasise ? 7.5 : 6;
  }
  return y;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_BLUE);
  doc.text(title, PAGE_MARGIN, y);
  doc.setTextColor(0, 0, 0);
  return y + 6.5;
}

/** Grey wrapped body text — the notices. Returns the y to continue from. */
function drawNote(doc: jsPDF, text: string, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  let cursor = y;
  for (const line of doc.splitTextToSize(text, pageWidth - PAGE_MARGIN * 2) as string[]) {
    doc.text(line, PAGE_MARGIN, cursor);
    cursor += 4.2;
  }
  doc.setTextColor(0, 0, 0);
  return cursor + 3;
}

export async function generateP60Pdf(data: PdfP60Data, output: PdfOutput = 'download'): Promise<string | void> {
  const doc = new jsPDF();

  let y = await drawPdfHeader(doc, {
    business: { name: data.employer.employerName ?? 'ACHU Ltd', address: null, companyRegNumber: null },
    title: 'P60',
    metaLines: [
      `Tax year ${data.taxYear}`,
      `To 5 April ${data.yearEnd.slice(0, 4)}`,
      data.employer.payeReference ? `PAYE ref ${data.employer.payeReference}` : '',
    ].filter(Boolean),
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('End of Year Certificate', PAGE_MARGIN, y);
  y += 8;

  y = drawSectionTitle(doc, 'Employee', y);
  y = drawRows(doc, [
    { label: 'Name', value: data.employee.name },
    // ⚠️ Never blank. A P60 cannot be issued without an NI number, so this cannot
    // legitimately be empty — but if it ever is, the page has to say so rather than
    // leave a gap somebody reads as "not applicable".
    { label: 'National Insurance number', value: data.employee.niNumber ?? 'NOT RECORDED' },
    ...(data.employee.address ? [{ label: 'Address', value: data.employee.address }] : []),
    { label: 'Final tax code', value: data.finalTaxCode },
    { label: 'Pay periods in the year', value: String(data.periods) },
  ], y) + 4;

  y = drawSectionTitle(doc, 'Pay and Income Tax', y);
  /**
   * ⚠️ Three figures, never one. This employment, the previous one, and the total —
   * kept apart because an employee needs to know which part came from where, and
   * because a single merged number cannot be checked against either employer's
   * payslips. Folding them would look tidier and lose the only thing that makes the
   * document checkable.
   */
  y = drawRows(doc, [
    { label: 'In this employment — pay', value: pounds(data.thisEmployment.payPence) },
    { label: 'In this employment — tax deducted', value: pounds(data.thisEmployment.taxPence) },
    ...(data.previousEmployment
      ? [
        { label: 'In previous employment — pay', value: pounds(data.previousEmployment.payPence) },
        { label: 'In previous employment — tax deducted', value: pounds(data.previousEmployment.taxPence) },
      ]
      : []),
    { label: 'Total pay for the year', value: pounds(data.total.payPence), emphasise: true },
    { label: 'Total tax deducted', value: pounds(data.total.taxPence), emphasise: true },
  ], y) + 4;

  y = drawSectionTitle(doc, 'National Insurance contributions', y);
  if (data.nationalInsurance.length === 0) {
    y = drawRows(doc, [{ label: 'No National Insurance contributions in this year', value: pounds(0) }], y) + 4;
  } else {
    // ⚠️ Split by category letter, which is what a P60 requires — somebody whose
    // category changed mid-year (turning 21, reaching State Pension age) has two
    // rows, and merging them would hide the change.
    y = drawRows(doc, data.nationalInsurance.flatMap(ni => ([
      { label: `Category ${ni.category} — employee contributions`, value: pounds(ni.employeePence) },
      { label: `Category ${ni.category} — employer contributions`, value: pounds(ni.employerPence) },
    ])), y) + 4;
  }

  if (data.studentLoanPounds > 0 || data.postgraduateLoanPounds > 0 || data.employeePensionPence > 0) {
    y = drawSectionTitle(doc, 'Other deductions', y);
    y = drawRows(doc, [
      // ⚠️ Whole POUNDS, and rounded down — HMRC's rule for loan figures on a P60,
      // not a formatting choice. Printed with no pence so it cannot be read as one.
      ...(data.studentLoanPounds > 0
        ? [{ label: 'Student loan deductions (whole pounds)', value: `£${data.studentLoanPounds}` }] : []),
      ...(data.postgraduateLoanPounds > 0
        ? [{ label: 'Postgraduate loan deductions (whole pounds)', value: `£${data.postgraduateLoanPounds}` }] : []),
      ...(data.employeePensionPence > 0
        ? [{ label: 'Your pension contributions', value: pounds(data.employeePensionPence) }] : []),
    ], y) + 4;
  }

  y = drawNote(doc, P60_KEEP_NOTICE, y + 2);
  y = drawNote(doc, `Employer: ${data.employer.employerName ?? 'not recorded'}`
    + `${data.employer.payeReference ? ` · PAYE reference ${data.employer.payeReference}` : ''}`
    + ` · Certificate due to you by ${fmtDocDate(data.dueBy)}.`, y);
  drawNote(doc, SUBSTITUTE_NOTICE, y);

  drawPdfFooter(doc, data.employer.employerName ?? 'ACHU Ltd');
  return deliverPdf(doc, `P60-${data.taxYear.replace('/', '-')}-${data.employee.name.replace(/\s+/g, '-')}.pdf`, output);
}

/**
 * ⚠️ The field names match `statutoryFormsPolicy.P45` exactly, so the screen passes
 * the assembled object straight through. A PDF interface that renamed things would
 * add a mapping step, and a mapping step is where a tax figure gets attached to the
 * wrong label.
 */
export interface PdfP45Data {
  employer: PdfFormEmployer;
  employee: { name: string; niNumber: string | null; address: string | null };
  leavingDate: string;
  taxYear: string;
  taxCode: string;
  /**
   * ⚠️ **ACHU-355, settled: box 7 and box 8 are different figures and the form has
   * both.** Box 7 is the year's cumulative total INCLUDING a previous employer —
   * what the next employer continues the calculation from — and is **null** on a
   * week 1/month 1 code, because HMRC's form says to make no entry. Box 8 is this
   * employer's part, filled in only when it differs.
   *
   * 🔴 Null prints as a blank box, never as £0.00. A zero in box 7 would instruct
   * the next employer to restart the year's cumulation from nothing.
   */
  totalPayToDatePence: number | null;
  totalTaxToDatePence: number | null;
  payInThisEmploymentPence: number | null;
  taxInThisEmploymentPence: number | null;
  weekOrMonth1: boolean;
  toDateReason: string;
  studentLoanDeductions: boolean;
  /**
   * 🔴 ACHU-755 — the Part 1 warning, composed by the server and printed verbatim. ⛔ Not
   * optional: a P45 handed over without it lets somebody assume HMRC was told they left.
   */
  part1NotSent: string;
}

export async function generateP45Pdf(data: PdfP45Data, output: PdfOutput = 'download'): Promise<string | void> {
  const doc = new jsPDF();

  let y = await drawPdfHeader(doc, {
    business: { name: data.employer.employerName ?? 'ACHU Ltd', address: null, companyRegNumber: null },
    title: 'P45',
    metaLines: [
      `Leaving date ${fmtDocDate(data.leavingDate)}`,
      `Tax year ${data.taxYear}`,
      data.employer.payeReference ? `PAYE ref ${data.employer.payeReference}` : '',
    ].filter(Boolean),
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Details of employee leaving work', PAGE_MARGIN, y);
  y += 8;

  y = drawSectionTitle(doc, 'Employee', y);
  y = drawRows(doc, [
    { label: 'Name', value: data.employee.name },
    { label: 'National Insurance number', value: data.employee.niNumber ?? 'NOT RECORDED' },
    ...(data.employee.address ? [{ label: 'Address', value: data.employee.address }] : []),
    { label: 'Leaving date', value: fmtDocDate(data.leavingDate) },
    { label: 'Tax code at leaving', value: data.taxCode },
  ], y) + 4;

  y = drawSectionTitle(doc, `Pay and tax in ${data.taxYear}`, y);
  /**
   * 🔴 **The labels name what the figures ARE, not what a P45 box is called.**
   *
   * `assembleP45` totals ACHU's own committed lines for the tax year of leaving —
   * this employment only. HMRC's own P45 boxes are read by the next employer as the
   * year's figures INCLUDING any earlier employer, and they continue the cumulative
   * calculation from them. If the two readings differ for somebody who worked
   * elsewhere earlier in the year, the next employer starts from too small a figure
   * and the person is under-taxed all the way to 5 April — which is exactly the
   * failure ACHU-328 protects against from the receiving side.
   *
   * ⚠️ So this prints "Pay from ACHU in this tax year", which is true, instead of
   * "Total pay to date", which may not be. Changing what the figure CONTAINS is a
   * compliance decision about a statutory document and belongs to a human: ACHU-355.
   */
  y = drawRows(doc, [
    /**
     * Box 7. ⚠️ Labelled with HMRC's own wording, because the next employer reads it
     * as HMRC's box — and blank, not zero, when there is no cumulative figure.
     */
    {
      label: 'Total pay to date (box 7)',
      value: data.totalPayToDatePence == null ? '— no entry —' : pounds(data.totalPayToDatePence),
      emphasise: true,
    },
    {
      label: 'Total tax to date (box 7)',
      value: data.totalTaxToDatePence == null ? '— no entry —' : pounds(data.totalTaxToDatePence),
      emphasise: true,
    },
    // Box 6 on the form. Printed only when it applies, because it is the reason
    // box 7 is blank and a blank with no explanation reads as an omission.
    ...(data.weekOrMonth1 ? [{ label: 'Week 1 / month 1 basis (box 6)', value: 'X' }] : []),
    // Box 8 — omitted entirely when it equals box 7, which is what the form asks.
    ...(data.payInThisEmploymentPence != null
      ? [{ label: 'Total pay in this employment (box 8)', value: pounds(data.payInThisEmploymentPence) }]
      : []),
    ...(data.taxInThisEmploymentPence != null
      ? [{ label: 'Total tax in this employment (box 8)', value: pounds(data.taxInThisEmploymentPence) }]
      : []),
    { label: 'Student loan deductions to continue', value: data.studentLoanDeductions ? 'Yes' : 'No' },
  ], y) + 4;

  // 🔴 Said on the page, because the next employer is the one who acts on box 7 —
  // and `toDateReason` is why box 7 is blank, or excludes an earlier employer.
  y = drawNote(doc, data.toDateReason, y);

  // 🔴 ACHU-755: the server's sentence, not one of ours. See the note at the top.
  y = drawNote(doc, data.part1NotSent, y + 2);
  y = drawNote(doc, 'Parts 1A, 2 and 3 are shown together on this page. Part 1A is your copy — keep it. '
    + 'Parts 2 and 3 are for your next employer.', y);
  drawNote(doc, SUBSTITUTE_NOTICE, y);

  drawPdfFooter(doc, data.employer.employerName ?? 'ACHU Ltd');
  return deliverPdf(doc, `P45-${data.employee.name.replace(/\s+/g, '-')}.pdf`, output);
}

