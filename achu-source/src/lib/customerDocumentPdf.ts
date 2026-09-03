import jsPDF from 'jspdf';
import {
  BRAND_BLUE, PAGE_MARGIN, drawPdfHeader, drawPdfFooter, deliverPdf,
  fmtDocDate, type PdfOutput,
} from './pdfShared';
import {
  CUSTOMER_DOCUMENTS, type CustomerDoc, type CustomerDocumentKey,
  type DocBlock, type DocCustomer, type DocSettings,
  type RecordedSignature,
} from './customerDocuments';

/**
 * ACHU-413 (Sesiunea 92) — rendering a customer document to PDF.
 *
 * Same header, same footer, same brand colour as the invoice and the quote, for
 * the reason the owner gave when the quote PDF was built (*„fix acelasi format.
 * cu logo si tot"*): a customer should not be able to tell which of these came
 * out of the app and which was typed in Word.
 *
 * ─── Why a renderer and not one function per document ────────────────────
 * The three documents differ only in their words. Keeping the words in
 * `customerDocuments.ts` as data means a change to the agreement's wording
 * cannot accidentally reformat the consent form, and the page-break logic —
 * the only genuinely fiddly part — exists once instead of three times.
 */

const LINE = 5;
const GAP = 3;

/** Bottom limit before a new page is needed. The footer lives below this. */
const bottomLimit = (doc: jsPDF) => doc.internal.pageSize.getHeight() - 28;

export interface CustomerDocPdfInput {
  which: CustomerDocumentKey;
  customer: DocCustomer;
  settings: DocSettings;
  /** ISO date the document is dated. Defaults to today. */
  today?: string;
  output?: PdfOutput;
  /**
   * ACHU-510 — a signature already given, to be STATED on the document instead of
   * leaving blank lines. Only the Service Agreement uses it; the caller is
   * responsible for passing it only when it belongs to this version of the text.
   */
  signature?: RecordedSignature | null;
}

/**
 * The download name, in one place.
 *
 * ⚠️ It was briefly in two: here and in `CustomerDialog`, which passes a
 * filename to the preview dialog. Two copies of a naming rule drift, and the
 * drift shows up as a preview called one thing saving as another.
 */
export function customerDocFilename(which: CustomerDocumentKey, customerName?: string | null): string {
  const entry = CUSTOMER_DOCUMENTS.find(d => d.key === which);
  const slug = entry ? entry.build({}, {}, '').slug : which;
  const who = (customerName ?? '').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  return `achu-${slug}-${who || 'customer'}.pdf`;
}

export function buildCustomerDoc(
  which: CustomerDocumentKey, customer: DocCustomer, settings: DocSettings, todayIso: string,
  signature?: RecordedSignature | null,
): CustomerDoc {
  const entry = CUSTOMER_DOCUMENTS.find(d => d.key === which);
  // Not a silent fallback: a mistyped key must fail loudly here rather than
  // hand somebody a Service Agreement they did not ask for.
  if (!entry) throw new Error(`Unknown customer document: ${which}`);
  // ACHU-510: only the agreement takes a signature; the others ignore the extra
  // argument, which is why this stays one call rather than a branch per document.
  return entry.build(customer, settings, fmtDocDate(todayIso), signature);
}

