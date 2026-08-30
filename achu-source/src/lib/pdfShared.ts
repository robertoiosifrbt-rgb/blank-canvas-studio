import jsPDF from 'jspdf';
import logoIcon from '@/assets/logo-icon.png';

/**
 * Sesiunea 26 (ACHU-196) — shared chrome for every PDF the app generates.
 * Owner asked for the Quote PDF to look exactly like the Invoice one ("si pe
 * pdfurile din qute vreau fix acelasi format. cu logo si tot. aceleasi
 * culori"), so the header/footer live here once instead of being duplicated
 * (and drifting) between invoicePdf.ts and priceQuotePdf.ts.
 */

export const COMPANY = {
  phone: '+44 7304 398854',
  email: 'info@achu.uk',
  website: 'www.achu.uk',
};

/** The exact blue sampled from logo-icon.png's pixels (ACHU-195). */
export const BRAND_BLUE: [number, number, number] = [5, 75, 168];
export const PAID_GREEN: [number, number, number] = [40, 140, 60];

// logo-icon.png is 1000x1000 — square.
const LOGO_ASPECT_RATIO = 1;

export const fmtCurrency = (n: number) => `£${n.toFixed(2)}`;
export const fmtDocDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric' });

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function loadImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read logo image'));
    reader.readAsDataURL(blob);
  });
}

/** The business's own identity, as shown on any document. */
export interface PdfBusiness {
  /** The REGISTERED name. Never dropped: a UK document has to identify the company itself. */
  name?: string | null;
  /**
   * §51 „Trading name" (Sesiunea 160) — the name the business actually trades under, when it
   * differs from the registered one.
   *
   * 🔴 When it is set it becomes the HEADLINE, and the registered name moves to a line that
   * says what it is ("Trading name of ACHU Ltd") — so the customer sees the name they know
   * without the document losing the name the law requires on it.
   */
  tradingName?: string | null;
  address?: string | null;
  companyRegNumber?: string | null;
  vatNumber?: string | null;
}

export interface PdfHeaderOptions {
  /** Right-hand title, e.g. "INVOICE" or "QUOTE". */
  title: string;
  business: PdfBusiness;
  /** Right-hand meta lines under the title, e.g. "Invoice #: ...", "Date: ...". */
  metaLines: string[];
  /** Optional emphasised status line under the meta lines (e.g. "Unpaid", "Final"). */
  status?: { label: string; green?: boolean } | null;
}

/**
 * §51 „Trading name" (Sesiunea 160) — THE HEADING of any document: the trading name when the
 * business has one, otherwise the registered name.
 *
 * ⛔ It is a choice of HEADING, never a replacement: `registeredNameLine` puts the registered
 * name back into the block underneath. A document that names only the trading name does not
 * identify the company, which is the same defect ACHU-408 refuses to issue an invoice with.
 *
 * ⚠️ `trim()` and not just a null check: a name typed as a single space is not a trading name,
 * and left unchecked it would produce a document headed by a blank line.
 */
export function businessHeadline(business: PdfBusiness): string | null {
  return business.tradingName?.trim() || business.name?.trim() || null;
}

/**
 * The line that keeps the registered name on the document when the heading is a trading name.
 *
 * ⚠️ Returns null when the two are the same, or when there is no trading name: "Trading name of
 * ACHU Ltd" printed under a heading that already says "ACHU Ltd" reads as a mistake in the
 * document, and a document with a mistake in its own letterhead is one nobody trusts the rest of.
 */
export function registeredNameLine(business: PdfBusiness): string | null {
  const trading = business.tradingName?.trim();
  const registered = business.name?.trim();
  if (!trading || !registered || trading === registered) return null;
  return `Trading name of ${registered}`;
}

export const PAGE_MARGIN = 15;

/**
 * Draws the shared three-column header: business details left (name as a
 * heading matching the title's size/colour), square logo centred between the
 * columns, title + meta + status right. Returns the y to continue from.
 */
