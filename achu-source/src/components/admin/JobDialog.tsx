import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import DateField from '@/components/shared/DateField';
import InlineNote from '@/components/shared/InlineNote';
import TimeField from '@/components/shared/TimeField';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { checkJobDuplicate, type JobDuplicateCheck } from '@/lib/endpoints';
import { useNavigate } from 'react-router-dom';
import { saveJob, getJob, getCustomers, setPriceQuoteStatus } from '@/lib/endpoints';
import { toast } from 'sonner';
import { computeRevision, REVISION_FIELDS } from '@/lib/concurrency';
import SearchablePicker, { type PickerOption } from '../shared/SearchablePicker';
import DiscardChangesDialog from '../shared/DiscardChangesDialog';
import { useUnsavedGuard } from '@/lib/useUnsavedGuard';
// §46 „Form recovery" (Sesiunea 150) — bara care întreabă dacă se pune înapoi ce s-a scris.
import RestoreDraftBar from '../shared/RestoreDraftBar';
import JobAssignmentsPanel from './JobAssignmentsPanel';
import AuditHistory from './AuditHistory';
import QuoteRequestSection from './QuoteRequestSection';
import AdminChecklistSection from './AdminChecklistSection';
import JobLinkedRecordsSection from './JobLinkedRecordsSection';
import JobInternalRating from './JobInternalRating';
import JobPropertyInfoSection from './JobPropertyInfoSection';
// ACHU-573 — la CARE casă e vizita. ⚠️ Altceva decât `JobPropertyInfoSection` de deasupra:
// aceea arată ce a povestit clientul despre locuință, aceasta o LEAGĂ de o casă a lui.
import JobPropertySelect from './JobPropertySelect';
import JobInvoicesSection from './JobInvoicesSection';
// §33 (Sesiunea 161) — hârtiile vizitei. Aceeași secțiune ca pe firmă, ofertă și factură.
import DocumentsSection from '@/components/shared/DocumentsSection';
// ACHU-556 — serviciile extra la vizită. ⚠️ Fiecare scriere de acolo mută suma vizitei.
import JobServiceExtrasSection from './JobServiceExtrasSection';
import { AlertTriangle, Clock, Calculator } from 'lucide-react';
import { StatusBadge, fmt, fmtDateTime } from '@/lib/format';
import { errMsg } from '@/lib/errorMessage';
// ACHU-228, mutat în `ukDate.ts` la ACHU-746: aceeași tăietură o cer și Cheltuielile, și Plățile.
import { toDateInputValue } from '@/lib/ukDate';
// ACHU-401 (felia 19) — forma pe care o citește dialogul, aceeași cu a listei.
import type { JobRecord } from '@/lib/adminRecordTypes';

// ACHU-135/136: the server now rejects creating a job directly as 'Completed'
// or 'Completion Review' — those are excluded from the picker for new jobs.
const ALL_STATUSES = ['Enquiry', 'Booked', 'Confirmed', 'In Progress', 'Completion Review', 'Completed', 'Cancelled', 'No Access'];

const NOT_FOR_NEW_JOBS = new Set(['Completed', 'Completion Review']);

