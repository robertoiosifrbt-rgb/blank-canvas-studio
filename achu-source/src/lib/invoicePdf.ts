import jsPDF from 'jspdf';
import {
  BRAND_BLUE, PAGE_MARGIN, drawPdfHeader, drawPdfFooter, drawPdfTotals,
  deliverPdf, fmtCurrency, fmtDocDate, type PdfOutput,
} from './pdfShared';

/**
 * Sesiunea 26 (ACHU-191/193/195/196) — Invoice PDF. All the shared chrome
 * (three-column header with the centred square logo, brand colour, footer,
 * right-aligned totals) lives in pdfShared.ts, used identically by
 * priceQuotePdf.ts.
 *
 * The VAT breakdown appears only when the business was VAT-registered at the
 * time of issue (vatRatePercent snapshot present) — see the Invoice model in
 * schema.prisma for why every business/customer field here is a snapshot
 * rather than a live settings lookup.
 */

export interface PdfInvoiceData {
  invoiceNumber: string;
  issuedAt: string; // ISO
  dueDate?: string | null; // ISO
  paymentStatus?: string | null; // derived live from the Job's real Payments — see JobInvoicesSection.tsx
  description: string;
  netAmount: number;
  vatRatePercent?: number | null;
  vatAmount: number;
  grossAmount: number;
  status: string;
  customerNameSnapshot: string;
  customerAddressSnapshot?: string | null;
  businessNameSnapshot?: string | null;
  /** §51 — the trading name AS IT WAS when the invoice was issued. */
  tradingNameSnapshot?: string | null;
  businessAddressSnapshot?: string | null;
  companyRegNumberSnapshot?: string | null;
  vatNumberSnapshot?: string | null;
}

export async function generateInvoicePdf(invoice: PdfInvoiceData, output: PdfOutput = 'download'): Promise<string | void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = PAGE_MARGIN;

  let y = await drawPdfHeader(doc, {
    title: invoice.status === 'Void' ? 'INVOICE (VOID)' : 'INVOICE',
    business: {
      name: invoice.businessNameSnapshot,
      tradingName: invoice.tradingNameSnapshot,
      address: invoice.businessAddressSnapshot,
      companyRegNumber: invoice.companyRegNumberSnapshot,
      vatNumber: invoice.vatNumberSnapshot,
    },
    metaLines: [
      `Invoice #: ${invoice.invoiceNumber}`,
      `Date: ${fmtDocDate(invoice.issuedAt)}`,
      ...(invoice.dueDate ? [`Due: ${fmtDocDate(invoice.dueDate)}`] : []),
    ],
    status: invoice.paymentStatus ? { label: invoice.paymentStatus, green: invoice.paymentStatus === 'Paid' } : null,
  });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To', margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.customerNameSnapshot, margin, y);
  y += 5;
  if (invoice.customerAddressSnapshot) { doc.text(invoice.customerAddressSnapshot, margin, y); y += 5; }
  y += 8;

  doc.setDrawColor(...BRAND_BLUE);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.text(invoice.description, margin, y);
  doc.text(fmtCurrency(invoice.netAmount), pageWidth - margin, y, { align: 'right' });
  y += 10;

  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  y = drawPdfTotals(doc, [
    { label: 'Net Amount', value: fmtCurrency(invoice.netAmount) },
    ...(invoice.vatRatePercent != null ? [{ label: `VAT (${invoice.vatRatePercent}%)`, value: fmtCurrency(invoice.vatAmount) }] : []),
    { label: 'Total Due', value: fmtCurrency(invoice.grossAmount), emphasise: true },
  ], y);

  if (invoice.status === 'Void') {
    doc.setTextColor(200, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('VOID — NOT A VALID INVOICE', pageWidth / 2, y + 10, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }

  drawPdfFooter(doc, invoice.businessNameSnapshot);
  return deliverPdf(doc, `ACHU-Invoice-${invoice.invoiceNumber}.pdf`, output);
}

