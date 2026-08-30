import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileText, Download, Loader2, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { getCustomerDocuments, signCustomerDocument } from '@/lib/endpoints';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { generateCustomerDocumentPdf, customerDocFilename } from '@/lib/customerDocumentPdf';
import { CUSTOMER_DOCUMENTS, PORTAL_CUSTOMER_DOCUMENTS, type CustomerDocumentKey, type DocCustomer, type DocSettings } from '@/lib/customerDocuments';
import PdfPreviewDialog from '@/components/shared/PdfPreviewDialog';

/**
 * ACHU-475 (Sesiunea 100) — View documents / Sign agreements.
 *
 * Owner: „hai cu customer" — `docs/Backlog_Client_Prioritar.md`, Nivel 1: the
 * customer sees and signs the same three documents Admin already generates
 * from their record (`CustomerDialog.tsx`). Same building blocks, same
 * generator (`generateCustomerDocumentPdf`), same preview dialog — the PDF a
 * customer downloads here must be byte-identical to the one an Admin would
 * generate for them, or the two would disagree in a dispute.
 *
 * ⛔ Signing is only offered for the Service Agreement. The Privacy Notice is
 * a notice, not a two-sided agreement.
 *
 * ⛔ Roberto, Sesiunea 100 continuare: the Consent Form is deliberately NOT
 * offered here at all (see `PORTAL_CUSTOMER_DOCUMENTS` in
 * `customerDocuments.ts`). Its questions are already answered one-by-one,
 * live, in "Your permissions" (`ConsentSettings.tsx`) — the static PDF asks
 * the identical eight questions with blank tick-boxes and no way for an
 * answer on it to ever reach the database. Showing both risked a customer
 * believing they had answered something here that only "Your permissions"
 * actually records. Admin can still generate it for a customer with no
 * portal account (`CustomerDialog.tsx`, `CUSTOMER_DOCUMENTS` there).
 *
 * ⚠️ Once signed against the current template, the sign form is replaced by a
 * read-only line — same one-shot pattern as `QuoteDecision.tsx` once a quote
 * has an answer. A form that stayed live would invite a second, meaningless
 * signature. It reappears only when the agreement text has moved on since
 * they signed (`agreement.templateChanged`).
 */
