import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect, useRef } from 'react';
import { saveCustomer } from '@/lib/endpoints';
import { toast } from 'sonner';
import AuditHistory from './AuditHistory';
import CustomerConsentsSection from './CustomerConsentsSection';
import CustomerTimelineSection from './CustomerTimelineSection';
// ACHU-554 — curățătorul preferat/interzis. Avertismentul se citește în JobAssignmentsPanel.
import CustomerCleanerPreferencesSection from './CustomerCleanerPreferencesSection';
import CustomerPropertiesSection from './CustomerPropertiesSection';
import CustomerContactsSection from './CustomerContactsSection';
import CustomerOnboardingSection from './CustomerOnboardingSection';
// 🔴 §20 (Sesiunea 152) — ce s-a vorbit cu omul ăsta, în afara aplicației. Se încarcă la cerere.
import CustomerCommunicationsSection from './CustomerCommunicationsSection';
import DiscardChangesDialog from '../shared/DiscardChangesDialog';
import { useUnsavedGuard } from '@/lib/useUnsavedGuard';
import { exportCustomerData, getInvoiceSettings } from '@/lib/endpoints';
import PdfPreviewDialog from '../shared/PdfPreviewDialog';
import { generateCustomerDocumentPdf, customerDocFilename } from '@/lib/customerDocumentPdf';
import { CUSTOMER_DOCUMENTS, type CustomerDocumentKey, type DocSettings } from '@/lib/customerDocuments';
import { Download, Loader2, ShieldAlert, FileText } from 'lucide-react';
import { computeRevision, REVISION_FIELDS } from '@/lib/concurrency';
import AnonymiseCustomerDialog from './AnonymiseCustomerDialog';
import { errMsg } from '@/lib/errorMessage';
// ACHU-552 — aceleași marcaje ca în lista de clienți, din același fișier.
import { CustomerRiskPanel } from './CustomerRiskSignals';
// ACHU-401 (felia 19) — forma pe care o citește dialogul, aceeași cu a listei.
import type { CustomerRecord } from '@/lib/adminRecordTypes';

const types = ['Domestic', 'Commercial', 'Airbnb', 'Landlord', 'Other'];
const statuses = ['Lead', 'Active', 'Inactive', 'Blocked'];