export default function JobDialog({ open, onClose, item, onSaved, readOnly = false }: { open: boolean; onClose: () => void; item: JobRecord | null; onSaved: () => void; readOnly?: boolean }) {
  const [form, setForm] = useState({ customer: '', jobDate: '', service: '', address: '', propertyId: '', startTime: '', finishTime: '', cleanersNeeded: '', status: 'Enquiry', amountCharged: 0, customerInstructions: '', adminNotes: '', cleanerCompletionNotes: '', quoteNumber: '' });
  const [saving, setSaving] = useState(false);
  /**
   * NOU §9 "Duplicate-job warning" (Sesiunea 157) - dublura, spusa INAINTE de salvare.
   *
   * Definitia e cea din §40 si sta pe server (acelasi client, aceeasi zi, acelasi serviciu,
   * anulatele nu intra), deci ecranul nu o rescrie. Avertizeaza, nu refuza: doua vizite intr-o zi
   * pot fi cinstite, iar propozitia vine de la server, cu numerele vizitelor in ea.
   */
  const dupCheck = useTrackedRequest<JobDuplicateCheck>({ timeoutMs: 15000 });
  /**
   * ACHU-519 — Archana: „ca să văd detaliile la un job trebuie să îl editez?" She was right,
   * and ACHU-444 had already settled the principle for the CUSTOMER file at Roberto's request
   * („fisa clientului se deschide din butonul edit… poti sa le separi?"). Jobs never got it, so
   * a look and a change stayed the same click — on the record that carries the price.
   * Same shape as CustomerDialog deliberately, not a second invention.
   */
  const [locked, setLocked] = useState(readOnly);
  /**
   * 🔴 **ACHU-747 (owner, 19/08/2026: „750 si 747 da") — vizita, RECITITĂ la deschidere.**
   *
   * Avertismentul de fereastră de anulare — propoziția care spune biroului că vizita asta cade în
   * fereastra promisă clientului în Service Agreement — e compus **doar** de `GET /jobs/:id`, nu și
   * de ruta de listă. ⛔ Deci pe **drumul obișnuit** (pagina Jobs) câmpul lipsea și avertismentul
   * **nu se desena deloc**. Se vedea doar deschizând vizita din Calendar.
   *
   * ⚠️ Nota din cod spunea că avertismentul stă *„SUS, deasupra câmpurilor, fiindcă o atenționare de
   * sub bani e una la care nimeni nu derulează"* — corect, **și complet degeaba** unde nu apărea.
   *
   * ✅ **Varianta (b) din registru**, recomandată acolo: un apel la deschidere, iar dialogul primește
   * și restul câmpurilor proaspete. ⛔ Nu (a) — ruta de listă încarcă deja toate vizitele și toate
   * plățile, iar a-i mai adăuga o citire pe rând ar fi plătit pe **fiecare** rând ca să afle ceva ce
   * se cere pentru **unul**.
   *
   * ⚠️ **Folosit DOAR pentru afișare, nu pentru formular** — și ăsta e capătul de care am avut grijă:
   * efectul care inițializează câmpurile ascultă `item`, iar dacă ar asculta și răspunsul ăsta,
   * formularul s-ar reinițializa când sosește și ar **șterge ce a tastat omul** între timp.
   */
  const [fresh, setFresh] = useState<{ id: string; record: JobRecord } | null>(null);
  const [confirmingQuote, setConfirmingQuote] = useState(false);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const nav = useNavigate();
  const revisionRef = useRef<string | undefined>(undefined);
  // Sesiunea 29 (backlog 46): stop a stray backdrop click from binning a
  // half-filled job form.
  /**
   * §46 „Form recovery" (Sesiunea 150) — ⚠️ cheia poartă identitatea vizitei, altfel ciorna unei
   * vizite ar fi fost oferită la deschiderea alteia. Motivul întreg: `lib/useUnsavedGuard.ts`.
   */
  const guard = useUnsavedGuard({ onClose, draftKey: `job:${item?.id ?? 'new'}` });
  guard.track(form);

  // Sesiunea 28: replaces the eager `getCustomers({})` that loaded every
  // customer when the dialog opened, just to fill a dropdown.
  const searchCustomers = useCallback(async (q: string): Promise<PickerOption[]> => {
    const d = await getCustomers(q ? { search: q } : {});
    return d.records.map(c => ({ id: c.id, label: c.customerName }));
  }, []);

  /**
   * Verificarea se cere doar cand toate trei sunt alese, si nu la fiecare litera din serviciu:
   * `fire` e cea a hookului, deci raspunsul vechi nu poate suprascrie unul nou (latest-wins).
   */
  const { fire: fireDupCheck } = dupCheck;
  useEffect(() => {
    if (locked || !form.customer || !form.jobDate || !form.service.trim()) return;
    fireDupCheck(() => checkJobDuplicate({
      customerId: form.customer,
      jobDate: form.jobDate,
      service: form.service.trim(),
      ...(item?.id ? { excludeJobId: item.id } : {}),
    }));
  }, [locked, form.customer, form.jobDate, form.service, item?.id, fireDupCheck]);

  useEffect(() => {
    if (item) {
      const initial = {
        customer: item.customerId ?? '', jobDate: toDateInputValue(item.jobDate), service: item.service ?? '',
        address: item.address ?? '', propertyId: item.propertyId ?? '',
        startTime: item.startTime ?? '', finishTime: item.finishTime ?? '',
        cleanersNeeded: item.cleanersNeeded == null ? '' : String(item.cleanersNeeded),
        status: item.status ?? 'Enquiry', amountCharged: item.amountCharged ?? 0,
        customerInstructions: item.customerInstructions ?? '',
        adminNotes: item.adminNotes ?? (item.notes ?? ''),
        cleanerCompletionNotes: item.cleanerCompletionNotes ?? '',
        quoteNumber: item.quoteNumber ?? '',
      };
      setForm(initial);
      guard.captureBaseline(initial);
      // Sesiunea 28: prefer the revision the server computed from its own row.
      // Re-deriving it here from the JSON response is unreliable — GET /jobs
      // coerces a NULL `amountCharged` to 0 for display, so this used to
      // produce "…|0|…" against the backend's "…||…" and every edit of a Job
      // created from a quote request / booking enquiry failed as CONFLICT.
      // The local fallback stays for older responses without `_revision`.
      revisionRef.current = item._revision ?? computeRevision(item, REVISION_FIELDS.job);
    } else {
      // ACHU-057: Default Job Date to today in Europe/London timezone for new jobs
      const todayLondon = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
      const initial = { customer: '', jobDate: todayLondon, service: '', address: '', propertyId: '', startTime: '', finishTime: '', cleanersNeeded: '', status: 'Enquiry', amountCharged: 0, customerInstructions: '', adminNotes: '', cleanerCompletionNotes: '', quoteNumber: '' };
      setForm(initial);
      guard.captureBaseline(initial);
      revisionRef.current = undefined;
    }
    // ACHU-519: the mode is reset on every open, so „View" after „Edit" opens locked.
    setLocked(readOnly);
  }, [item, open, readOnly]);

  /**
   * 🔴 ACHU-747 — recitirea. ⚠️ Best-effort: dacă apelul pică, dialogul rămâne exact cum era înainte
   * de felia asta — cu un avertisment lipsă, nu cu o eroare pe ecran. ⛔ O vizită nu are voie să
   * devină needitabilă fiindcă o propoziție de atenționare n-a putut fi adusă.
   */
  useEffect(() => {
    if (!open || !item?.id) return;
    const id = item.id;
    let live = true;
    getJob({ id }).then(r => { if (live) setFresh({ id, record: r.record }); }).catch(() => {});
    return () => { live = false; };
  }, [open, item?.id]);

  /**
   * ⚠️ **Recitirea e ȚINUTĂ CU ID-UL EI și potrivită aici, nu golită într-un efect.** ⛔ Un
   * `setFresh(null)` la deschidere ar fi fost un `setState` direct în efect — chiar clasa de
   * avertismente pe care ACHU-401 o numește *altă muncă*, iar pragul de lint nu se ridică (§7).
   *
   * ✅ Și iese mai bine: potrivirea pe id face imposibil să apară o clipă avertismentul **vizitei
   * de dinainte** pe vizita deschisă acum — ce ar fi făcut o golire întârziată.
   */
  const shown = fresh?.id && fresh.id === item?.id ? fresh.record : item;

  const quoteNumberTrimmed = form.quoteNumber.trim();
  const quoteNumberError = quoteNumberTrimmed.length > 100 ? 'Quote Number cannot exceed 100 characters.' : '';

  /**
   * ACHU-421. Marking the draft Final is what moves the money onto the job —
   * the server does it in one transaction (amountCharged + quoteNumber, and
   * Enquiry → Confirmed), which is the rule approved as ACHU-191, reused here
   * rather than reimplemented.
   *
   * ⚠️ Closes via onSaved() instead of patching the form in place, and that is
   * not laziness. The server has just changed `amountCharged`, `quoteNumber`
   * and possibly `status` behind this dialog; the open form still holds the old
   * values AND a now-stale `_revision`. Leaving it open means the next Save
   * either writes £0 back over the price just applied, or — because the
   * revision moved — fails as a CONFLICT the user cannot interpret. Reloading
   * is the only outcome that is both correct and explicable.
   */
  const handleConfirmQuote = async () => {
    const pending = item?.pendingQuote;
    if (!pending) return;
    setConfirmingQuote(true);
    try {
      await setPriceQuoteStatus(pending.id, 'Final');
      toast.success(`Price applied — ${pending.quoteNumber}`);
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not apply the price');
    } finally {
      setConfirmingQuote(false);
    }
  };

  const handleSave = async () => {
    if (!form.customer || !form.jobDate || !form.service.trim()) { toast.error('Customer, date and service are required'); return; }
    if (quoteNumberError) { toast.error(quoteNumberError); return; }
    const FUTURE_STATUSES = new Set(['Confirmed', 'In Progress', 'Completion Review', 'Completed']);
    const todayLondon = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
    if (FUTURE_STATUSES.has(form.status) && form.jobDate < todayLondon) {
      toast.error(`Cannot set status to "${form.status}" for a job in the past. Use Enquiry, Booked, Cancelled, or No Access instead.`);
      return;
    }
    setSaving(true);
    try {
      const result = await saveJob({
        ...form, quoteNumber: quoteNumberTrimmed || null, id: item?.id, _revision: revisionRef.current,
        // ⚠️ Caseta goală trimite `null` — „nu s-a spus", nu „unul". Un `''` ar fi picat pe formă.
        cleanersNeeded: form.cleanersNeeded === '' ? null : Number(form.cleanersNeeded),
      });
      // ACHU-047: Show audit warning if present
      if (result.auditWarning) {
        console.warn('[JobDialog] Audit warning:', result.auditWarning);
        toast.warning('Record saved, but audit history could not be updated. The change was applied.', { duration: 6000 });
      } else if (result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success(item ? 'Job updated' : 'Job created');
      }
      setAuditRefreshKey(k => k + 1);
      guard.markSaved();
      onSaved();
    } catch (e) {
      toast.error(errMsg(e) || 'Failed to save job');
    } finally {
      setSaving(false);
    }
  };

  const isPast = form.jobDate && form.jobDate < new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date()) && !item;

  return (
    <Dialog open={open} onOpenChange={v => !v && guard.requestClose()}>
      {/* ACHU-508: `overflow-x-hidden` plus `min-w-0` on every grid cell below —
          same cause as ACHU-500/422, reported again by Roberto on the Edit Job
          dialog. A grid track will not shrink below its content, so one long
          value slid the whole dialog sideways. */}
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader><DialogTitle>{item ? 'Edit Job' : 'New Job'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {/* 🔴 §46 „Form recovery" (Sesiunea 150) — SUS, deasupra câmpurilor: o întrebare pusă sub
              ele ar fi citită după ce omul a început deja să scrie peste. */}
          {guard.recoveredDraft !== null && (
            <RestoreDraftBar
              onRestore={() => { setForm(guard.recoveredDraft as typeof form); guard.dismissDraft(); }}
              onDismiss={guard.dismissDraft}
            />
          )}
          {/**
            * 🔴 ACHU-507 (Sesiunea 108) — the Service Agreement promises the customer
            * we will not start work inside their 14-day cancellation period unless
            * they expressly ask. Nothing checked that at the point the work is
            * planned, so the promise was true in the document and unverified in
            * behaviour. Raised by the external solicitor.
            *
            * ⚠️ **A warning, not a block** — Roberto's decision, 09/08/2026. The
            * office decides; the app does not stop a real clean because of a rule it
            * cannot see the whole of. Placed at the TOP, above the fields, because a
            * caution that appears below the money is one nobody scrolls to.
            *
            * The sentence comes from the server (`lib/cancellationWindow.ts`), which
            * is also where every "say nothing" case is decided. `null` renders
            * nothing at all — an empty amber box would read as a fault.
            */}
          {shown?.cancellationWarning && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 flex items-start gap-2 dark:bg-amber-950/30 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-500" />
              <p className="text-xs text-amber-900 dark:text-amber-200">{shown?.cancellationWarning}</p>
            </div>
          )}
          <div><Label id="jobdlg-customer-label">Customer *</Label>
            {/* Sesiunea 28: was a dropdown of every customer — unusable once the
                list grows (owner: "trebuie sa scrolezi printre toti"). Searches
                server-side, so the full list never has to be loaded.

                ACHU-573: schimbarea clientului golește și casa aleasă — aceea aparține
                clientului de dinainte. Serverul refuză oricum legătura încrucișată, dar un
                formular care arată casa altcuiva până la Save e o eroare văzută prea târziu. */}
            <SearchablePicker
              labelId="jobdlg-customer-label"
              disabled={locked}
              value={form.customer}
              selectedLabel={item?.customerName}
              onSelect={id => setForm(f => ({ ...f, customer: id, propertyId: '' }))}
              fetchOptions={searchCustomers}
              triggerLabel="Select customer"
              placeholder="Search customers by name, email, phone…"
              emptyLabel="No customers found"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <div>
              <Label htmlFor="jobdialog-job-date">Job Date *</Label>
              <DateField id="jobdialog-job-date" disabled={locked} value={form.jobDate} onChange={e => setForm(f => ({ ...f, jobDate: e.target.value }))} />
              {isPast && <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Past date — historical record</p>}
            </div>
            <div><Label htmlFor="jobdialog-service">Service *</Label><Input id="jobdialog-service" disabled={locked} value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} /></div>
          </div>
          {/*
            NOU §9 (Sesiunea 157) - sub cele doua campuri care o produc (ziua si serviciul), nu
            intr-un toast de dupa Save: un avertisment care apare dupa scriere nu mai apara nimic.
            Propozitia e a serverului, cu numerele vizitelor in ea.
          */}
          {dupCheck.data?.message && <InlineNote>{dupCheck.data.message}</InlineNote>}
          {/**
            * ACHU-573 — casa, DEASUPRA adresei, fiindcă asta e ordinea în care se gândește:
            * întâi „la care casă", abia apoi „ce scriem pe vizită". Sub adresă, ar fi arătat
            * ca o etichetare de după, iar biroul ar fi retastat oricum.
            *
            * ⚠️ Se randează singur nimic dacă clientul nu are nicio casă — deci ecranul unui
            * client dinainte de proprietăți arată exact ca înainte.
            */}
          <JobPropertySelect
            customerId={form.customer}
            value={form.propertyId}
            disabled={locked}
            onPick={(propertyId, address) => setForm(f => ({ ...f, propertyId, address: address || f.address }))}
          />
          <div><Label htmlFor="jobdialog-address">Address</Label><Textarea id="jobdialog-address" disabled={locked} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} /></div>
          {/* ACHU-422: min-w-0 on the cells as well as TimeField's own clipping.
              A grid track defaults to `min-width: auto`, which means the COLUMN
              refuses to shrink below its content — so a native control with a
              user-agent minimum can widen the whole dialog even when the field
              inside it is clipped. Both halves are needed; either alone leaves
              the photographed overflow in place. */}
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <div className="min-w-0"><Label htmlFor="jobdialog-scheduled-start">Scheduled Start</Label><TimeField id="jobdialog-scheduled-start" disabled={locked} value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} /></div>
            <div className="min-w-0"><Label htmlFor="jobdialog-scheduled-finish">Scheduled Finish</Label><TimeField id="jobdialog-scheduled-finish" disabled={locked} value={form.finishTime} onChange={e => setForm(f => ({ ...f, finishTime: e.target.value }))} /></div>
          </div>
          {/*
            🔴 §9 „Cleaner count" (Sesiunea 160) — câți oameni trebuie la vizita asta.
            ⛔ **Nu repartizează pe nimeni și nu refuză nimic**, iar propoziția de sub casetă o
            spune: fără ea, biroul ar fi crezut că scrisul unui 2 aduce al doilea om de la sine.
          */}
          <div>
            <Label htmlFor="jobdialog-cleaners-needed">Cleaners needed</Label>
            <Input
              id="jobdialog-cleaners-needed"
              type="number"
              min={1}
              max={20}
              disabled={locked}
              value={form.cleanersNeeded}
              onChange={e => setForm(f => ({ ...f, cleanersNeeded: e.target.value }))}
              placeholder="Leave empty if nobody has said"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Just the number this job asks for — it does not assign anybody, and nothing is
              refused if more or fewer are put on it. The jobs list then shows “1 of 2” so a gap
              is visible before the morning.
            </p>
          </div>
          {item && (item.actualStartTime || item.actualFinishTime) && (
            <div className="bg-muted/40 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Actual Times</p>
              <div className="grid grid-cols-2 gap-2 text-sm [&>*]:min-w-0">
                <div><span className="text-muted-foreground text-xs">Actual Start</span><p className="font-medium">{fmtDateTime(item.actualStartTime)}</p></div>
                <div><span className="text-muted-foreground text-xs">Actual Finish</span><p className="font-medium">{fmtDateTime(item.actualFinishTime)}</p></div>
              </div>
              {/**
                * 🆕 §17 (Sesiunea 154) — abaterea de la fereastră, scrisă cu cifra, chiar sub orele
                * de care vorbește. ⚠️ **Propoziția întreagă, nu doar chipul:** în dialog e loc, iar
                * aici omul citește ca să decidă ceva, nu ca să baleieze o listă. ⛔ Nu apare nimic
                * când nu e nimic de spus — o linie „la timp" pe fiecare vizită ar fi învățat ochiul
                * să sară exact peste locul în care apare abaterea.
                */}
              {item.scheduleFlags?.map(f => (
                <p key={f.code} className="text-xs text-amber-800">{f.message}</p>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <div><Label htmlFor="jobdialog-status">Status</Label>
              <Select disabled={locked} value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger id="jobdialog-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.filter(s => item || !NOT_FOR_NEW_JOBS.has(s)).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.status === 'Completion Review' && (
                <p className="text-xs text-muted-foreground mt-1">Awaiting Admin review — pick Completed to approve or In Progress to send back.</p>
              )}
            </div>
            <div><Label htmlFor="jobdialog-amount-charged">Amount Charged (£)</Label><Input id="jobdialog-amount-charged" disabled={locked} type="number" step="0.01" min="0" value={form.amountCharged !== 0 ? form.amountCharged : ''} onFocus={e => e.target.select()} onChange={e => setForm(f => ({ ...f, amountCharged: parseFloat(e.target.value) || 0 }))} /></div>
          </div>
          {/* ACHU-421 — the suggested price, and the one click that applies it.
              Shown only while the job has no price of its own; the server drops
              `pendingQuote` to null the moment `amountCharged` is set, so this
              cannot invite confirming the same money twice. */}
          {item?.pendingQuote && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Calculator className="h-3 w-3 shrink-0" /> Suggested price — not applied yet
                  </p>
                  <p className="text-lg font-semibold">{fmt(item.pendingQuote.grandTotal)}</p>
                  <p className="text-xs text-muted-foreground break-all">
                    Quote {item.pendingQuote.quoteNumber}, calculated from this customer&apos;s request.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button size="sm" className="flex-1" onClick={handleConfirmQuote} disabled={confirmingQuote}>
                  {confirmingQuote ? 'Applying…' : 'Confirm this price'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => nav(`/admin/price-calculator?jobId=${encodeURIComponent(item.id)}`)}
                >
                  Adjust in calculator
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Confirming sets Amount Charged and the Quote Number, and moves an Enquiry to Confirmed.
              </p>
            </div>
          )}

          {item && (item.amountReceived !== undefined || item.outstandingBalance !== undefined) && (
            <div className="bg-muted/40 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Financial Summary</p>
              <div className="grid grid-cols-3 gap-2 text-sm [&>*]:min-w-0">
                <div><span className="text-muted-foreground text-xs">Received</span><p className="font-medium">{fmt(item.amountReceived)}</p></div>
                <div><span className="text-muted-foreground text-xs">Outstanding</span><p className={`font-medium ${(item.outstandingBalance ?? 0) > 0 ? 'text-orange-600' : ''}`}>{fmt(item.outstandingBalance)}</p></div>
                <div><span className="text-muted-foreground text-xs">Payment</span><StatusBadge status={item.paymentStatus} /></div>
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="jobdialog-quote-number">Quote Number</Label>
            {/* ⛔ NO EXAMPLE PLACEHOLDER HERE (ACHU-423). This read
                `placeholder="QT-1784598709482-9190"` — a made-up number, in a
                format this application has never generated (real ones are
                `ACHU-<year>-<hex>`, see backend priceCalculator.generateQuoteNumber).
                Grey placeholder text in a grey disabled-looking box is
                indistinguishable from data: Archana photographed exactly this
                field and read it as the job's quote number. An empty field must
                look empty. */}
            <Input id="jobdialog-quote-number" disabled={locked} value={form.quoteNumber} onChange={e => setForm(f => ({ ...f, quoteNumber: e.target.value }))} />
            {quoteNumberError && <p className="text-xs text-destructive mt-1">{quoteNumberError}</p>}
          </div>
          <div><Label htmlFor="jobdialog-customer-instructions">Customer Instructions</Label><Textarea id="jobdialog-customer-instructions" disabled={locked} value={form.customerInstructions} onChange={e => setForm(f => ({ ...f, customerInstructions: e.target.value }))} rows={2} placeholder="Visible to customer" /></div>
          <div><Label htmlFor="jobdialog-admin-notes">Admin Notes</Label><Textarea id="jobdialog-admin-notes" disabled={locked} value={form.adminNotes} onChange={e => setForm(f => ({ ...f, adminNotes: e.target.value }))} rows={2} placeholder="Internal only — not visible to cleaners or customers" /></div>
          {item?.cleanerCompletionNotes && (
            <div><Label htmlFor="jobdialog-cleaner-completion-notes">Cleaner Completion Notes</Label><Textarea id="jobdialog-cleaner-completion-notes" disabled={locked} value={form.cleanerCompletionNotes} onChange={e => setForm(f => ({ ...f, cleanerCompletionNotes: e.target.value }))} rows={2} className="bg-muted/50" /></div>
          )}

          {item?.id && (
            <>
              <Separator />
              <JobAssignmentsPanel jobId={item.id} jobInfo={{ jobDate: form.jobDate, startTime: form.startTime, service: form.service, address: form.address }} />
            </>
          )}

          {item?.id && (() => {
            const qrId = Array.isArray(item.quoteRequests) ? item.quoteRequests[0] : item.quoteRequests;
            return qrId ? (
              <>
                <Separator />
                <QuoteRequestSection quoteRequestId={qrId} />
              </>
            ) : null;
          })()}

          {/*
            ACHU-518 — placed ABOVE the checklist, and the order is the point: this is what the
            CUSTOMER said about their home (where the key is, the fragile shelf), so it belongs
            before the checklist somebody fills in on arrival, not after it.
          */}
          {item?.id && (
            <>
              <Separator />
              <JobPropertyInfoSection jobId={item.id} />
            </>
          )}

          {/*
            🆕 §9 „Linked incident" + „Linked complaint" (Sesiunea 158) — ce s-a RAPORTAT despre
            vizita asta. ⚠️ **Aici, deasupra checklistului**, fiindcă e context pentru tot restul
            ecranului: cine deschide o vizită cu o reclamație pe ea citește altfel orele și pozele.
            ⛔ Fără `Separator` propriu și fără titlu când nu e nimic — vezi componenta: o vizită fără
            incidente e cazul obișnuit, iar un „0 incidente" pe fiecare vizită e un rând care nu spune
            nimic pe toate ecranele ca să spună ceva pe unul.
          */}
          {item?.id && <JobLinkedRecordsSection jobId={item.id} />}

          {item?.id && (
            <>
              <Separator />
              <AdminChecklistSection jobId={item.id} />
            </>
          )}

          {/*
            §36 (Sesiunea 142) — nota BIROULUI despre vizită, plus ce au spus curățătorii despre
            ea. ⚠️ DUPĂ checklist și ÎNAINTE de bani, și ordinea e argumentul: se judecă munca
            după ce vezi ce era de făcut, dar înainte de a te uita la sumă — o notă pusă lângă
            preț devine o notă despre preț.
          */}
          {item?.id && (
            <>
              <Separator />
              <JobInternalRating jobId={item.id} />
            </>
          )}

          {/*
            ACHU-556 — ÎNAINTE de facturi, și ordinea e chiar argumentul: extrasele schimbă
            suma vizitei, iar factura o consumă. Citite invers, biroul ar emite factura și abia
            apoi ar vedea că mai avea o linie de adăugat — moment în care panoul se blochează
            singur și îi spune să anuleze factura.
          */}
          {item?.id && (
            <>
              <Separator />
              <JobServiceExtrasSection jobId={item.id} />
            </>
          )}

          {item?.id && (
            <>
              <Separator />
              <JobInvoicesSection jobId={item.id} amountCharged={form.amountCharged} paymentStatus={item.paymentStatus} />
            </>
          )}

          {/*
            §33 (Sesiunea 161) — hârtiile vizitei: evaluarea de risc, declarația de metodă, orice
            hârtie cerută pentru lucrarea asta. ⛔ **Doar biroul** — aceeași hotărâre ca la fișierele
            casei (Roberto, 14/08/2026); rândul „Access permissions" din §33 e al owner-ului.
            ⚠️ O evaluare de risc pe o vizită e chiar hârtia pe care ar trebui s-o citească omul de la
            ușă — dar a o deschide către curățător e o hotărâre, nu o alegere de programare.
          */}
          {item?.id && (
            <>
              <Separator />
              <DocumentsSection scope="Job" ownerId={item.id} title="Job documents" readOnly={locked} />
            </>
          )}

          {item?.id && <AuditHistory entityType="Job" entityId={item.id} refreshKey={auditRefreshKey} />}
          {/* ACHU-519 — a look becomes a change without closing and reopening, same as ACHU-444. */}
          {locked ? (
            <Button className="w-full" variant="outline" onClick={() => setLocked(false)}>Switch to editing</Button>
          ) : (
            <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          )}
        </div>
      </DialogContent>
      <DiscardChangesDialog open={guard.confirmOpen} onDiscard={guard.discard} onKeepEditing={guard.keepEditing} />
    </Dialog>
  );
}

