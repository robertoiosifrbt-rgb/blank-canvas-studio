/**
 * Sesiunea 47 (ACHU-218) — erasing a customer's personal data.
 *
 * This screen is deliberately slow to get through. It is the only irreversible
 * action in the app that destroys data on purpose, so it is built as
 * **preview → read → type the word → do it**, not as a button with a confirm.
 *
 * Three things are on the screen rather than in a document, because the person
 * clicking will be the one who has to justify it later:
 *
 * 1. **What stays, and why.** Including the awkward answer: the customer's name
 *    and address remain on their invoices, because a UK invoice has to show who
 *    it was issued to. Someone will be asked that question; the reason should not
 *    have to be looked up.
 * 2. **Why it is refused,** when it is — with what to do about it, not just "no".
 * 3. **The free text nobody can judge automatically.** Notes on payments explain
 *    money, so they are kept — but they might name a person, so they are listed
 *    afterwards for a human to read.
 */
import { useEffect, useState } from 'react';
import { previewCustomerAnonymisation, anonymiseCustomer } from '@/lib/endpoints';
import type { AnonymisePreview, AnonymiseResult } from '@/lib/gdprEndpoints';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertCircle, ShieldAlert, Loader2, Check, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { errMsg } from '@/lib/errorMessage';

type Props = {
  open: boolean;
  customerId: string;
  customerName: string;
  onClose: () => void;
  /** Fired after a successful erasure so the caller can reload — the name changed. */
  onDone: () => void;
};

/**
 * ACHU-401 (Sesiunea 115), înlocuit la felia 21: cele două forme le publică acum
 * `gdprEndpoints.ts`, citite din evaluarea care le produce.
 *
 * 🔴 **Erau ÎNGUSTE, și îngustimea a costat:** tipul de aici numea „doar câmpurile randate mai
 * jos" — deci un câmp trimis de server și **neafișat** nu avea cum să se vadă. Exact așa a stat
 * `willDelete` nefolosit de la ACHU-494 până la ACHU-749: rândurile care dispar CU TOTUL (casele
 * clientului, preferințele de curățător, pozele) nu ajungeau pe ecranul de dinaintea unei
 * acțiuni ireversibile. ⛔ Un tip care descrie doar ce se desenează nu poate spune ce lipsește.
 */
