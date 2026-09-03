import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Lock, Loader2, Paperclip} from 'lucide-react';
import { issueInvoice, getInvoices, voidInvoice } from '@/lib/endpoints';
import { generateInvoicePdf } from '@/lib/invoicePdf';
import PdfPreviewDialog from '../shared/PdfPreviewDialog';
import { ApiError } from '@/lib/apiClient';
// §33 (Sesiunea 161) — aceeași secțiune ca pe firmă, vizită și ofertă.
import DocumentsSection from '@/components/shared/DocumentsSection';
import { fmtDate } from '@/lib/format';
import { toast } from 'sonner';

/**
 * Sesiunea 26 (ACHU-191) — "buton de facturare in job" (owner request).
 * Issuing creates a real, immutable Invoice row (sequential number, never
 * reused) and immediately downloads its PDF. Mistakes are corrected by
 * voiding, never by deleting — see Invoice model comment in schema.prisma.
 *
 * ACHU-192: the backend sends Decimal fields (netAmount/vatAmount/
 * grossAmount/vatRatePercent) as strings — same as every other Decimal
 * field in this app (see handleDownloadRowPdf in PriceCalculatorPage.tsx,
 * which already does `Number(row.subtotal)` for exactly this reason).
 * toPdfData() below does the same coercion for invoices. This was missing
 * on the very first version of this file: issuing an invoice actually
 * succeeded on the server, but `netAmount.toFixed` then threw a plain
 * TypeError (a string has no .toFixed), which the old single try/catch
 * mis-reported as "Failed to issue invoice." — misleading, and risked a
 * duplicate invoice if the Admin believed it failed and clicked again.
 * The create step and the PDF step are now handled separately so a PDF
 * problem can never again be reported as an issuance failure.
 */
/**
 * ACHU-401 (Sesiunea 115), înlocuit la felia 20: forma o publică acum `billingEndpoints.ts`,
 * scrisă cap-coadă din modelul `Invoice` — nu un colț din el.
 *
 * ⚠️ Motivul pentru care tipul de aici trebuia oricum să fie ÎNTREG: `toPdfData` împrăștie tot
 * obiectul în `PdfInvoiceData`, deci un tip îngust nu doar sub-descrie, ci face împrăștierea să
 * nu compileze. `tsc` a prins exact asta când a fost scris. ⛔ Iar banii sosesc ca ȘIRURI, de
 * unde și `Number(...)` de mai jos — nu e redundant.
 */
import type { InvoiceRecord as InvoiceRow } from '@/lib/billingEndpoints';

function toPdfData(inv: InvoiceRow, paymentStatus?: string | null) {
  return {
    ...inv,
    netAmount: Number(inv.netAmount),
    vatAmount: Number(inv.vatAmount),
    grossAmount: Number(inv.grossAmount),
    vatRatePercent: inv.vatRatePercent != null ? Number(inv.vatRatePercent) : null,
    // Sesiunea 26 (ACHU-194): "Paid" is never stored on the Invoice itself —
    // it's read live from the Job's real Payments (same paymentStatus
    // computed in jobs.ts and already shown in JobDialog's Financial
    // Summary), so an invoice can never claim "Paid" when nothing was
    // actually received, or vice versa.
    paymentStatus: paymentStatus ?? null,
  };
}

export default function JobInvoicesSection({ jobId, amountCharged, paymentStatus }: { jobId: string; amountCharged: number; paymentStatus?: string }) {
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  /** §33 — care factură își arată hârtiile. Una singură deodată: lista rămâne citibilă. */
  const [openDocs, setOpenDocs] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvoiceRow | null>(null);
  // 🔴 ACHU-591 — lista serverului e plafonată, iar propoziția care o spune vine DE LA server
  // (`lib/listCap.ts`): două ecrane care își compun separat aceeași frază încep să difere.
  const [listNote, setListNote] = useState<string | null>(null);

  const load = () => {
    getInvoices({ jobId })
      .then(d => { setInvoices(d.records); setListNote(d.listNote ?? null); })
      .catch(() => setInvoices([]));
  };
  useEffect(load, [jobId]);

  const handleIssue = async () => {
    setIssuing(true);
    let created: InvoiceRow;
    try {
      created = (await issueInvoice({ jobId })).invoice;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to issue invoice.');
      setIssuing(false);
      return;
    }
    toast.success(`Invoice ${created.invoiceNumber} issued`);
    load();
    setIssuing(false);
    setPreview(created);
  };

  const handleDownload = (inv: InvoiceRow) => setPreview(inv);

  const handleVoid = async (inv: InvoiceRow) => {
    if (!confirm(`Void invoice ${inv.invoiceNumber}? This cannot be undone — the number stays reserved and is never reused.`)) return;
    setVoidingId(inv.id);
    try {
      await voidInvoice(inv.id);
      toast.success(`Invoice ${inv.invoiceNumber} voided`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to void invoice.');
    } finally {
      setVoidingId(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Invoices</p>
      {listNote && <p className="text-xs text-amber-600">{listNote}</p>}
      {invoices === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices issued yet for this job.</p>
      ) : (
        <div className="space-y-1">
          {invoices.map(inv => (
            <div key={inv.id} className="space-y-2 bg-muted/40 rounded-lg p-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{inv.invoiceNumber}</span>
                <span className="text-muted-foreground">£{Number(inv.grossAmount).toFixed(2)}</span>
                <Badge variant={inv.status === 'Void' ? 'outline' : 'default'}>{inv.status}</Badge>
                {inv.status !== 'Void' && paymentStatus && (
                  <Badge variant={paymentStatus === 'Paid' ? 'default' : 'outline'}>{paymentStatus}</Badge>
                )}
                {inv.dueDate && <span className="text-xs text-muted-foreground">Due {fmtDate(inv.dueDate)}</span>}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Preview PDF" onClick={() => handleDownload(inv)}><FileText className="h-3.5 w-3.5" /></Button>
                {inv.status !== 'Void' && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Void invoice" onClick={() => handleVoid(inv)} disabled={voidingId === inv.id}>
                    {voidingId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  </Button>
                )}
                {/*
                  §33 (Sesiunea 161) — hârtiile atașate unei facturi: contractul semnat, dovada
                  livrării, corespondența pe care se sprijină suma. ⛔ **Se desface pe loc**, nu într-un
                  ecran nou: bugetul de pachete (ACHU-808) nu suportă un al patrulea ecran pentru o
                  listă pe care o desenează deja `DocumentsSection`.
                */}
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  title="Documents"
                  aria-expanded={openDocs === inv.id}
                  onClick={() => setOpenDocs(openDocs === inv.id ? null : inv.id)}
                >
                  <Paperclip className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {openDocs === inv.id && (
              <div className="border-t pt-2">
                <DocumentsSection scope="Invoice" ownerId={inv.id} title={`Documents for ${inv.invoiceNumber}`} />
              </div>
            )}
            </div>
          ))}
        </div>
      )}
      {amountCharged > 0 ? (
        <Button variant="outline" size="sm" onClick={handleIssue} disabled={issuing}>
          {issuing ? 'Issuing…' : 'Issue Invoice'}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Set an Amount Charged above, then save, to be able to issue an invoice.</p>
      )}

      {preview && (
        <PdfPreviewDialog
          open
          onClose={() => setPreview(null)}
          title={`Invoice ${preview.invoiceNumber}`}
          filename={`ACHU-Invoice-${preview.invoiceNumber}.pdf`}
          build={async () => (await generateInvoicePdf(toPdfData(preview, paymentStatus), 'preview')) as string}
        />
      )}
    </div>
  );
}