export async function generateCustomerDocumentPdf(input: CustomerDocPdfInput): Promise<string | void> {
  const todayIso = input.today ?? new Date().toISOString().slice(0, 10);
  const doc_ = buildCustomerDoc(input.which, input.customer, input.settings, todayIso, input.signature);
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;

  let y = await drawPdfHeader(pdf, {
    title: doc_.title,
    business: {
      name: input.settings.businessLegalName,
      address: input.settings.businessAddress,
      companyRegNumber: input.settings.companyRegistrationNumber,
    },
    metaLines: [`Date: ${fmtDocDate(todayIso)}`],
  });

  /** Starts a new page when the next `needed` mm would run into the footer. */
  const room = (needed: number) => {
    if (y + needed <= bottomLimit(pdf)) return;
    drawPdfFooter(pdf, input.settings.businessLegalName);
    pdf.addPage();
    y = PAGE_MARGIN + 5;
  };

  const paragraph = (body: string, indent = 0) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    const lines: string[] = pdf.splitTextToSize(body, contentWidth - indent);
    for (const line of lines) {
      // ⚠️ Room is checked per LINE, not per paragraph. Checking per paragraph
      // is what puts a lone last line on its own page, and a long clause could
      // outrun a whole page and be silently drawn over the footer.
      room(LINE);
      pdf.text(line, PAGE_MARGIN + indent, y);
      y += LINE;
    }
    y += GAP;
  };

  const block = (b: DocBlock) => {
    switch (b.kind) {
      case 'heading':
        room(LINE * 2);
        y += 2;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(...BRAND_BLUE);
        pdf.text(b.text, PAGE_MARGIN, y);
        pdf.setTextColor(0, 0, 0);
        y += LINE + 1;
        break;

      case 'para':
        paragraph(b.text);
        break;

      case 'bullets':
        for (const item of b.items) {
          room(LINE);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          pdf.text('•', PAGE_MARGIN + 1, y);
          paragraph(item, 6);
        }
        break;

      case 'fields':
        for (const row of b.rows) {
          room(LINE);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.text(`${row.label}:`, PAGE_MARGIN, y);
          pdf.setFont('helvetica', 'normal');
          const valueX = PAGE_MARGIN + 58;
          const lines: string[] = pdf.splitTextToSize(row.value, contentWidth - 58);
          for (const [i, line] of lines.entries()) {
            if (i > 0) { room(LINE); }
            pdf.text(line, valueX, y);
            y += LINE;
          }
        }
        y += GAP;
        break;

      case 'ticks':
        room(LINE);
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(9);
        pdf.text(b.intro, PAGE_MARGIN, y);
        y += LINE;
        for (const row of b.rows) {
          room(LINE);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          pdf.text(row.label, PAGE_MARGIN + 2, y);
          paragraph(row.detail, 16);
        }
        break;

      case 'note': {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(9);
        const lines: string[] = pdf.splitTextToSize(b.text, contentWidth - 8);
        room(lines.length * LINE + 6);
        const boxTop = y - 4;
        pdf.setDrawColor(200, 200, 200);
        pdf.setFillColor(248, 248, 248);
        pdf.roundedRect(PAGE_MARGIN, boxTop, contentWidth, lines.length * LINE + 6, 2, 2, 'FD');
        pdf.setTextColor(90, 90, 90);
        for (const line of lines) {
          pdf.text(line, PAGE_MARGIN + 4, y + 1);
          y += LINE;
        }
        pdf.setTextColor(0, 0, 0);
        y += GAP + 3;
        break;
      }

      /**
       * ACHU-510 — a signature that was actually given. Boxed and stated, not ruled
       * lines: the whole point is that this one does NOT look like somewhere to sign.
       */
      case 'signed': {
        room(10 + b.lines.length * 5);
        y += 6;
        const boxTop = y;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 0);
        let ly = y + 7;
        for (const line of b.lines) {
          for (const wrapped of pdf.splitTextToSize(line, contentWidth - 8)) {
            pdf.text(wrapped, PAGE_MARGIN + 4, ly);
            ly += 5;
          }
        }
        pdf.setDrawColor(120, 120, 120);
        pdf.rect(PAGE_MARGIN, boxTop, contentWidth, ly - boxTop - 1);
        y = ly + 3;
        break;
      }
      case 'signature': {
        room(28);
        y += 6;
        const half = contentWidth / 2 - 4;
        pdf.setDrawColor(120, 120, 120);
        pdf.line(PAGE_MARGIN, y + 12, PAGE_MARGIN + half, y + 12);
        pdf.line(PAGE_MARGIN + half + 8, y + 12, PAGE_MARGIN + contentWidth, y + 12);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(90, 90, 90);
        pdf.text(pdf.splitTextToSize(b.left, half), PAGE_MARGIN, y + 16);
        pdf.text(pdf.splitTextToSize(b.right, half), PAGE_MARGIN + half + 8, y + 16);
        pdf.setTextColor(0, 0, 0);
        y += 24;
        break;
      }
    }
  };

  for (const b of doc_.blocks) block(b);
  drawPdfFooter(pdf, input.settings.businessLegalName);

  return deliverPdf(pdf, customerDocFilename(input.which, input.customer.customerName), input.output ?? 'download');
}