export async function drawPdfHeader(doc: jsPDF, opts: PdfHeaderOptions): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = PAGE_MARGIN;
  const centerX = pageWidth / 2;
  const logoWidth = 34;
  const logoHeight = logoWidth / LOGO_ASPECT_RATIO;
  const blockTop = 14;

  try {
    const logoDataUrl = await loadImageAsDataUrl(logoIcon);
    doc.addImage(logoDataUrl, 'PNG', centerX - logoWidth / 2, blockTop, logoWidth, logoHeight);
  } catch {
    doc.setTextColor(...BRAND_BLUE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(businessHeadline(opts.business) || 'ACHU Ltd', centerX, blockTop + 12, { align: 'center' });
  }

  // ─── Left column — business details ───
  // Width-capped so long addresses don't run underneath the centred logo.
  const leftColWidth = centerX - logoWidth / 2 - 6 - margin;
  let y = blockTop + 5;

  const headline = businessHeadline(opts.business);
  if (headline) {
    doc.setTextColor(...BRAND_BLUE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(headline, margin, y);
    y += 9;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const companyLines = [
    registeredNameLine(opts.business),
    opts.business.address,
    COMPANY.phone,
    COMPANY.email,
    opts.business.companyRegNumber ? `Company No: ${opts.business.companyRegNumber}` : null,
    opts.business.vatNumber ? `VAT No: ${opts.business.vatNumber}` : null,
  ].filter((l): l is string => !!l);

  for (const line of companyLines) {
    for (const wrapped of doc.splitTextToSize(line, leftColWidth) as string[]) {
      doc.text(wrapped, margin, y);
      y += 4.6;
    }
  }
  const leftBottom = y;

  // ─── Right column — title + meta + status ───
  let ry = blockTop + 5;
  doc.setTextColor(...BRAND_BLUE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(opts.title, pageWidth - margin, ry, { align: 'right' });
  ry += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  for (const line of opts.metaLines) {
    doc.text(line, pageWidth - margin, ry, { align: 'right' });
    ry += 6;
  }
  if (opts.status) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(opts.status.green ? PAID_GREEN : BRAND_BLUE));
    doc.text(opts.status.label, pageWidth - margin, ry, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    ry += 6;
  }

  y = Math.max(leftBottom + 3, ry + 3, blockTop + logoHeight + 6);
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  return y + 12;
}

/** Draws the shared centred footer at the bottom of the page. */
export function drawPdfFooter(doc: jsPDF, businessName?: string | null): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setTextColor(...BRAND_BLUE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(businessName || 'ACHU Ltd', pageWidth / 2, pageHeight - 15, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${COMPANY.phone}  •  ${COMPANY.email}  •  ${COMPANY.website}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
}

/**
 * Draws the right-aligned totals block — labels and amounts in the same
 * right-hand column as the line-item prices above them (owner request).
 */
export function drawPdfTotals(doc: jsPDF, rows: Array<{ label: string; value: string; emphasise?: boolean }>, startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const amountX = pageWidth - PAGE_MARGIN;
  const labelX = amountX - 40;
  let y = startY;
  for (const row of rows) {
    doc.setFont('helvetica', row.emphasise ? 'bold' : 'normal');
    doc.setFontSize(row.emphasise ? 12 : 10);
    if (row.emphasise) doc.setTextColor(...BRAND_BLUE); else doc.setTextColor(0, 0, 0);
    doc.text(row.label, labelX, y, { align: 'right' });
    doc.text(row.value, amountX, y, { align: 'right' });
    y += 7;
  }
  doc.setTextColor(0, 0, 0);
  return y;
}

/** How a generated PDF should be delivered. */
export type PdfOutput = 'download' | 'preview';

/**
 * Either saves the PDF or returns an object URL for previewing it in an
 * iframe (owner: "vreau sa am preview inainte de download"). Callers that
 * preview are responsible for revoking the URL when done.
 */
export function deliverPdf(doc: jsPDF, filename: string, output: PdfOutput): string | void {
  if (output === 'preview') return URL.createObjectURL(doc.output('blob'));
  doc.save(filename);
}

