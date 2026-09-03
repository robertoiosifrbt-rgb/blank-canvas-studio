import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2 } from 'lucide-react';
import { fmtDate, fmt } from '@/lib/format';
import { toast } from 'sonner';
// ACHU-236: the SAME generator the Admin side uses. A customer's invoice must be
// byte-identical to the office's copy, or the two disagree in a dispute.
import { generateInvoicePdf } from '@/lib/invoicePdf';
import { markQuotesViewed } from '@/lib/endpoints';
import QuoteDecision from './QuoteDecision';
import type { PortalInvoice, PortalQuote, PortalQuoteLine } from './portalTypes';

/**
 * ACHU-236 — Documents: invoices and quotes.
 *
 * The PDF is generated in the browser with the same `generateInvoicePdf` the Admin
 * side uses, from snapshot fields already stored on the invoice row. No second
 * implementation, no server-side rendering, and no risk of the customer's copy
 * differing from the office's — which is exactly what you do not want in a dispute.
 *
 * 🔴 ACHU-424 (Sesiunea 93) — and the two copies DID differ, for exactly as long
 * as nobody compared them. Sharing the generator is not the same as passing it
 * the same data: the office side handed it the job's payment status, this side
 * handed it the raw invoice row, and the field simply was not on it. The badge
 * renders only when `paymentStatus` is truthy, so the customer's invoice said
 * neither Paid nor Unpaid — silently, with no error and nothing missing on
 * screen to notice. ⚠️ **The paragraph above was true about the CODE and false
 * about the OUTPUT.** The server now supplies the field (`customerPortal.ts`);
 * the call below is unchanged, which is why the fix is one line there and none
 * here.
 */
export default function Documents({ invoices, quotes, onResponded }: { invoices: PortalInvoice[]; quotes: PortalQuote[]; onResponded?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  /**
   * §6 „Viewed" (Sesiunea 160) — SPUNEM SERVERULUI CE A VĂZUT OMUL, o singură dată pe ofertă.
   *
   * 🔴 **Se anunță ce s-a DESENAT aici** (numărul, totalul, defalcarea), nu ce i s-a trimis: asta e
   * și tot ce poate afirma cinstit un ecran. ⛔ Nu pretinde că a citit PDF-ul — nimeni nu poate
   * proba asta, iar o afirmație mai tare ar ajunge într-o discuție despre bani.
   *
   * ⚠️ **`ref`, nu `state`:** o reîmprospătare a listei nu are voie să retrimită aceleași id-uri, și
   * nici să redeseneze pagina din cauza unei scrieri care nu schimbă nimic pe ecran.
   * ⛔ **Eșecul tace.** Dacă cererea pică, omul își vede în continuare ofertele — un mesaj despre o
   * urmă de vizualizare pe care el n-a cerut-o ar fi zgomot despre treaba biroului.
   */
  const announced = useRef(new Set<string>());
  useEffect(() => {
    const fresh = quotes.map(q => q.id).filter(id => id && !announced.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach(id => announced.current.add(id));
    markQuotesViewed(fresh).catch(() => { /* vezi comentariul de mai sus */ });
  }, [quotes]);

  const download = async (invoice: PortalInvoice) => {
    setBusy(invoice.invoiceNumber);
    try {
      await generateInvoicePdf(invoice, 'download');
    } catch {
      // A failed PDF must not look like a missing invoice.
      toast.error('Could not produce the PDF. Please try again, or ask us to email it.');
    } finally {
      setBusy(null);
    }
  };

  if (invoices.length === 0 && quotes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No documents yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Invoices and quotes will appear here once we send them.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {invoices.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Invoices</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {invoices.map(inv => (
              <div key={inv.invoiceNumber} className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    <span className="font-mono">{inv.invoiceNumber}</span>
                    {/* A void invoice is shown, marked. Hiding it would leave a
                        customer holding a document the portal denies exists. */}
                    {inv.status === 'Void' && <span className="ml-1.5 text-xs font-normal text-muted-foreground line-through">void</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(inv.issuedAt)} • {fmt(inv.grossAmount)}
                    {inv.dueDate && <> • due {fmtDate(inv.dueDate)}</>}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 text-xs" disabled={busy === inv.invoiceNumber} onClick={() => download(inv)}>
                  {busy === inv.invoiceNumber
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <><Download className="h-3.5 w-3.5 mr-1" />PDF</>}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {quotes.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Quotes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {quotes.map(q => (
              <div key={q.quoteNumber} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    <span className="font-mono">{q.quoteNumber}</span>
                    {/*
                      🔴 §6 „Multiple quote options" (Sesiunea 160) — eticheta spune că e o
                      VARIANTĂ. ⛔ Fără ea, trei oferte pe același client se citesc ca trei cereri
                      de bani, nu ca o alegere — exact defectul de la care a pornit rândul.
                    */}
                    {q.optionLabel && (
                      <span className="ml-2 rounded border border-violet-400 px-1.5 py-0.5 text-[10px] font-normal text-violet-700 dark:text-violet-400">
                        {q.optionLabel} — choose one
                      </span>
                    )}
                  </p>
                  <p className="text-sm font-semibold">{fmt(q.grandTotal)}</p>
                </div>
                <p className="text-xs text-muted-foreground">{fmtDate(q.createdAt)}</p>
                {/*
                  ACHU-562 — până când ține prețul.

                  🔴 Propoziția vine ÎNTREAGĂ de la server; ecranul alege doar culoarea. Un
                  text compus aici ar fi al patrulea loc care descrie aceeași expirare.

                  ⛔ Nu se afișează pentru o ofertă la care clientul a răspuns deja
                  (`answered`, cu `label` gol): întrebarea s-a închis, iar un rând despre
                  valabilitate l-ar face să creadă că mai are ceva de făcut.
                */}
                {q.expiry && q.expiry.label && (
                  <p
                    className={
                      q.expiry.status === 'expired'
                        ? 'mt-1 text-xs text-muted-foreground'
                        : q.expiry.status === 'expiring'
                          ? 'mt-1 text-xs font-medium text-amber-700 dark:text-amber-400'
                          : 'mt-1 text-xs text-muted-foreground'
                    }
                  >
                    {q.expiry.label}
                  </p>
                )}
                {/* The breakdown, not just a total — a bare figure invites
                    "what am I paying for?". */}
                {Array.isArray(q.lineItems) && q.lineItems.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {q.lineItems.map((li: PortalQuoteLine, i: number) => (
                      <li key={i} className="flex justify-between text-xs text-muted-foreground">
                        <span className="truncate">{li.label ?? li.field ?? 'Item'}{li.quantity ? ` × ${li.quantity}` : ''}</span>
                        <span className="tabular-nums shrink-0 ml-2">{fmt(li.price)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {q.discountAmount > 0 && (
                  // Shown deliberately: a discount the customer cannot see is a
                  // discount they do not thank you for.
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                    Discount applied: −{fmt(q.discountAmount)}{q.discountPercent ? ` (${q.discountPercent}%)` : ''}
                  </p>
                )}
                {/* ACHU-238: answer the quote. Once answered, the answer replaces the
                    buttons — re-offering them would invite a second tap that the backend
                    refuses anyway, which reads as the app being broken. */}
                <QuoteDecision quote={q} onResponded={onResponded} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