export default function LegalDocuments() {
  const req = useTrackedRequest<Awaited<ReturnType<typeof getCustomerDocuments>>>({ timeoutMs: 20000 });
  const [previewDoc, setPreviewDoc] = useState<CustomerDocumentKey | null>(null);
  const [signedName, setSignedName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [earlyServiceRequested, setEarlyServiceRequested] = useState(false);
  const [earlyServiceAcknowledged, setEarlyServiceAcknowledged] = useState(false);
  const [signing, setSigning] = useState(false);

  const { fire } = req;
  const load = useCallback(() => { fire(() => getCustomerDocuments()); }, [fire]);
  useEffect(() => { load(); }, [load]);

  if (!req.data && !req.error) {
    return <div className="h-24 animate-pulse rounded-lg bg-muted" />;
  }

  if (req.error && !req.data) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm text-destructive">Could not load your documents.</p>
          <Button variant="outline" size="sm" onClick={load}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const data = req.data!;
  const customer: DocCustomer = data.customer;
  const settings: DocSettings = data.settings as DocSettings;
  const { agreement } = data;
  const needsSignature = !agreement.signed || agreement.templateChanged;

  const sign = async () => {
    setSigning(true);
    try {
      await signCustomerDocument({
        signedName: signedName.trim(),
        // 🔴 ACHU-683 — amprenta termenilor pe care omul tocmai i-a citit pe ecranul ăsta.
        termsSnapshot: agreement.termsSnapshot,
        earlyServiceRequested,
        earlyServiceAcknowledged,
      });
      toast.success('Signed. Thank you.');
      setSignedName('');
      setConfirmed(false);
      setEarlyServiceRequested(false);
      setEarlyServiceAcknowledged(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not save your signature. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Your agreements</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {PORTAL_CUSTOMER_DOCUMENTS.map(d => (
          <div key={d.key} className="border-b border-border pb-3 last:border-b-0 last:pb-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 shrink-0" />{d.label}</p>
              <Button variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setPreviewDoc(d.key)}>
                <Download className="h-3.5 w-3.5 mr-1" />View
              </Button>
            </div>

            {d.key === 'agreement' && !needsSignature && (
              <p className="text-xs text-muted-foreground">
                Signed as &quot;{agreement.signedName}&quot;
                {agreement.signedAt && ` on ${new Date(agreement.signedAt).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' })}`}.
              </p>
            )}

            {d.key === 'agreement' && needsSignature && agreement.signingDisabled && (
              <p className="text-xs text-muted-foreground pt-1">
                Signing is temporarily unavailable while we review the agreement wording. You can still view it above.
              </p>
            )}

            {d.key === 'agreement' && needsSignature && !agreement.signingDisabled && (
              <div className="space-y-2 pt-1">
                {agreement.signed && agreement.templateChanged && (
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    We have updated this agreement since you last signed it (you signed &quot;{agreement.signedName}&quot;
                    {agreement.signedAt && ` on ${new Date(agreement.signedAt).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' })}`}).
                    Please view it again above and re-sign.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Read the Service Agreement and the Cancellation Rights document above, then type your full name below to sign.
                </p>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="agreement-confirm"
                    checked={confirmed}
                    onCheckedChange={v => setConfirmed(v === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="agreement-confirm" className="text-xs font-normal leading-snug">
                    I have read the Service Agreement above and I agree to it.
                  </Label>
                </div>
                {/**
                  * 🔴 ACHU-506 (Sesiunea 108) — OPTIONAL, and that is the fix.
                  *
                  * 📜 ACHU-486 made both of these required to sign at all. The
                  * solicitor, reviewing this flow, found the flaw: a customer whose
                  * first clean is three weeks away was forced to "expressly ask" for
                  * an early start they did not want, purely to be allowed to sign.
                  * A request nobody may refuse is not express — and it destroys the
                  * evidence for the customer who genuinely did ask.
                  *
                  * ⛔ **The two stay COUPLED**, which the solicitor asked for by name:
                  * the acknowledgement is not a generic permission like photos or
                  * marketing, it is the second half of Regulation 36. So the second
                  * box only appears once the first is ticked, and once it appears it
                  * must be ticked — asking for an early start without understanding
                  * what it costs is the one combination the law does not allow.
                  *
                  * ⚠️ Unticking the first clears the second rather than leaving it
                  * set: a stale `true` would be recorded as an acknowledgement of
                  * something the customer just withdrew.
                  */}
                <div className="rounded-md border border-border p-2.5 space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Only if you want us to start sooner — you do not need this to sign.
                  </p>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="agreement-early-service"
                      checked={earlyServiceRequested}
                      onCheckedChange={v => {
                        const on = v === true;
                        setEarlyServiceRequested(on);
                        if (!on) setEarlyServiceAcknowledged(false);
                      }}
                      className="mt-0.5"
                    />
                    <Label htmlFor="agreement-early-service" className="text-xs font-normal leading-snug">
                      I expressly ask ACHU to begin providing the services before the end of my 14-day cancellation period (see Cancellation Rights above).
                    </Label>
                  </div>
                  {earlyServiceRequested && (
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="agreement-early-service-ack"
                        checked={earlyServiceAcknowledged}
                        onCheckedChange={v => setEarlyServiceAcknowledged(v === true)}
                        className="mt-0.5"
                      />
                      <Label htmlFor="agreement-early-service-ack" className="text-xs font-normal leading-snug">
                        I understand that if the service is fully performed during that period, I will lose my right to cancel once it is finished.
                      </Label>
                    </div>
                  )}
                </div>
                <Input
                  aria-label="Type your full name to sign"
                  value={signedName}
                  onChange={e => setSignedName(e.target.value)}
                  placeholder="Type your full name to sign"
                  maxLength={200}
                />
                <Button
                  size="sm"
                  className="text-xs"
                  // ACHU-506: the early-start pair no longer blocks signing — only
                  // the incomplete HALF of it does (asked, but not acknowledged).
                  disabled={signing || !confirmed || (earlyServiceRequested && !earlyServiceAcknowledged) || signedName.trim().length === 0}
                  onClick={sign}
                >
                  {signing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><PenLine className="h-3.5 w-3.5 mr-1" />Sign agreement</>}
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>

      {previewDoc && (
        <PdfPreviewDialog
          open
          onClose={() => setPreviewDoc(null)}
          title={CUSTOMER_DOCUMENTS.find(d => d.key === previewDoc)!.label}
          filename={customerDocFilename(previewDoc, customer.customerName)}
          build={() => generateCustomerDocumentPdf({
            which: previewDoc, customer, settings, today: data.today, output: 'preview',
            /**
             * 🔴 ACHU-510 — the signature goes ONTO the document now. Roberto signed,
             * downloaded his own copy, and found two blank lines: *„nimeni nu vede
             * semnatura?"* It was recorded everywhere except the one place a customer
             * would look.
             *
             * ⛔ Passed only when the signature belongs to THIS text — `needsSignature`
             * is exactly "the agreement has moved on since they signed". Printing a
             * signature on a version they never saw would be worse than none.
             */
            signature: previewDoc === 'agreement' && agreement?.signedName && !needsSignature
              ? {
                signedName: agreement.signedName,
                signedAt: agreement.signedAt,
                templateVersion: agreement.templateVersion,
              }
              : null,
          }) as Promise<string>}
        />
      )}
    </Card>
  );
}

