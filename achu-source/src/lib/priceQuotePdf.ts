import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BRAND_BLUE, PAGE_MARGIN, addDays, drawPdfHeader, drawPdfFooter, drawPdfTotals,
  deliverPdf, fmtCurrency, fmtDocDate, type PdfBusiness, type PdfOutput,
} from './pdfShared';

/**
 * Sesiunea 26 (ACHU-E011/196) — Quote PDF. Owner asked for this to look
 * exactly like the Invoice PDF ("si pe pdfurile din qute vreau fix acelasi
 * format. cu logo si tot. aceleasi culori"), so the header/footer/totals all
 * come from pdfShared.ts — the two documents cannot drift apart.
 *
 * Deliberately dropped from the original standalone achu-quote-calculator
 * generator: the fetched-SVG-converted-to-PNG social media icon footer — real
 * complexity for a cosmetic footer with no bearing on whether the quote is
 * correct.
 */

/**
 * ACHU-564 (Sesiunea 123) — 🔴 **ERA 14, ȘI NIMENI NU DECISESE 14.**
 *
 * Rândul acesta tipărea „Valid until: <emitere + 14 zile>" pe **fiecare PDF de ofertă trimis
 * unui client**, din Sesiunea 26. În tot acest timp, `docs/Backlog_Functionalitati_Viitoare.md`
 * și `scheduledRemindersPolicy.ts` afirmau amândouă că valabilitatea unei oferte e **nedecisă**
 * și că de aceea anunțul de expirare nu se poate construi.
 *
 * ⚠️ **Amândouă documentele erau sincere și amândouă erau false.** Promisiunea exista deja —
 * era doar într-un fișier pe care nimeni nu l-a căutat, fiindcă se căuta o **coloană** în
 * `schema.prisma`, nu o **constantă** într-un generator de PDF. Tiparul 26 întreabă *„există
 * FAPTUL, oriunde?"*; căutarea s-a oprit la bază.
 *
 * ✅ **7 — decizia lui Roberto, 13/08/2026.** Sursa unică e
 * `backend/src/lib/quoteExpiryPolicy.ts`; rândul de aici e o **a doua copie inevitabilă**,
 * fiindcă PDF-ul se generează în browser, și pentru o ofertă încă nesalvată (deci fără server
 * de întrebat). ⛔ **Nu o schimba doar aici** — `scripts/handoff-check.mjs` compară cele două
 * valori și **oprește push-ul** dacă diferă (§3.1b, aplicat între cod și cod).
 */
const QUOTE_VALIDITY_DAYS = 7;

export interface PdfLineItem {
  group: string;
  label: string;
  quantity: number;
  price: number;
  /**
   * §6 „Optional extras" (Sesiunea 160) — poziția e de ales, nu obligatorie.
   *
   * 🔴 **Trebuie scrisă și pe hârtie.** ⛔ Portalul spune „de la £180, plus ce bifezi", iar un PDF
   * care ar fi arătat doar £225 ar fi fost a doua sumă pentru aceeași ofertă — exact contradicția
   * pe care casa o evită ținând împărțirea într-un singur loc pe server.
   */
  optional?: boolean;
}

export interface PdfQuoteData {
  quoteNumber: string;
  createdAt: string; // ISO
  lineItems: PdfLineItem[];
  subtotal: number;
  discountAmount: number;
  grandTotal: number;
  /**
   * §6 (Sesiunea 160) — de la cât pornește, când oferta are poziții de ales. ⚠️ `undefined` = nu
   * are niciuna, iar hârtia arată exact ce arăta înainte.
   */
  startsAt?: number | null;
  /** Draft | Final — shown in the header like the invoice's payment status. */
  quoteStatus?: string | null;
  clientName?: string;
  clientAddress?: string;
  clientPhone?: string;
  clientEmail?: string;
  /** The business's own details, from Invoice Settings — same source as invoices. */
  business?: PdfBusiness;
}

export async function generatePriceQuotePdf(quote: PdfQuoteData, output: PdfOutput = 'download'): Promise<string | void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = PAGE_MARGIN;

  let y = await drawPdfHeader(doc, {
    title: 'QUOTE',
    business: quote.business ?? {},
    metaLines: [
      `Quote #: ${quote.quoteNumber}`,
      `Date: ${fmtDocDate(quote.createdAt)}`,
      `Valid until: ${fmtDocDate(addDays(quote.createdAt, QUOTE_VALIDITY_DAYS))}`,
    ],
    status: quote.quoteStatus ? { label: quote.quoteStatus } : null,
  });

  if (quote.clientName || quote.clientAddress) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Client Details', margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = [
      quote.clientName,
      quote.clientAddress,
      quote.clientPhone,
      quote.clientEmail,
    ].filter((l): l is string => !!l);
    for (const line of lines) { doc.text(line, margin, y); y += 5; }
    y += 5;
  }

  autoTable(doc, {
    head: [['Service', 'Quantity', 'Price']],
    body: quote.lineItems.map(item => [
      `${item.group}\n${item.label}${item.optional ? '\n(optional — yours to take or leave)' : ''}`,
      String(item.quantity), fmtCurrency(item.price),
    ]),
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: BRAND_BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 11 },
    bodyStyles: { fontSize: 10 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: { 2: { halign: 'right' } },
  });

  // jspdf-autotable v5 attaches lastAutoTable to the doc instance.
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  /**
   * 🔴 §6 (Sesiunea 160) — când oferta are poziții de ales, hârtia spune **de la cât pornește**.
   * ⛔ Fără rândul ăsta, „Grand Total" ar fi părut prețul cerut, iar clientul ar fi citit un preț
   * mai mare decât cel la care poate spune „da". ⚠️ Suma se dă gata calculată (`startsAt`), din
   * același loc ca portalul — PDF-ul nu adună nimic singur.
   */
  drawPdfTotals(doc, [
    { label: 'Subtotal', value: fmtCurrency(quote.subtotal) },
    ...(quote.discountAmount > 0 ? [{ label: 'Discount', value: `-${fmtCurrency(quote.discountAmount)}` }] : []),
    ...(quote.startsAt != null ? [{ label: 'Starts at', value: fmtCurrency(quote.startsAt) }] : []),
    { label: quote.startsAt != null ? 'With every extra' : 'Grand Total', value: fmtCurrency(quote.grandTotal), emphasise: true },
  ], y);

  drawPdfFooter(doc, quote.business?.name);
  return deliverPdf(doc, `ACHU-Quote-${quote.quoteNumber}.pdf`, output);
}

