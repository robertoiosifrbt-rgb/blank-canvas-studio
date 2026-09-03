import { useEffect, useRef, useState } from 'react';
import { getInvoiceSettings, saveInvoiceSettings } from '@/lib/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ApiError } from '@/lib/apiClient';
import { toast } from 'sonner';
import RefreshButton from '../shared/RefreshButton';
import PageHeader from '../shared/PageHeader';
import LoadingSkeleton from '@/components/shared/LoadingSkeleton';

/**
 * Sesiunea 26 (ACHU-191) — the business's own identity used on every
 * invoice, editable here instead of hardcoded. Owner confirmed ACHU is not
 * VAT-registered today, but wants the option ready for later — the VAT
 * fields stay editable (and greyed out when the checkbox is off) so
 * turning it on is a settings change, not a code change.
 */
/**
 * ACHU-420. An empty box is "nobody has decided yet"; a typed 0 is a decision.
 * `Number('')` is 0, so the obvious one-liner silently turns the first into the
 * second — and this feeds a contract, where "no late-cancellation charge" and
 * "we have not agreed one" are different sentences.
 */
const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));
const int = (v: string): number | null => (v.trim() === '' ? null : parseInt(v, 10));

export default function InvoiceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    businessLegalName: '', tradingName: '', businessAddress: '', companyRegistrationNumber: '',
    vatRegistered: false, vatNumber: '', vatRatePercent: '', invoiceNumberPrefix: 'INV',
    paymentTermsDays: '14',
    // ACHU-420 — the customer agreement's terms.
    businessPhone: '', insurerName: '', insurancePolicyNumber: '', insuranceCoverAmount: '',
    cancellationNoticeHours: '', lateCancellationCharge: '', noAccessCharge: '',
    complaintWindowDays: '',
    // Sesiunea 97 (Backlog_Client_Prioritar.md) — shown to the customer in
    // their portal, as a "leave a review" link.
    googleReviewUrl: '',
  });
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState<number | null>(null);
  /**
   * 🔴 **ACHU-716 — versiunea de la care a pornit ecranul, într-un `ref`.**
   *
   * ⚠️ `ref`, nu `state`: nu se randează niciodată, iar o schimbare a ei n-are voie să redeseneze
   * formularul în timp ce cineva tastează în el. Aceeași formă ca la `CleanerFormDialog`.
   * ⛔ Fără ea, ruta refuză salvarea — deliberat: doi Admini cu ecranele deschise pe aceeași versiune
   * își rescriau reciproc valorile care ajung pe factură.
   */
  const revisionRef = useRef<string | undefined>(undefined);

  const load = () => {
    setLoading(true);
    getInvoiceSettings().then(d => {
      const s = d.settings;
      setForm({
        businessLegalName: s.businessLegalName ?? '',
        tradingName: s.tradingName ?? '',
        businessAddress: s.businessAddress ?? '',
        companyRegistrationNumber: s.companyRegistrationNumber ?? '',
        vatRegistered: !!s.vatRegistered,
        vatNumber: s.vatNumber ?? '',
        vatRatePercent: s.vatRatePercent != null ? String(s.vatRatePercent) : '',
        invoiceNumberPrefix: s.invoiceNumberPrefix ?? 'INV',
        paymentTermsDays: String(s.paymentTermsDays ?? 14),
        // `?? ''` and not `String(...)`: a null must stay an empty box, because
        // "" is "not decided yet" and "0" is "we charge nothing", and printing
        // the second when you meant the first puts a wrong term in a contract.
        businessPhone: s.businessPhone ?? '',
        insurerName: s.insurerName ?? '',
        insurancePolicyNumber: s.insurancePolicyNumber ?? '',
        insuranceCoverAmount: s.insuranceCoverAmount != null ? String(s.insuranceCoverAmount) : '',
        cancellationNoticeHours: s.cancellationNoticeHours != null ? String(s.cancellationNoticeHours) : '',
        lateCancellationCharge: s.lateCancellationCharge != null ? String(s.lateCancellationCharge) : '',
        noAccessCharge: s.noAccessCharge != null ? String(s.noAccessCharge) : '',
        complaintWindowDays: s.complaintWindowDays != null ? String(s.complaintWindowDays) : '',
        googleReviewUrl: s.googleReviewUrl ?? '',
      });
      setNextInvoiceNumber(s.nextInvoiceNumber ?? 1);
      revisionRef.current = d._revision;
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveInvoiceSettings({
        // 🔴 ACHU-716 — versiunea citită pleacă înapoi cu salvarea.
        _revision: revisionRef.current,
        businessLegalName: form.businessLegalName.trim() || null,
        tradingName: form.tradingName.trim() || null,
        businessAddress: form.businessAddress.trim() || null,
        companyRegistrationNumber: form.companyRegistrationNumber.trim() || null,
        vatRegistered: form.vatRegistered,
        vatNumber: form.vatRegistered ? (form.vatNumber.trim() || null) : null,
        vatRatePercent: form.vatRegistered && form.vatRatePercent ? parseFloat(form.vatRatePercent) : null,
        invoiceNumberPrefix: form.invoiceNumberPrefix.trim() || 'INV',
        paymentTermsDays: parseInt(form.paymentTermsDays, 10) || 14,
        // ⚠️ `|| null` would turn a deliberate 0 into "not set". `num()` keeps
        // the difference: an empty box stays null, and a typed 0 stays 0 —
        // "we do not charge for a late cancellation" is a real term, and the
        // agreement has to be able to say it.
        businessPhone: form.businessPhone.trim() || null,
        insurerName: form.insurerName.trim() || null,
        insurancePolicyNumber: form.insurancePolicyNumber.trim() || null,
        insuranceCoverAmount: num(form.insuranceCoverAmount),
        cancellationNoticeHours: int(form.cancellationNoticeHours),
        lateCancellationCharge: num(form.lateCancellationCharge),
        noAccessCharge: num(form.noAccessCharge),
        complaintWindowDays: int(form.complaintWindowDays),
        googleReviewUrl: form.googleReviewUrl.trim() || null,
      });
      // ⚠️ Revizia NOUĂ, ca a doua salvare la rând să nu ceară o reîncărcare.
      revisionRef.current = saved._revision;
      toast.success('Invoice settings saved');
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to save invoice settings.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 🆕 §48 „Loading skeletons" (Sesiunea 154) — ⛔ era o singură linie de text: ecranul avea o
   * înălțime de un rând, iar la sosirea datelor sărea la un formular întreg. ✅ Scheletul ține locul.
   */
  if (loading) {
    return (
      <LoadingSkeleton heights={['h-8', 'h-32', 'h-32']} label="Loading…" />
    );
  }

  /**
   * 🔴 ACHU-408. The server now REFUSES to issue an invoice that cannot name the supplier,
   * and this banner is the half of the fix that stops that refusal being a surprise.
   *
   * ⚠️ It is worded around what is irreversible, not around what is missing. Filling these
   * in later does not repair an invoice already sent: the details are copied onto each
   * invoice at the moment it is issued (deliberately, so a later change of address cannot
   * rewrite old invoices), and an invoice is never edited — it is voided and reissued under
   * a new number, in the customer's sight. A blank field here is the only cheap moment.
   */
  const blocking = [
    !form.businessLegalName.trim() && 'Legal Business Name',
    !form.businessAddress.trim() && 'Business Address',
    form.vatRegistered && !form.vatNumber.trim() && 'VAT Number',
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader
        as="h2"
        titleClassName="text-2xl font-bold"
        title="Invoice Settings"
        actions={<RefreshButton onRefresh={load} />}
      />
      {blocking.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm space-y-1"
        >
          <p className="font-semibold">
            You cannot issue invoices yet — {blocking.join(' and ')} {blocking.length > 1 ? 'are' : 'is'} empty.
          </p>
          <p className="text-muted-foreground">
            A UK invoice has to say who issued it. Fill these in and press Save before creating your
            first invoice: each invoice keeps its own permanent copy of these details, so filling them
            in afterwards will not correct an invoice you have already sent — that one would have to be
            voided and reissued under a new number.
          </p>
        </div>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">Business Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">These details appear on every invoice you issue from a Job.</p>
          <div>
            <Label htmlFor="invoiceset-legal-business-name">Legal Business Name</Label>
            <Input id="invoiceset-legal-business-name" value={form.businessLegalName} onChange={e => setForm(f => ({ ...f, businessLegalName: e.target.value }))} placeholder="ACHU Ltd" />
            <p className="text-xs text-muted-foreground mt-1">
              Exactly as registered at Companies House. This name has to appear on every invoice,
              so it is the one the server refuses to issue without.
            </p>
          </div>
          {/*
            * §51 „Trading name" (Sesiunea 160) — ⛔ un al doilea câmp, nu o redenumire a celui de
            * sus: pe documente se tipăresc AMÂNDOUĂ, cu cel comercial ca titlu și cel înregistrat
            * dedesubt („Trading name of ACHU Ltd"). ⚠️ Propoziția de sub casetă spune exact asta,
            * fiindcă altfel cineva îl completează crezând că îl înlocuiește pe cel legal — și
            * atunci ar rămâne cu întrebarea de ce factura arată două nume.
            */}
          <div>
            <Label htmlFor="invoiceset-trading-name">Trading Name (optional)</Label>
            <Input id="invoiceset-trading-name" value={form.tradingName} onChange={e => setForm(f => ({ ...f, tradingName: e.target.value }))} placeholder="ACHU Cleaning" />
            <p className="text-xs text-muted-foreground mt-1">
              Only if you trade under a different name from the registered one. Invoices and
              receipts then show it as the heading, with &ldquo;Trading name of{' '}
              {form.businessLegalName.trim() || 'your registered name'}&rdquo; underneath — the law
              still requires the registered name on the document, so it is never dropped. Leave it
              empty if you trade under the registered name.
            </p>
          </div>
          <div>
            <Label htmlFor="invoiceset-business-address">Business Address</Label>
            <Textarea id="invoiceset-business-address" value={form.businessAddress} onChange={e => setForm(f => ({ ...f, businessAddress: e.target.value }))} rows={3} />
          </div>
          <div>
            <Label htmlFor="invoiceset-company-registration-number-optional">Company Registration Number (optional)</Label>
            <Input id="invoiceset-company-registration-number-optional" value={form.companyRegistrationNumber} onChange={e => setForm(f => ({ ...f, companyRegistrationNumber: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="invoiceset-invoice-number-prefix">Invoice Number Prefix</Label>
            <Input id="invoiceset-invoice-number-prefix" value={form.invoiceNumberPrefix} onChange={e => setForm(f => ({ ...f, invoiceNumberPrefix: e.target.value }))} className="max-w-[160px]" />
            {nextInvoiceNumber != null && (
              <p className="text-xs text-muted-foreground mt-1">Next invoice number will be: {form.invoiceNumberPrefix || 'INV'}-{String(nextInvoiceNumber).padStart(6, '0')}</p>
            )}
          </div>
          <div>
            <Label htmlFor="invoiceset-payment-terms-days-until">Payment Terms (days until due)</Label>
            <Input id="invoiceset-payment-terms-days-until" type="number" min="0" max="365" value={form.paymentTermsDays} onChange={e => setForm(f => ({ ...f, paymentTermsDays: e.target.value }))} className="max-w-[160px]" />
            <p className="text-xs text-muted-foreground mt-1">Each new invoice's Due Date is set to the issue date plus this many days.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">VAT</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox id="vatRegistered" checked={form.vatRegistered} onCheckedChange={c => setForm(f => ({ ...f, vatRegistered: !!c }))} />
            <Label htmlFor="vatRegistered" className="cursor-pointer">ACHU is registered for VAT</Label>
          </div>
          <p className="text-xs text-muted-foreground">Currently off — invoices show no VAT. Turn this on once you've actually registered for VAT with HMRC; only invoices issued after that point will show VAT.</p>
          <div>
            <Label htmlFor="invoiceset-vat-number">VAT Number</Label>
            <Input id="invoiceset-vat-number" value={form.vatNumber} onChange={e => setForm(f => ({ ...f, vatNumber: e.target.value }))} disabled={!form.vatRegistered} placeholder="GB123456789" />
          </div>
          <div>
            <Label htmlFor="invoiceset-vat-rate">VAT Rate (%)</Label>
            <Input id="invoiceset-vat-rate" type="number" min="0" max="100" step="0.1" value={form.vatRatePercent} onChange={e => setForm(f => ({ ...f, vatRatePercent: e.target.value }))} disabled={!form.vatRegistered} className="max-w-[160px]" />
          </div>
        </CardContent>
      </Card>

      {/* ─── ACHU-420 ─────────────────────────────────────────────────────
          Archana: „Adaugale la setari undeva… o sa le compeltez." These are the
          blanks the three customer documents used to leave for someone to type
          by hand, in three separate Word files. One place instead, and the same
          place the invoice already reads the business identity from. */}
      <Card>
        <CardHeader><CardTitle className="text-base">Customer Agreement Terms</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Used by the customer agreement and the consent form. Leave anything you have not decided
            blank — a document will say the term is still to be agreed rather than print a gap.
          </p>
          <div>
            <Label htmlFor="is-phone">Business Phone</Label>
            <Input id="is-phone" value={form.businessPhone} onChange={e => setForm(f => ({ ...f, businessPhone: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="is-insurer">Insurer</Label>
            <Input id="is-insurer" value={form.insurerName} onChange={e => setForm(f => ({ ...f, insurerName: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="is-policy">Policy Number</Label>
              <Input id="is-policy" value={form.insurancePolicyNumber} onChange={e => setForm(f => ({ ...f, insurancePolicyNumber: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="is-cover">Cover Amount (£)</Label>
              <Input id="is-cover" type="number" min="0" step="1000" value={form.insuranceCoverAmount} onChange={e => setForm(f => ({ ...f, insuranceCoverAmount: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="is-notice">Cancellation Notice (hours)</Label>
              <Input id="is-notice" type="number" min="0" max="8760" value={form.cancellationNoticeHours} onChange={e => setForm(f => ({ ...f, cancellationNoticeHours: e.target.value }))} />
              {/* Hours rather than days on purpose: "24 hours" and "one day" are
                  only the same length if nobody cancels in the evening for the
                  morning after. */}
              <p className="text-xs text-muted-foreground mt-1">How much warning a customer must give to cancel free of charge.</p>
            </div>
            <div>
              <Label htmlFor="is-late">Late Cancellation Charge (£)</Label>
              <Input id="is-late" type="number" min="0" step="1" value={form.lateCancellationCharge} onChange={e => setForm(f => ({ ...f, lateCancellationCharge: e.target.value }))} />
              {/* Solicitor review, Sesiunea 100 continuare (ACHU-487, MEDIUM) —
                  a cancellation charge that is not a genuine pre-estimate of
                  loss (and that ignores an opportunity to fill the slot from
                  elsewhere) risks being an unfair term under consumer law and
                  unenforceable. A warning, not a technical cap: the figure
                  stays the office's call, made with this in view. */}
              <p className="text-xs text-muted-foreground mt-1">Should reflect the real cost of the lost slot, not an arbitrary penalty — a disproportionate charge risks being unenforceable against a consumer.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="is-noaccess">No-Access Charge (£)</Label>
              <Input id="is-noaccess" type="number" min="0" step="1" value={form.noAccessCharge} onChange={e => setForm(f => ({ ...f, noAccessCharge: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Charged when the cleaner arrives and cannot get in — the travel and the slot are already spent. Same rule as Late Cancellation Charge: reflect the real cost, not a penalty.</p>
            </div>
            <div>
              <Label htmlFor="is-complaint">Complaint Window (days)</Label>
              <Input id="is-complaint" type="number" min="0" max="3650" value={form.complaintWindowDays} onChange={e => setForm(f => ({ ...f, complaintWindowDays: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">How long a customer has to report a poor clean or damage.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sesiunea 97 (Backlog_Client_Prioritar.md, Nivel 1) — Roberto: "Google
          Review link... un link simplu, către recenzie Google, în portal."
          The URL is specific to ACHU's own Google Business listing — only the
          business can produce it, so it lives here, not hardcoded. */}
      <Card>
        <CardHeader><CardTitle className="text-base">Google Review</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Shown to customers in their portal, as a "Leave a review" link. Leave blank to hide it —
            a customer is never shown a button that would go nowhere.
          </p>
          <div>
            <Label htmlFor="is-google-review">Google Review Link</Label>
            <Input
              id="is-google-review"
              type="url"
              placeholder="https://g.page/r/.../review"
              value={form.googleReviewUrl}
              onChange={e => setForm(f => ({ ...f, googleReviewUrl: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
    </div>
  );
}

