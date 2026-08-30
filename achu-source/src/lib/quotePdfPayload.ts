/**
 * §6 „Optional extras" (Sesiunea 160) — CE INTRĂ ÎN PDF-UL UNEI OFERTE, într-un singur loc.
 *
 * ⛔ **De ce un fișier, și nu două apeluri în pagină:** `PriceCalculatorPage` tipărește o ofertă din
 * două locuri — cea calculată acum și una salvată din listă. 🔴 Scrise separat, a doua ar fi rămas
 * în urmă la prima schimbare, iar hârtia ar fi arătat altceva decât ecranul.
 *
 * ⚠️ **Nu calculează niciun preț.** Împărțirea („de la cât pornește") vine gata făcută de la server
 * — aceeași regulă ca la propoziția de expirare: portalul, hârtia și biroul citesc **un** număr.
 */
import type { PdfQuoteData, PdfLineItem } from './priceQuotePdf';

type Split = { baseTotal: number; extras: { field: string }[] } | undefined;

export function quotePdfPayload(
  q: {
    quoteNumber: string; createdAt: string;
    lineItems: (PdfLineItem & { field?: string })[];
    subtotal: number; discountAmount: number; grandTotal: number;
    optionalFields?: string[]; split?: Split;
  },
  clientName?: string,
): PdfQuoteData {
  const optional = new Set(q.optionalFields ?? []);
  return {
    quoteNumber: q.quoteNumber,
    createdAt: q.createdAt,
    lineItems: q.lineItems.map(i => (i.field && optional.has(i.field) ? { ...i, optional: true } : i)),
    subtotal: q.subtotal,
    discountAmount: q.discountAmount,
    grandTotal: q.grandTotal,
    /** ⚠️ Numai când chiar sunt poziții de ales — altfel hârtia rămâne cea de ieri. */
    startsAt: q.split && q.split.extras.length > 0 ? q.split.baseTotal : null,
    clientName,
  };
}

