import jsPDF from 'jspdf';
import {
  PAGE_MARGIN, drawPdfHeader, drawPdfFooter, drawPdfTotals,
  deliverPdf, fmtCurrency, fmtDocDate, type PdfOutput,
} from './pdfShared';

/**
 * ACHU-499, Sesiunea 107 — the receipt. `Backlog_Client_Prioritar.md`, Nivel 1:
 * "Receipt download — clientul descarcă chitanța/dovada de plată, nu doar factura."
 *
 * 🔴 **A receipt is not a small invoice.** An invoice says *you owe this*; a receipt
 * says *we received this*. The customer already had the first and had no way to
 * produce the second — the one document a landlord, an employer or an insurer asks
 * for, and the one nobody at ACHU can email at 9pm on a Sunday.
 *
 * Three rules are deliberate and none of them is cosmetic:
 *
 * ⛔ **Only money that actually moved gets a document.** `Received` and `Refunded`
 *    are the two states where it did. A `Pending`, `Failed` or `Cancelled` payment
 *    produces NOTHING — a receipt for money nobody received is a false document, and
 *    it would be false in the customer's favour, which is exactly the direction that
 *    reaches a court. The caller enforces it too (`RECEIPTABLE_STATUSES` below is the
 *    single list both sides read).
 *
 * ⚠️ **No VAT breakdown, and the document says why.** Payments in this app hang off a
 *    Job, not off an Invoice, so there is no VAT snapshot to read — and the amount
 *    received can be a part payment across several invoices at different rates.
 *    Splitting it here would mean INVENTING a tax figure. The invoice is the VAT
 *    document; the receipt says so in a line of its own so that a business customer
 *    reclaiming VAT is sent to the right piece of paper instead of the wrong one.
 *
 * ⚠️ **The business identity is TODAY's, not a snapshot at payment time.** Invoices
 *    carry `businessNameSnapshot` and friends on the row precisely so an issued
 *    invoice cannot change afterwards; a Payment has no such columns and adding them
 *    would be a migration that only helps payments taken after it. A receipt reprinted
 *    after the company address changes therefore shows the new address — which is
 *    what the customer needs in order to contact ACHU, and is what a duplicate
 *    receipt from any till in the country does. Recorded here rather than discovered
 *    later.
 */

/** The only two payment states a receipt may be produced for. Read by the UI too. */
export const RECEIPTABLE_STATUSES = ['Received', 'Refunded'] as const;

export type ReceiptableStatus = (typeof RECEIPTABLE_STATUSES)[number];

export function isReceiptable(paymentStatus: string | null | undefined): boolean {
  return !!paymentStatus && (RECEIPTABLE_STATUSES as readonly string[]).includes(paymentStatus);
}

export interface PdfReceiptData {
  /** The payment's own number. NOT a new sequence — see the note in the body. */
  paymentId: number | string;
  paymentDate: string; // ISO
  amount: number;
  paymentStatus: string;
  paymentMethod?: string | null;
  paymentProvider?: string | null;
  externalReference?: string | null;
  /** The job this payment was against, by its visible number, when there is one. */
  linkedJobId?: number | string | null;
  customerName: string;
  customerAddress?: string | null;
  business?: {
    name?: string | null;
    /** §51 — numele comercial, când e altul decât cel înregistrat. Îl însoțește, nu îl înlocuiește. */
    tradingName?: string | null;
    address?: string | null;
    companyRegNumber?: string | null;
    vatNumber?: string | null;
  } | null;
}

export async function generateReceiptPdf(receipt: PdfReceiptData, output: PdfOutput = 'download'): Promise<string | void> {
  /**
   * ⛔ Refused rather than rendered. A caller that gets this wrong is a bug, and the
   * failure has to be loud: a silently blank or half-drawn receipt would still be
   * saved to the customer's phone and shown to somebody later.
   */
  if (!isReceiptable(receipt.paymentStatus)) {
    throw new Error(`A receipt can only be issued for a payment that was received or refunded (this one is ${receipt.paymentStatus || 'unknown'}).`);
  }

  const refunded = receipt.paymentStatus === 'Refunded';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = PAGE_MARGIN;

  let y = await drawPdfHeader(doc, {
    title: refunded ? 'REFUND RECEIPT' : 'RECEIPT',
    business: {
      name: receipt.business?.name,
      tradingName: receipt.business?.tradingName,
      address: receipt.business?.address,
      companyRegNumber: receipt.business?.companyRegNumber,
      vatNumber: receipt.business?.vatNumber,
    },
    metaLines: [
      /**
       * The PAYMENT's number, reused. Not a receipt sequence of its own: a
       * gap-free sequential counter is a compliance-critical thing (see
       * `InvoiceSettings.nextInvoiceNumber`, which is row-locked and never reset),
       * and inventing a second one in a browser — where two devices would happily
       * mint the same number — is how a document series stops being evidence.
       * One payment, one receipt, one number that already exists on both sides.
       */
      `Receipt for payment #${receipt.paymentId}`,
      `Date: ${fmtDocDate(receipt.paymentDate)}`,
    ],
    status: { label: refunded ? 'Refunded' : 'Paid', green: !refunded },
  });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(refunded ? 'Refunded to' : 'Received from', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(receipt.customerName, margin, y);
  y += 5;
  if (receipt.customerAddress) {
    const lines = doc.splitTextToSize(receipt.customerAddress, 90);
    doc.text(lines, margin, y);
    y += lines.length * 5;
  }
  y += 6;

  // ─── What the money was for, and how it arrived ───
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Details', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');

  const details = [
    receipt.linkedJobId ? `For: cleaning services, job #${receipt.linkedJobId}` : 'For: cleaning services',
    receipt.paymentMethod
      ? `Paid by: ${receipt.paymentMethod}${receipt.paymentProvider ? ` (${receipt.paymentProvider})` : ''}`
      : null,
    receipt.externalReference ? `Reference: ${receipt.externalReference}` : null,
  ].filter((l): l is string => !!l);

  for (const line of details) {
    doc.text(line, margin, y);
    y += 5;
  }
  y += 6;

  y = drawPdfTotals(doc, [
    { label: refunded ? 'Amount refunded' : 'Amount received', value: fmtCurrency(receipt.amount), emphasise: true },
  ], y);
  y += 4;

  /**
   * ⚠️ The sentence that stops this document being used as the wrong one. Said
   * plainly, in the customer's terms, rather than as a disclaimer nobody reads.
   */
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  const note = refunded
    ? 'This confirms a refund was made to you. It is not a VAT document — where VAT applies, your invoice is the VAT document.'
    : 'This confirms we received the amount above. It is not a VAT invoice — where VAT applies, your invoice is the VAT document. It does not by itself show whether anything else remains outstanding on your account.';
  doc.text(doc.splitTextToSize(note, pageWidth - margin * 2), margin, y);

  drawPdfFooter(doc, receipt.business?.name);

  return deliverPdf(doc, `receipt-${receipt.paymentId}.pdf`, output);
}

