import { useState, useEffect } from 'react';
import { getCustomerPortal } from '@/lib/endpoints';
import { withTimeout } from '@/lib/useTrackedRequest';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, ChevronDown, Download, Loader2 } from 'lucide-react';
import { StatusBadge, fmtDate, fmt } from '@/lib/format';
import { toast } from 'sonner';
import { generateReceiptPdf, isReceiptable } from '@/lib/receiptPdf';

/**
 * ACHU-499 (Sesiunea 107) — `Backlog_Client_Prioritar.md`, Nivel 1: "Receipt
 * download". The customer could download the INVOICE (what they owe) and had no
 * way to produce a RECEIPT (what they paid) — the document a landlord, an employer
 * or an insurer asks for, and the one nobody at ACHU can email on a Sunday night.
 *
 * The PDF is generated in the browser by `lib/receiptPdf.ts`, from the payment row
 * the portal already sends. No new endpoint, no stored file, nothing to keep in
 * step: the receipt is a rendering of a payment, so it cannot drift from one.
 *
 * ⛔ The button appears ONLY on a payment that actually moved money — see
 * `isReceiptable`. A `Pending` or `Failed` payment gets no button, because a
 * receipt for money nobody received is a false document and false in the
 * customer's favour.
 */
/**
 * One payment row as the portal sends it (`paymentsSection` in
 * `backend/src/lib/customerPortalAggregation.ts`). Written out rather than left
 * as `any` because the receipt reads six of these fields and a typo in one of
 * them would print a blank line on a financial document instead of failing.
 */
export interface PortalPayment {
  _key: number | string;
  paymentDate: string;
  amount: number;
  paymentStatus: string;
  paymentMethod?: string | null;
  paymentProvider?: string | null;
  externalReference?: string | null;
  linkedJobId?: number | string | null;
}

export default function PaymentsSection({ payments: initialPayments, paymentsHasMore: initialHasMore, customer, business }: {
  payments: PortalPayment[]; paymentsHasMore: boolean;
  customer?: { customerName?: string | null; address?: string | null; postcode?: string | null } | null;
  business?: { name?: string | null; tradingName?: string | null; address?: string | null; companyRegNumber?: string | null; vatNumber?: string | null } | null;
}) {
  const [allPayments, setAllPayments] = useState<PortalPayment[]>(initialPayments);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [receiptBusy, setReceiptBusy] = useState<string | number | null>(null);

  useEffect(() => {
    setAllPayments(initialPayments);
    setHasMore(initialHasMore);
  }, [initialPayments, initialHasMore]);

  const loadMore = async () => {
    setLoadingMore(true);
    setLoadError('');
    try {
      const d = await withTimeout(getCustomerPortal({ paymentOffset: allPayments.length }), 30000);
      const existingKeys = new Set(allPayments.map(p => p._key));
      const newPayments = d.payments.filter((p: PortalPayment) => !existingKeys.has(p._key));
      setAllPayments(prev => [...prev, ...newPayments]);
      setHasMore(d.paymentsHasMore);
    } catch (err) {
      console.warn('[CustomerApp] Failed to load more payments:', err instanceof Error ? err.message : err);
      setLoadError('Failed to load more payments. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  const downloadReceipt = async (p: PortalPayment) => {
    setReceiptBusy(p._key);
    try {
      await generateReceiptPdf({
        paymentId: p._key,
        paymentDate: p.paymentDate,
        amount: p.amount,
        paymentStatus: p.paymentStatus,
        paymentMethod: p.paymentMethod,
        paymentProvider: p.paymentProvider,
        externalReference: p.externalReference,
        linkedJobId: p.linkedJobId,
        customerName: customer?.customerName || 'Customer',
        // The address as the office holds it, postcode included — a receipt with
        // half an address is the one a letting agent sends back.
        customerAddress: [customer?.address, customer?.postcode].filter(Boolean).join(', ') || null,
        business,
      });
    } catch (err) {
      // ⚠️ A failed PDF must not read as "your payment is not recorded". The
      // payment is on the screen behind this message; only the document failed.
      console.warn('[PaymentsSection] Receipt failed:', err instanceof Error ? err.message : err);
      toast.error('Could not produce the receipt just now. Your payment is still recorded — please try again.');
    } finally {
      setReceiptBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {allPayments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CreditCard className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Your payment history will appear here once payments are recorded.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {allPayments.map(p => (
            <Card key={p._key}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{fmt(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(p.paymentDate)}
                      {p.paymentMethod && <> • {p.paymentMethod}</>}
                      {p.paymentProvider && <> ({p.paymentProvider})</>}
                    </p>
                    {p.externalReference && <p className="text-xs text-muted-foreground">Ref: {p.externalReference}</p>}
                    {p.linkedJobId && <p className="text-xs text-muted-foreground">Job #{p.linkedJobId}</p>}
                  </div>
                  <StatusBadge status={p.paymentStatus} />
                </div>
                {/* ACHU-499. Only where money actually moved — see the file header. */}
                {isReceiptable(p.paymentStatus) && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      disabled={receiptBusy === p._key}
                      onClick={() => downloadReceipt(p)}
                    >
                      {receiptBusy === p._key
                        ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Preparing…</>
                        : <><Download className="h-3.5 w-3.5 mr-1" />
                            {p.paymentStatus === 'Refunded' ? 'Refund receipt' : 'Download receipt'}</>}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {loadError && (
            <p className="text-center text-xs text-destructive">{loadError}</p>
          )}
          {hasMore && (
            <Button variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : <><ChevronDown className="h-4 w-4 mr-1" />Load More</>}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

