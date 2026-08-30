import jsPDF from 'jspdf';
import {
  PAGE_MARGIN, drawPdfHeader, drawPdfFooter, deliverPdf, fmtDocDate, type PdfOutput,
} from './pdfShared';
import type { DocSettings } from './customerDocuments';

/**
 * Sesiunea 97 — a printable record of a customer's consent history.
 *
 * Same header/footer chrome as the invoice, the quote and the customer
 * documents, for the same reason the owner gave when the quote PDF was built:
 * anything that leaves the office should not look like it was typed in Word.
 *
 * ─── Why this exists ──────────────────────────────────────────────────────
 * `CustomerConsentsSection.tsx` shows the full history on screen, but a
 * consent record is exactly the kind of thing that sometimes needs to leave
 * the screen — attached to a complaint response, handed to an insurer, kept
 * outside the app. The route already returns the whole trail; this just
 * prints it.
 */
export interface ConsentHistoryEntry {
  label: string;
  granted: boolean;
  recordedAt: string;
}

export interface ConsentHistoryPdfInput {
  customerName: string;
  history: ConsentHistoryEntry[];
  settings: DocSettings;
  /** ISO date the document is dated. Defaults to today. */
  today?: string;
  output?: PdfOutput;
}

const LINE = 7;

/** Bottom limit before a new page is needed. The footer lives below this. */
const bottomLimit = (doc: jsPDF) => doc.internal.pageSize.getHeight() - 28;

export function consentHistoryPdfFilename(customerName: string): string {
  const who = customerName.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  return `achu-permissions-history-${who || 'customer'}.pdf`;
}

export async function generateConsentHistoryPdf(input: ConsentHistoryPdfInput): Promise<string | void> {
  const todayIso = input.today ?? new Date().toISOString().slice(0, 10);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = await drawPdfHeader(doc, {
    title: 'PERMISSIONS HISTORY',
    business: {
      name: input.settings.businessLegalName,
      address: input.settings.businessAddress,
      companyRegNumber: input.settings.companyRegistrationNumber,
    },
    metaLines: [`Customer: ${input.customerName}`, `Generated: ${fmtDocDate(todayIso)}`],
  });

  y += 8;

  const room = (needed: number) => {
    if (y + needed <= bottomLimit(doc)) return;
    drawPdfFooter(doc, input.settings.businessLegalName);
    doc.addPage();
    y = PAGE_MARGIN + 5;
  };

  if (input.history.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text('No consent has been recorded for this customer yet.', PAGE_MARGIN, y);
    y += LINE;
  } else {
    // Newest first, as the screen shows it — this is a record of events, not
    // a form, so the most recent act belongs at the top.
    for (const h of input.history) {
      room(LINE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(h.label, PAGE_MARGIN, y);

      doc.setFont('helvetica', 'normal');
      const rightText = `${h.granted ? 'Agreed' : 'Said no / withdrew'} — ${fmtDocDate(h.recordedAt)}`;
      doc.setTextColor(h.granted ? 40 : 120, h.granted ? 140 : 120, h.granted ? 60 : 120);
      doc.text(rightText, pageWidth - PAGE_MARGIN, y, { align: 'right' });

      y += LINE;
    }
  }

  drawPdfFooter(doc, input.settings.businessLegalName);
  return deliverPdf(doc, consentHistoryPdfFilename(input.customerName), input.output ?? 'download');
}