export default function AnonymiseCustomerDialog({ open, customerId, customerName, onClose, onDone }: Props) {
  const [preview, setPreview] = useState<AnonymisePreview>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnonymiseResult>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPreview(null); setError(null); setConfirmation(''); setReason(''); setResult(null); setShowDetail(false);
    previewCustomerAnonymisation({ customerId })
      .then(setPreview)
      .catch((e: unknown) => setError(errMsg(e) ?? 'Could not check.'));
  }, [open, customerId]);

  const phrase: string = preview?.confirmationPhrase ?? 'ANONYMISE';
  const ready = preview?.canProceed
    && confirmation.trim().toUpperCase() === phrase
    && reason.trim().length >= 3;

  async function run() {
    setBusy(true);
    try {
      const res = await anonymiseCustomer({ customerId, confirmation, reason: reason.trim() });
      setResult(res);
      toast.success('Personal data erased. Invoices and payments were retained.');
      onDone();
    } catch (e) {
      toast.error(errMsg(e) ?? 'Could not do it.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Erase personal data — {customerName}
          </DialogTitle>
          <DialogDescription>
            For when a customer asks for their data to be erased (GDPR). The personal data goes,
            the invoices and payments stay. <strong>This cannot be undone.</strong>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{error}
          </div>
        )}
        {!preview && !error && <Skeleton className="h-48 w-full" />}

        {/* ── Done ─────────────────────────────────────────────── */}
        {result && (
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{result.summary}</span>
            </div>

            {(result.manualReview?.payments?.length > 0
              || result.manualReview?.recurringContracts?.length > 0
              || result.manualReview?.subscriptions?.length > 0) && (
              <Card className="border-amber-300">
                <CardContent className="pt-4 space-y-2">
                  <p className="font-medium">For you to read now</p>
                  <p className="text-xs text-muted-foreground">{result.manualReview.why}</p>
                  {result.manualReview.payments?.map(p => (
                    <p key={`p${p.paymentId}`} className="text-xs border-l-2 pl-2">
                      <strong>Payment #{p.paymentId}:</strong> {p.notes ?? ''} {p.correctionNotes ?? ''}
                    </p>
                  ))}
                  {result.manualReview.recurringContracts?.map(r => (
                    <p key={`r${r.recurringSeriesId}`} className="text-xs border-l-2 pl-2">
                      <strong>Contract #{r.recurringSeriesId}:</strong> {r.notes}
                    </p>
                  ))}
                  {result.manualReview.subscriptions?.map(s => (
                    <p key={`s${s.subscriptionId}`} className="text-xs border-l-2 pl-2">
                      <strong>Subscription #{s.subscriptionId}:</strong> {s.notes ?? ''} {s.cancellationReason ?? ''}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}

            {/*
              🔴 22/08/2026 — **CE A SCRIS FIRMA ȘI RĂMÂNE** (hotărârea la ACHU-774 / 761 / 764).
              ⚠️ Card SEPARAT de cel de sus, deliberat: acolo motivul e „explică bani", aici e „poate
              numi altcineva". ⛔ Puse împreună sub o singură propoziție, cea de sus ar fi devenit
              falsă pentru jumătate din rânduri, iar cine le citește ar fi tăiat după motivul greșit.
            */}
            {(result.manualReview?.incidents?.length
              || result.manualReview?.qualityChecks?.length
              || result.manualReview?.incidentPhotos?.length) ? (
              <Card className="border-amber-300">
                <CardContent className="pt-4 space-y-2">
                  <p className="font-medium">What we wrote, and kept</p>
                  <p className="text-xs text-muted-foreground">{result.manualReview.whyRecords}</p>
                  {result.manualReview.incidents?.map(i => (
                    <div key={`i${i.incidentId}`} className="text-xs border-l-2 pl-2 space-y-0.5">
                      <p><strong>Incident #{i.incidentId}</strong></p>
                      {i.witnesses && <p>Who saw it: {i.witnesses}</p>}
                      {i.investigation && <p>What we found out: {i.investigation}</p>}
                      {i.immediateAction && <p>Straight away: {i.immediateAction}</p>}
                      {i.correctiveAction && <p>Put right: {i.correctiveAction}</p>}
                      {i.preventiveAction && <p>Changed: {i.preventiveAction}</p>}
                      {i.costNote && <p>Cost: {i.costNote}</p>}
                    </div>
                  ))}
                  {result.manualReview.qualityChecks?.map(q => (
                    <p key={`q${q.jobQualityCheckId}`} className="text-xs border-l-2 pl-2">
                      <strong>Quality check #{q.jobQualityCheckId}:</strong> {q.correctiveAction}
                    </p>
                  ))}
                  {result.manualReview.incidentPhotos?.map(p => (
                    <p key={`ip${p.incidentId}`} className="text-xs border-l-2 pl-2">
                      <strong>Incident #{p.incidentId}:</strong> {p.photos} photograph{p.photos === 1 ? '' : 's'} kept
                      {' '}— open the incident to look at them, and delete any that are only about this customer.
                    </p>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {/*
              🔴 ACHU-773 — spus pe ecran, fiindcă e prima scriere peste un rând de audit din toată
              aplicația: rândurile rămân, doar numele omului devine o etichetă.
            */}
            {result.rowsTouched?.auditRowsRelabelled > 0 && (
              <p className="text-xs text-muted-foreground">
                {result.rowsTouched.auditRowsRelabelled} audit row
                {result.rowsTouched.auditRowsRelabelled === 1 ? '' : 's'} no longer name them: the history stays,
                the email is replaced by a label.
              </p>
            )}
          </div>
        )}

        {/* ── Before ───────────────────────────────────────────── */}
        {preview && !result && (
          <div className="space-y-4 text-sm">
            {!preview.canProceed && (
              <Card className="border-destructive/60">
                <CardContent className="pt-4 space-y-2">
                  <p className="font-medium text-destructive">Not possible yet</p>
                  {preview.blockers.map(b => (
                    <p key={b.code} className="text-sm">{b.message}</p>
                  ))}
                </CardContent>
              </Card>
            )}

            {preview.warnings?.map((w: string) => (
              <Card key={w} className="border-amber-300"><CardContent className="pt-4 text-sm">{w}</CardContent></Card>
            ))}

            <div className="grid grid-cols-2 gap-2">
              <Card><CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Data cleared from</p>
                <p>{preview.scope.jobs} jobs · {preview.scope.quoteRequests} quote requests</p>
                <p>{preview.scope.customerRequests} customer requests · {preview.scope.loginAccounts} login accounts</p>
                {/**
                  * 🔴 ACHU-550 — cele două rânduri care se CALCULAU și nu ajungeau nicăieri.
                  *
                  * Numărul de fotografii era trimis de server de la ACHU-494 și nu a fost
                  * niciodată afișat; notele de vizită nici măcar nu erau numărate (ACHU-537
                  * le raportează abia în răspunsul de DUPĂ ștergere). Amândouă sunt exact
                  * tiparul ACHU-536: cod care se calculează și pe care nu-l vede nimeni.
                  *
                  * ⚠️ Iar aici nu e o curiozitate: fotografiile se șterg **cu fișier cu tot**
                  * și nu se pot recupera, deci sunt lucrul cel mai grav de pe ecran — cifra
                  * trebuie citită ÎNAINTE de a se tasta cuvântul de confirmare, nu în
                  * raportul de după, când nu se mai poate anula nimic.
                  */}
                <p className="mt-1 font-medium">
                  {preview.scope.propertyPhotos} property photos deleted permanently, file included
                </p>
                <p>{preview.scope.ratingComments} job ratings — the comment is cleared, the score stays</p>
                {/*
                  * 🔴 ACHU-749 — A TREIA OARĂ ACELAȘI GOL, după ACHU-537 și ACHU-550, și pe cel
                  * mai greu lucru de pe ecran: astea nu sunt câmpuri golite, sunt RÂNDURI care
                  * dispar. Casa se șterge întreagă — adresa, codul de la poartă, câte camere are
                  * — iar vizitele rămân fără ea. ⛔ Ștergerea le raporta în cifrele de DUPĂ;
                  * previzualizarea nu le număra deloc, deci nimeni nu le vedea cât timp mai
                  * putea încă renunța.
                  */}
                <p className="font-medium">
                  {preview.scope.properties} property record{preview.scope.properties === 1 ? '' : 's'} deleted — address, gate code, layout
                </p>
                <p>{preview.scope.cleanerPreferences} cleaner preferences deleted, reason included</p>
                {/*
                  🔴 22/08/2026 (hotărârea la ACHU-761 / 774) — **arătate ÎNAINTE, în aceeași felie în
                  care au început să fie șterse.** ⛔ De patru ori până acum ștergerea raporta ceva ce
                  previzualizarea nu număra, iar biroul tasta cuvântul de confirmare fără să știe ce
                  dispare (ACHU-537, 550, 749, §32).
                */}
                {(preview.scope.internalNotes ?? 0) > 0 && (
                  <p>{preview.scope.internalNotes} internal notes on jobs — the text is cleared, the score stays</p>
                )}
                {(preview.scope.qualityCheckFindings ?? 0) > 0 && (
                  <p>{preview.scope.qualityCheckFindings} quality checks — what we saw is cleared; what we did about our own people stays</p>
                )}
                {(preview.scope.incidents ?? 0) > 0 && (
                  <p>
                    {preview.scope.incidents} incident record{preview.scope.incidents === 1 ? '' : 's'} — the description goes,
                    the date and how serious it was stay, and what we wrote while dealing with it is kept for you to read
                  </p>
                )}
              </CardContent></Card>
              <Card><CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Retained</p>
                <p>{preview.retainedCounts.invoices} invoices · {preview.retainedCounts.payments} payments</p>
                <p className="text-xs text-muted-foreground mt-1">Required to be kept for HMRC (roughly six years).</p>
              </CardContent></Card>
            </div>

            {/* The awkward answer, on the screen and not in a document. */}
            <Card className="bg-accent/40"><CardContent className="pt-4 text-sm">
              <p className="font-medium">What stays, even after erasure</p>
              <p className="text-muted-foreground mt-1">
                The customer's name and address stay <strong>on their invoices</strong>. A UK invoice has to show
                who it was issued to — blank the name and it stops being a valid document, which is the very
                obligation the records are kept for. The right to erasure yields where the law requires retention.
              </p>
              <p className="text-muted-foreground mt-2">
                The <strong>audit trail</strong> stays too, including the record of this erasure — that is the
                evidence the customer's request was honoured.
              </p>
            </CardContent></Card>

            <Button type="button" variant="ghost" size="sm" onClick={() => setShowDetail(v => !v)}>
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              {showDetail ? 'Hide the full list' : 'See exactly which fields go and which stay'}
            </Button>

            {showDetail && (
              <div className="space-y-3 text-xs border rounded-md p-3 max-h-72 overflow-y-auto">
                <div>
                  <p className="font-medium mb-1">Cleared ({preview.willClear.length})</p>
                  {preview.willClear.map(f => (
                    <p key={`${f.model}.${f.field}`} className="mb-1">
                      <span className="font-mono">{f.model}.{f.field}</span> — <span className="text-muted-foreground">{f.reason}</span>
                    </p>
                  ))}
                </div>
                {/*
                  * ACHU-749. Lista era trimisă de la ACHU-494 și nu se desena nicăieri, deși
                  * politica spune chiar de ce e separată de cea de deasupra: „deosebirea
                  * contează pentru cine citește ecranul". Un câmp golit lasă rândul acolo;
                  * aici nu mai rămâne nimic de golit.
                  */}
                <div>
                  <p className="font-medium mb-1">Deleted outright ({preview.willDelete.length})</p>
                  {preview.willDelete.map(r => (
                    <p key={r.model} className="mb-1">
                      <span className="font-mono">{r.model}</span> — {r.what} <span className="text-muted-foreground">{r.reason}</span>
                    </p>
                  ))}
                </div>
                <div>
                  <p className="font-medium mb-1">Retained ({preview.willRetain.length})</p>
                  {preview.willRetain.map(f => (
                    <p key={`${f.model}.${f.field}`} className="mb-1">
                      <span className="font-mono">{f.model}.{f.field}</span> — <span className="text-muted-foreground">{f.reason}</span>
                    </p>
                  ))}
                </div>
                <div>
                  <p className="font-medium mb-1">Kept, but for you to read ({preview.needsManualReview.length})</p>
                  {preview.needsManualReview.map(f => (
                    <p key={`${f.model}.${f.field}`} className="mb-1">
                      <span className="font-mono">{f.model}.{f.field}</span> — <span className="text-muted-foreground">{f.reason}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            {preview.canProceed && (
              <div className="space-y-3 border-t pt-3">
                <div>
                  <Label htmlFor="anonymisec-what-did-the-customer">What did the customer ask for?</Label>
                  <Textarea id="anonymisec-what-did-the-customer"
                    rows={2} value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="e.g. asked by email on 30/07 for their data to be erased"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Required. A year from now somebody will ask why this record is blank — this will be the only answer.
                  </p>
                </div>
                <div>
                  <Label htmlFor="anonymisec-type-to-confirm">Type <span className="font-mono font-semibold">{phrase}</span> to confirm</Label>
                  <Input id="anonymisec-type-to-confirm" value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder={phrase} />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{result ? 'Close' : 'Cancel'}</Button>
          {!result && (
            <Button variant="destructive" disabled={!ready || busy} onClick={run}>
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Erasing…</> : 'Erase personal data'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