export default function CustomerDialog({
  open, onClose, item, onSaved, readOnly = false,
}: { open: boolean; onClose: () => void; item: CustomerRecord | null; onSaved: () => void; readOnly?: boolean }) {
  const [form, setForm] = useState({ customerName: '', phone: '', email: '', address: '', postcode: '', customerType: '', status: 'Lead', notes: '', accessibilityNote: '', customerVisibleNote: '', preferredContactMethod: '', preferredContactWindow: '', contactPreferenceNote: '', nextFollowUpDate: '', languagePreference: '' });
  const [saving, setSaving] = useState(false);
  /** ACHU-530: clienții cu care seamănă cel pe care biroul îl creează acum. */
  const [duplicates, setDuplicates] = useState<Array<{ id: string; customerId: number; customerName: string; phone?: string | null; email?: string | null; postcode?: string | null; matchedOn: string[] }> | null>(null);
  /**
   * Sesiunea 97 — "poti sa le separi?": the owner noticed that Edit was the
   * ONLY way to open a customer's record, so a quick look and a change to
   * their details were the same click. `readOnly` starts each open in
   * whichever mode the row's button asked for; "Switch to editing" below
   * lets a look become a change without closing and reopening the dialog.
   */
  const [locked, setLocked] = useState(readOnly);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const revisionRef = useRef<string | undefined>(undefined);
  // Sesiunea 29 (backlog 46): guard against losing typed edits on a stray close.
  const [exporting, setExporting] = useState(false);
  // Sesiunea 47 (ACHU-218): erasure lives in its own dialog because it needs a
  // preview, a reason and a typed word — none of which fit next to a download button.
  const [anonymising, setAnonymising] = useState(false);
  /**
   * ACHU-413 — the documents Roberto asked the app to GENERATE and got as blank
   * Word templates instead. `null` means no preview open; a key means that one.
   */
  const [previewDoc, setPreviewDoc] = useState<CustomerDocumentKey | null>(null);
  const [docSettings, setDocSettings] = useState<DocSettings | null>(null);

  /**
   * Loaded once the dialog opens, not on every preview: the documents read the
   * business's identity and terms from the SAME row the invoice reads, so a
   * changed address cannot make an agreement and an invoice disagree.
   */
  useEffect(() => {
    if (!open || docSettings) return;
    getInvoiceSettings().then(d => setDocSettings(d.settings)).catch(() => {
      // Non-fatal: the generator marks every missing field on the page itself,
      // so a failed settings load produces an honest document rather than none.
      setDocSettings({});
    });
  }, [open, docSettings]);
  const guard = useUnsavedGuard({ onClose });
  guard.track(form);

  useEffect(() => {
    setLocked(readOnly);
    if (item) {
      const initial = { customerName: item.customerName ?? '', phone: item.phone ?? '', email: item.email ?? '', address: item.address ?? '', postcode: item.postcode ?? '', customerType: item.customerType ?? '', status: item.status ?? 'Lead', notes: item.notes ?? '', accessibilityNote: item.accessibilityNote ?? '', customerVisibleNote: item.customerVisibleNote ?? '', preferredContactMethod: item.preferredContactMethod ?? '', preferredContactWindow: item.preferredContactWindow ?? '', contactPreferenceNote: item.contactPreferenceNote ?? '', nextFollowUpDate: (item.nextFollowUpDate ?? '').slice(0, 10), languagePreference: item.languagePreference ?? '' };
      setForm(initial);
      guard.captureBaseline(initial);
      revisionRef.current = computeRevision(item, REVISION_FIELDS.customer);
    } else {
      const initial = { customerName: '', phone: '', email: '', address: '', postcode: '', customerType: '', status: 'Lead', notes: '', accessibilityNote: '', customerVisibleNote: '', preferredContactMethod: '', preferredContactWindow: '', contactPreferenceNote: '', nextFollowUpDate: '', languagePreference: '' };
      setForm(initial);
      guard.captureBaseline(initial);
      revisionRef.current = undefined;
    }
  }, [item, open, readOnly]);

  /**
   * ACHU-530 (Sesiunea 118) — avertismentul de duplicat.
   *
   * Decizia Archanei: *„Nu ar trebui sa existe doi clienti duplicati"*. ⛔ **Avertisment,
   * nu blocaj**: doi oameni reali pot purta același nume, iar un refuz l-ar face pe al
   * doilea imposibil de înregistrat — o funcționalitate care împiedică munca e ocolită,
   * nu respectată.
   *
   * ⚠️ Aceeași formă ca la plăți și cheltuieli (`duplicateConflict` + `duplicates` +
   * `duplicateOverrideConfirmed`), deliberat: un al treilea mecanism pentru aceeași idee
   * ar fi cerut al treilea ecran care îl înțelege.
   */
  const handleSave = async (overrideConfirmed = false) => {
    if (!form.customerName.trim()) { toast.error('Name is required'); return; }
    /**
     * ACHU-531 — emailul e obligatoriu la un client NOU (Archana: *„Da. Obligatoriu"*).
     *
     * ⚠️ Verificat aici, nu doar pe server, ca biroul să afle **înainte** de a apăsa Save
     * — un refuz venit de la server pe un formular completat arată ca un defect.
     *
     * ⛔ **Doar la creare** (`!item`): clienții vechi fără email există, iar cerut la
     * editare ar bloca fiecare corectură pe fiecare dintre ei. Serverul aplică aceeași
     * distincție, iar ȘTERGEREA unui email existent e refuzată tot de el — singurul loc
     * unde se poate ști ce era înainte.
     */
    if (!item && !form.email.trim()) {
      toast.error('Email is required for a new customer — it is how we keep one person to one record.');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const result = await saveCustomer({
        ...form, id: item?.id, _revision: revisionRef.current,
        /**
         * §4 (Sesiunea 160) — ⛔ caseta goală înseamnă „nu revin", deci pleacă `null`, nu `''`:
         * serverul citește `null` ca ștergere, iar un șir gol ar pica pe forma datei. ⚠️ Și e chiar
         * felul în care biroul anulează o revenire — golește caseta.
         */
        nextFollowUpDate: form.nextFollowUpDate || null,
        languagePreference: form.languagePreference.trim() || null,
        ...(overrideConfirmed ? { duplicateOverrideConfirmed: true } : {}),
      });

      /**
       * ACHU-401 (felia 22) — verificat pe `success`, nu pe `duplicateConflict`.
       *
       * ⛔ Ruta răspunde ori `{ success: true, id }`, ori `{ success: false, duplicateConflict }`
       * — **nu amândouă**, iar pe a doua ramură nu există id. Citirea de dinainte trecea mai
       * departe la „Customer created" dacă serverul spunea `success: false` fără duplicate:
       * exact tiparul ACHU-520/742, un mesaj care afirmă o salvare care nu s-a întâmplat.
       */
      if (!result.success) {
        setDuplicates(result.duplicates);
        setSaving(false);
        return;
      }

      // ACHU-047: Show audit warning if present
      if (result.auditWarning) {
        console.warn('[CustomerDialog] Audit warning:', result.auditWarning);
        toast.warning('Record saved, but audit history could not be updated. The change was applied.', { duration: 6000 });
      } else {
        toast.success(item ? 'Customer updated' : 'Customer created');
      }
      setAuditRefreshKey(k => k + 1);
      guard.markSaved();
      onSaved();
    } catch (e) {
      toast.error(errMsg(e) || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && guard.requestClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? (locked ? 'Customer' : 'Edit Customer') : 'New Customer'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label htmlFor="customerdi-customer-name">Customer Name *</Label><Input id="customerdi-customer-name" disabled={locked} value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="customerdi-phone">Phone</Label><Input id="customerdi-phone" disabled={locked} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label htmlFor="customerdi-email">Email{!item && ' *'}</Label><Input id="customerdi-email" disabled={locked} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          </div>
          <div><Label htmlFor="customerdi-address">Address</Label><Textarea id="customerdi-address" disabled={locked} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} /></div>
          <div><Label htmlFor="customerdi-postcode">Postcode</Label><Input id="customerdi-postcode" disabled={locked} value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} placeholder="e.g. SW1A 1AA" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="customerdi-type">Type</Label>
              <Select disabled={locked} value={form.customerType} onValueChange={v => setForm(f => ({ ...f, customerType: v }))}>
                <SelectTrigger id="customerdi-type"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="customerdi-status">Status</Label>
              <Select disabled={locked} value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger id="customerdi-status"><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {/* ─── ACHU-552 (Sesiunea 121) — ce să anticipeze biroul ─────────────
              Deasupra notelor, deliberat: e citit, nu scris. Nu are niciun câmp și
              niciun buton — fiecare rând e MĂSURAT din vizitele, plățile și cererile
              acestui client (`backend/src/lib/customerRiskSignals.ts`).

              ⚠️ Doar pentru un client SALVAT: la unul nou nu există nici o vizită
              din care să se măsoare ceva, iar un panou golit ar arăta ca un panou
              stricat. */}
          {item?.id && <CustomerRiskPanel risk={item.risk} />}
          <div>
            <Label htmlFor="customerdi-notes">Notes</Label>
            {/* 🔴 ACHU-549 — cele trei note arată la fel pe ecran și au trei cititori
                diferiți, deci FIECARE spune cine o citește. Fără rândurile astea, o notă
                internă („nu plătește la timp") ajunge tastată în câmpul pe care clientul
                îl vede în portal — și nimic din aplicație nu ar semnala asta. */}
            <p className="text-xs text-muted-foreground mb-1">Internal. Only the office sees this — never the customer, never a cleaner.</p>
            <Textarea id="customerdi-notes" disabled={locked} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
          <div>
            <Label htmlFor="customerdi-accessibility">What this person needs</Label>
            <p className="text-xs text-muted-foreground mb-1">
              About the PERSON, not the property — deaf and cannot hear the bell, uses a wheelchair, works nights and sleeps in the day.
              The cleaner assigned to their jobs sees this, alongside how to get in.
            </p>
            <Textarea id="customerdi-accessibility" disabled={locked} value={form.accessibilityNote} onChange={e => setForm(f => ({ ...f, accessibilityNote: e.target.value }))} rows={2} maxLength={2000} />
          </div>
          <div>
            <Label htmlFor="customerdi-visible-note">Note for the customer</Label>
            <p className="text-xs text-muted-foreground mb-1">
              <strong>The customer reads this in their account.</strong> Use it for something they should know — a change of arrangements, where their spare key is kept.
            </p>
            <Textarea id="customerdi-visible-note" disabled={locked} value={form.customerVisibleNote} onChange={e => setForm(f => ({ ...f, customerVisibleNote: e.target.value }))} rows={2} maxLength={2000} />
          </div>

          {/*
            ACHU-558 — cum vrea omul să fie contactat.

            🔴 **Rândul de dedesubt e funcționalitatea, nu o notă de subsol.** Aplicația
            trimite azi doar în cont și push — nu are email, nu are SMS, nu are WhatsApp.
            Fără propoziția aceea, biroul ar bifa „Email" și ar presupune că software-ul
            trimite ceva; nu trimite. Astea sunt pentru omul care ridică telefonul.
          */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-sm font-medium">How they want us to get in touch</p>
            <p className="text-xs text-muted-foreground">
              Read by whoever picks up the phone. The app does not send emails or texts — messages about bookings
              appear in the customer&apos;s account either way.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="customerdi-contact-method" className="text-xs">Preferred way</Label>
                <select
                  id="customerdi-contact-method"
                  disabled={locked}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                  value={form.preferredContactMethod}
                  onChange={e => setForm(f => ({ ...f, preferredContactMethod: e.target.value }))}
                >
                  <option value="">Not said</option>
                  <option value="phone">Phone call</option>
                  <option value="sms">Text message</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="app">In the app only</option>
                </select>
              </div>
              <div>
                <Label htmlFor="customerdi-contact-window" className="text-xs">Best time</Label>
                <select
                  id="customerdi-contact-window"
                  disabled={locked}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                  value={form.preferredContactWindow}
                  onChange={e => setForm(f => ({ ...f, preferredContactWindow: e.target.value }))}
                >
                  <option value="">Not said</option>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="anytime">Any time</option>
                </select>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                {/*
                  §4 „Next follow-up date" (Sesiunea 160) — ⛔ nota biroului către el ÎNSUȘI, nu o
                  promisiune făcută clientului. Propoziția de sub casetă spune unde reapare, altfel
                  omul ar scrie o dată și n-ar ști niciodată ce se întâmplă cu ea.
                */}
                <Label htmlFor="customerdi-follow-up" className="text-xs">Next follow-up</Label>
                <Input
                  id="customerdi-follow-up"
                  type="date"
                  disabled={locked}
                  value={form.nextFollowUpDate}
                  onChange={e => setForm(f => ({ ...f, nextFollowUpDate: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Shows up in the Action Centre on the day — and stays there until somebody moves
                  it or clears it. Nothing is sent to the customer.
                </p>
              </div>
              <div>
                {/*
                  §4 „Language preference" — ⛔ text liber, și ecranul spune limpede că aplicația NU
                  traduce nimic: un câmp care ar părea că pornește traduceri ar fi o promisiune falsă.
                */}
                <Label htmlFor="customerdi-language" className="text-xs">Language</Label>
                <Input
                  id="customerdi-language"
                  disabled={locked}
                  value={form.languagePreference}
                  onChange={e => setForm(f => ({ ...f, languagePreference: e.target.value }))}
                  maxLength={120}
                  placeholder="e.g. Polish — husband speaks English"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  For whoever picks up the phone. The app is not translated.
                </p>
              </div>
            </div>
            <div>
              <Label htmlFor="customerdi-contact-note" className="text-xs">Anything else</Label>
              <Textarea
                id="customerdi-contact-note"
                disabled={locked}
                value={form.contactPreferenceNote}
                onChange={e => setForm(f => ({ ...f, contactPreferenceNote: e.target.value }))}
                rows={2}
                maxLength={300}
                placeholder="e.g. not between 8 and 9, school run"
              />
            </div>
          </div>
          {/* Sesiunea 29 (backlog 45): a subject access request — everything held
              about this customer, in the machine-readable form UK GDPR Article 20
              asks for. Every export is audited server-side.

              Sesiunea 30 (ACHU-222): the wording no longer promises a finished
              response, and the toast says when internal notes need reading
              first. Downloading a file labelled "everything we hold" and
              forwarding it unchecked is the actual compliance risk here — the
              file may deliberately be missing internal notes that, depending on
              what they say, should have been included. */}
          {/* ─── ACHU-413 ─────────────────────────────────────────────────
              Roberto: „ideea era sa le genere din aplicatie". He asked for this
              and was handed three .docx templates to fill in by hand; Archana
              put it back on the list and then asked, simply, „Generarea?".

              ⚠️ Shown only for a SAVED customer. A document naming a customer
              who does not exist yet, built from boxes still being typed, is a
              document that goes out wrong. */}
          {item?.id && (
            <div className="rounded-lg border border-border p-3 space-y-1.5">
              <p className="text-xs font-medium">Customer documents</p>
              <p className="text-xs text-muted-foreground">
                Filled in with this customer's details and the business terms from Invoice Settings.
                Anything not yet set is marked on the document rather than left blank.
              </p>
              <div className="flex flex-wrap gap-2 pt-0.5">
                {CUSTOMER_DOCUMENTS.map(d => (
                  <Button
                    key={d.key}
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewDoc(d.key)}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1.5" />{d.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {item?.id && (
            <div className="rounded-lg border border-border p-3 space-y-1.5">
              <p className="text-xs font-medium">Data request (GDPR)</p>
              <p className="text-xs text-muted-foreground">
                Collects what ACHU holds about this customer into one file. Check it before sending —
                internal notes are left out by default and are listed separately for you to review.
              </p>
              <Button variant="outline" size="sm" disabled={exporting} onClick={async () => {
                setExporting(true);
                try {
                  const res = await exportCustomerData({ customerId: item.id });
                  // Built and revoked here rather than kept around: the file
                  // contains one person's whole record, so it should not linger
                  // as a live object URL any longer than the click needs.
                  const blob = new Blob([JSON.stringify(res.export, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ACHU-data-${(form.customerName || 'customer').replace(/[^a-z0-9]+/gi, '-')}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  // ACHU-222: a plain "downloaded" would let the one case that
                  // needs a human decision pass unnoticed.
                  const needsReview = res.export?.internalReviewRequired?.jobsWithAdminNotes?.length ?? 0;
                  if (needsReview > 0) {
                    toast.warning(
                      `Downloaded — ${needsReview} internal note${needsReview === 1 ? '' : 's'} need${needsReview === 1 ? 's' : ''} your review`,
                      { description: 'See "internalReviewRequired" in the file before sending it to the customer.' },
                    );
                  } else {
                    toast.success('Data export downloaded');
                  }
                } catch (e) {
                  toast.error(errMsg(e) || 'Could not produce the export.');
                } finally {
                  setExporting(false);
                }
              }}>
                {exporting ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Preparing…</> : <><Download className="h-3.5 w-3.5 mr-1.5" />Download this customer's data</>}
              </Button>

              {/* ACHU-218. Under the export on purpose: the export is the routine
                  request and erasure is the rare, irreversible one, so the order
                  on screen matches how often each is actually the right answer. */}
              {item.anonymisedAt ? (
                <p className="text-xs text-muted-foreground border-t pt-2">
                  This customer's personal data was erased at their request
                  {item.anonymisedBy ? ` by ${item.anonymisedBy}` : ''}. Invoices and payments were retained.
                </p>
              ) : (
                <div className="border-t pt-2">
                  <Button variant="outline" size="sm" onClick={() => setAnonymising(true)}>
                    <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />Erase personal data (GDPR request)
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    Irreversible. It shows you what goes and what stays first.
                  </p>
                </div>
              )}
            </div>
          )}
          {item?.id && (
            <CustomerConsentsSection
              customerId={item.id}
              customerName={form.customerName || 'this customer'}
              settings={docSettings ?? {}}
            />
          )}
          {/**
            * 🆕 ACHU-541 — firul de interacțiuni, DEASUPRA istoricului de audit și separat de el.
            *
            * ⚠️ Nu îl înlocuiește: „Audit history" răspunde la „cine a schimbat fișa", firul
            * răspunde la „ce s-a întâmplat cu omul". Puse unul lângă altul fiindcă a doua
            * întrebare e cea pusă mai des, iar prima e cea care contează într-o dispută.
            */}
          {/* ACHU-554 — deasupra firului de interacțiuni: e ceva ce biroul SCRIE despre
              relația cu clientul, nu ceva care s-a întâmplat.
              ⚠️ Doar pentru un client SALVAT — nu există fișă de care să atârne. */}
          {/*
            ACHU-570 — casele clientului. ⚠️ ÎNAINTE de preferințele de curățător și de
            cronologie, fiindcă e despre UNDE se lucrează, iar restul secțiunilor sunt despre
            cum: cine citește fișa de sus în jos are nevoie de locuri înainte de detalii.
          */}
          {item?.id && <CustomerPropertiesSection customerId={item.id} />}
          {/*
            §4 „Customer onboarding” (Sesiunea 160) — sus, lângă case, fiindcă e singura secțiune
            care spune ce LIPSEȘTE. ⛔ Pusă la urmă, ar fi fost citită după ce omul a închis deja
            fișa — adică niciodată.
          */}
          {item?.id && <CustomerOnboardingSection customerId={item.id} />}
          {item?.id && <CustomerContactsSection customerId={item.id} />}
          {item?.id && <CustomerCleanerPreferencesSection customerId={item.id} />}
          {/*
            🔴 §20 (Sesiunea 152) — **deasupra firului, deliberat**: aici se SCRIE ce s-a vorbit, iar
            firul de dedesubt e locul unde se citește totul la un loc (discuțiile intră și în el).
          */}
          {item?.id && <CustomerCommunicationsSection customerId={item.id} />}
          {item?.id && <CustomerTimelineSection customerId={item.id} />}
          {item?.id && <AuditHistory entityType="Customer" entityId={item.id} refreshKey={auditRefreshKey} />}
          {locked ? (
            <Button className="w-full" variant="outline" onClick={() => setLocked(false)}>Switch to editing</Button>
          ) : (
            <Button className="w-full" onClick={() => handleSave()} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          )}
        </div>
      </DialogContent>
      <DiscardChangesDialog open={guard.confirmOpen} onDiscard={guard.discard} onKeepEditing={guard.keepEditing} />
      {/* ACHU-413. Preview before download, same as the invoice and the quote —
          and here it matters more, because the whole point of the markers is
          that somebody SEES which terms are still unset before sending it. */}
      {previewDoc && (
        <PdfPreviewDialog
          open
          onClose={() => setPreviewDoc(null)}
          title={CUSTOMER_DOCUMENTS.find(d => d.key === previewDoc)!.label}
          filename={customerDocFilename(previewDoc, form.customerName)}
          build={() => generateCustomerDocumentPdf({
            which: previewDoc,
            customer: {
              customerName: form.customerName,
              address: form.address,
              postcode: form.postcode,
              email: form.email,
              phone: form.phone,
            },
            settings: docSettings ?? {},
            output: 'preview',
          }) as Promise<string>}
        />
      )}
      {item?.id && (
        <AnonymiseCustomerDialog
          open={anonymising}
          customerId={item.id}
          customerName={form.customerName || 'this customer'}
          onClose={() => setAnonymising(false)}
          onDone={() => { onSaved(); }}
        />
      )}
      {/* ACHU-530 — ce a găsit serverul, înainte de a crea un al doilea rând.
          ⛔ Arată PE CE s-a potrivit, nu doar că s-a potrivit: biroul decide mai repede
          dacă vede că a fost numele sau telefonul. */}
      <Dialog open={!!duplicates} onOpenChange={v => !v && setDuplicates(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Is this the same person?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {duplicates?.length === 1 ? 'A customer already on file looks like this one:' : 'Customers already on file look like this one:'}
          </p>
          <div className="space-y-2">
            {duplicates?.map(d => (
              <div key={d.id} className="rounded-md border p-2 text-sm">
                <p className="font-medium">{d.customerName} <span className="text-muted-foreground font-normal">#{d.customerId}</span></p>
                <p className="text-xs text-muted-foreground">
                  {[d.phone, d.email, d.postcode].filter(Boolean).join(' · ') || 'No contact details on file'}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Same {d.matchedOn.join(' and ')}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDuplicates(null)}>
              Back — let me check
            </Button>
            {/* ⛔ NU e blocat: dacă e chiar o persoană diferită, biroul o creează. */}
            <Button className="flex-1" onClick={() => { setDuplicates(null); handleSave(true); }} disabled={saving}>
              Different person — create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

