import { useState, useEffect, useMemo } from 'react';
import QuoteHistoryTable from './QuoteHistoryTable';
import { quotePdfPayload } from '@/lib/quotePdfPayload';
import QuoteLineItemsTable from './QuoteLineItemsTable';
import { useSearchParams } from 'react-router-dom';
import { Calculator, Loader2, Download, Save, Settings, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
// §7 (Sesiunea 150) — cât e de lucru, și ce înseamnă pentru 1/2/3 oameni. Fișier propriu: plafonul.
import QuoteWorkloadSummary from './QuoteWorkloadSummary';
import { Badge } from '@/components/ui/badge';
import { calculatePriceQuote, savePriceQuote, editPriceQuote, setPriceQuoteStatus, getPriceQuotes, getJobsForSelect, getInvoiceSettings } from '@/lib/endpoints';
import { ApiError } from '@/lib/apiClient';
// §8 felia a doua — lista vine din catalog (`services` + `service_items`), nu dintr-un fișier.
import { useServiceCatalogue, typedQuantities } from '@/lib/useServiceCatalogue';
import { generatePriceQuotePdf, type PdfQuoteData } from '@/lib/priceQuotePdf';
import type { PdfBusiness } from '@/lib/pdfShared';
import PdfPreviewDialog from '../shared/PdfPreviewDialog';
import { fmtDate } from '@/lib/format';
import SortControl from './SortControl';
import { sortRecords, readSortParams, writeSortParams, type SortDir } from '@/lib/sorting';
// ⚠️ §7 (Sesiunea 150) — pe ce se sortează lista de oferte a ieșit în `lib/quoteSortFields.ts`: e o
// descriere de DATE, nu randare, iar pagina e la clichetul ei de mărime.
import { QUOTE_SORT_FIELDS } from '@/lib/quoteSortFields';
import RefreshButton from '../shared/RefreshButton';
import RatesSettings from './PriceCalculatorRatesSettings';

/**
 * ACHU-401 (felia 20) — forma o publică acum `billingEndpoints.ts`, citită din ruta care o
 * produce. ⛔ Era scrisă de mână aici, iar ecranul de alături (Setările calculatorului) își
 * scria a doua copie a tarifelor — exact tiparul care a produs ACHU-741.
 */
import type { PriceQuoteRecord as QuoteRow, PriceQuoteLineItem, PriceQuoteCalculation } from '@/lib/billingEndpoints';
import type { JobForSelect } from '@/lib/jobEndpoints';

// ACHU-401 (felia 20) — era a doua copie scrisă de mână a rândului publicat la felia 19.
type JobOption = JobForSelect;

/**
 * What the form actually needs to hold once a job is chosen — and deliberately
 * NARROWER than `JobOption`.
 *
 * ⚠️ Two paths set it, and only one has the full row. The picker sets a whole
 * `JobOption`; reopening a saved quote (`handleEditQuote`) rebuilds it from the
 * quote's own columns, which carry no `service` and no `jobDate`. Typing this
 * as `JobOption` is what `tsc` refused — correctly, because the wider type
 * would have claimed two fields that are absent on the edit path. Nothing reads
 * them from here: the badge shows the number and the customer, and the request
 * sends `id`.
 */
type SelectedJob = Pick<JobOption, 'id' | 'jobId' | 'customerName'>;

/**
 * Sesiunea 26 (ACHU-E011) — Price Calculator, integrated as an Admin page.
 * Two ways to build a quote: pick an existing Job (its linked Quote Request's
 * quantities are used automatically, per owner request — "vrea sa calculeze
 * singur din jobs"), or enter quantities manually for a quote with no Job yet.
 *
 * Owner follow-up decisions: neither the time-per-unit nor the price is
 * fixed in code — every service has its OWN editable minutes + hourly rate
 * (Settings tab); and a saved quote is editable while "Draft", locked once
 * marked "Final" (ACHU-190) — the tab is called "Quotes", not "History",
 * and supports filtering by status/customer/job.
 */

/**
 * ACHU-401 (felia 20) — amândouă vin din funcția PURĂ de pe server (`priceCalculator.ts`), care
 * își publică forma. ⚠️ Aici banii sunt NUMERE, spre deosebire de rândul salvat, unde coloanele
 * `Decimal` sosesc ca șiruri — deosebirea e scrisă în `billingEndpoints.ts`.
 */
type LineItem = PriceQuoteLineItem;
type Calculation = PriceQuoteCalculation & { customerId?: string | null; jobId?: string | null; quoteNumber: string };

export default function PriceCalculatorPage() {
  // §8 felia a doua — serviciile și pozițiile lor, din catalog.
  const { serviceNames, fieldsByService } = useServiceCatalogue();
  const [view, setView] = useState<'calculate' | 'settings'>('calculate');
  const [mode, setMode] = useState<'job' | 'manual'>('job');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Job mode
  const [jobSearch, setJobSearch] = useState('');
  const [jobOptions, setJobOptions] = useState<JobOption[]>([]);
  const [selectedJob, setSelectedJob] = useState<SelectedJob | null>(null);

  // Manual mode
  const [services, setServices] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const [discountPercent, setDiscountPercent] = useState('0');
  /** §6 (Sesiunea 160) — pozițiile pe care clientul le poate lua sau nu. Motivele: `QuoteLineItemsTable`. */
  const [optionalFields, setOptionalFields] = useState<string[]>([]);

  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calc, setCalc] = useState<Calculation | null>(null);
  const [savedQuoteNumber, setSavedQuoteNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [quotes, setQuotes] = useState<QuoteRow[] | null>(null);
  const [quotesSearch, setQuotesSearch] = useState('');
  const [preview, setPreview] = useState<{ title: string; filename: string; build: () => Promise<string> } | null>(null);
  const [sp, setSp] = useSearchParams();
  const { sortBy, sortDir } = readSortParams(sp, 'createdAt', 'desc');
  const handleSort = (by: string, dir: SortDir) => writeSortParams(sp, by, dir, setSp);

  const loadQuotes = () => {
    getPriceQuotes({}).then(d => setQuotes(d.records)).catch(() => setQuotes([]));
  };
  useEffect(loadQuotes, []);

  const filteredQuotes = useMemo(() => {
    if (!quotes) return [];
    const term = quotesSearch.trim().toLowerCase();
    const matched = term
      ? quotes.filter(q => `${q.customerName ?? ''} ${q.jobDisplayId ?? ''} ${q.quoteNumber ?? ''}`.toLowerCase().includes(term))
      : quotes;
    const field = QUOTE_SORT_FIELDS.find(f => f.key === sortBy) ?? QUOTE_SORT_FIELDS[0];
    return sortRecords(matched, field, sortDir);
  }, [quotes, quotesSearch, sortBy, sortDir]);

  useEffect(() => {
    if (mode !== 'job' || !jobSearch.trim()) { setJobOptions([]); return; }
    const t = setTimeout(() => {
      getJobsForSelect({ search: jobSearch }).then(d => setJobOptions(d.jobs ?? [])).catch(() => setJobOptions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [jobSearch, mode]);

  const toggleService = (service: string, checked: boolean) => {
    setServices(s => checked ? [...s, service] : s.filter(x => x !== service));
  };
  const setQuantity = (key: string, value: string) => setQuantities(q => ({ ...q, [key]: value }));

  // ⚠️ §8 felia a doua — `toIntOrUndefined` a plecat odată cu buclele de cantități: acum e în
  // `typedQuantities` (`src/lib/useServiceCatalogue.ts`), într-un singur loc pentru cele trei ecrane.

  const resetResult = () => { setCalc(null); setSavedQuoteNumber(null); setError(null); };

  const handleNewQuote = () => {
    setEditingId(null);
    setMode('job');
    setSelectedJob(null);
    setJobSearch('');
    setServices([]);
    setQuantities({});
    setDiscountPercent('0');
    resetResult();
  };

  const handleEditQuote = (row: QuoteRow) => {
    setEditingId(row.id);
    setDiscountPercent(String(row.discountPercent));
    setOptionalFields(row.optionalFields ?? []);
    resetResult();
    if (row.jobId) {
      setMode('job');
      setSelectedJob({ id: row.jobId, jobId: row.jobDisplayId, customerName: row.customerName });
      setJobSearch(`Job #${row.jobDisplayId ?? ''} — ${row.customerName ?? ''}`);
    } else {
      setMode('manual');
      setSelectedJob(null);
      const lineItems = (row.lineItems ?? []) as LineItem[];
      setServices(Array.from(new Set(lineItems.map(li => li.group))));
      setQuantities(Object.fromEntries(lineItems.map(li => [li.field, String(li.quantity)])));
    }
    setView('calculate');
  };

  /**
   * ACHU-421 — arriving from a Job's "Adjust in calculator" button.
   *
   * Opens the job's EXISTING draft for editing rather than starting a blank
   * quote: the draft was already calculated from that customer's request, and
   * offering an empty form here would mean re-entering quantities the app
   * already holds — which is the very thing this whole change removes.
   *
   * ⚠️ The state writes sit inside the promise callback deliberately. Calling
   * them straight from the effect body would trip `react-hooks/set-state-in-effect`,
   * and the lint gate is an EXACT ratchet (CLAUDE.md §2.1a) — one new warning
   * fails the build. This is also simply more correct: the row is not known
   * until the request returns.
   * 🔴 This comment used to name the figure ("888"); it had moved four times
   * since. The rule is the fact worth writing down, not the number of the day.
   */
  useEffect(() => {
    const jobId = sp.get('jobId');
    if (!jobId) return;
    getPriceQuotes({ jobId })
      .then(d => {
        const rows: QuoteRow[] = d.records ?? [];
        const target = rows.find(r => r.status === 'Draft') ?? rows[0];
        if (target) handleEditQuote(target);
        // Consume the parameter so a refresh does not reopen the same quote
        // over whatever the user has since typed.
        const next = new URLSearchParams(sp);
        next.delete('jobId');
        setSp(next, { replace: true });
      })
      .catch(() => { /* the calculator still works; the user can pick the job by hand */ });
    // Mount-only: this is a one-shot hand-off from another page, not a
    // subscription. Re-running it when `sp` changes would reopen the quote over
    // whatever the user has since typed — the parameter is consumed above for
    // the same reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCalculate = async () => {
    setError(null);
    const discount = parseFloat(discountPercent) || 0;

    setCalculating(true);
    try {
      let body: Record<string, unknown>;
      if (mode === 'job') {
        if (!selectedJob) { setError('Select a Job first.'); setCalculating(false); return; }
        body = { jobId: selectedJob.id, discountPercent: discount, ...(optionalFields.length ? { optionalFields } : {}) };
      } else {
        const qty = typedQuantities(services, fieldsByService, quantities);
        if (Object.keys(qty).length === 0) { setError('Select at least one service with a quantity.'); setCalculating(false); return; }
        body = { quantities: qty, discountPercent: discount, ...(optionalFields.length ? { optionalFields } : {}) };
      }
      const result = await calculatePriceQuote(body);
      setCalc(result);
      setSavedQuoteNumber(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Calculation failed.');
    } finally {
      setCalculating(false);
    }
  };

  const handleSave = async () => {
    if (!calc) return;
    setSaving(true);
    setError(null);
    try {
      const discount = parseFloat(discountPercent) || 0;
      const body: Record<string, unknown> = mode === 'job'
        // ⚠️ Lista pleacă doar dacă e bifat ceva: serverul citește lipsa ca „nicio poziție de ales".
        ? { jobId: selectedJob.id, discountPercent: discount, quoteNumber: calc.quoteNumber, ...(optionalFields.length ? { optionalFields } : {}) }
        : { quantities: typedQuantities(services, fieldsByService, quantities), discountPercent: discount, quoteNumber: calc.quoteNumber, ...(optionalFields.length ? { optionalFields } : {}) };
      const res = editingId ? await editPriceQuote(editingId, body) : await savePriceQuote(body);
      setSavedQuoteNumber(res.quoteNumber);
      loadQuotes();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (row: QuoteRow) => {
    await setPriceQuoteStatus(row.id, row.status === 'Draft' ? 'Final' : 'Draft');
    loadQuotes();
  };

  // Sesiunea 26 (ACHU-196): PDFs are previewed in a dialog first, and only
  // downloaded if the user actually wants the file ("vreau sa am preview
  // inainte de download"). The quote PDF now also carries the business's own
  // details, read from Invoice Settings — the same single source of truth the
  // invoice PDF uses, so the two documents show identical company info.
  const buildQuotePdf = (data: Omit<PdfQuoteData, 'business'>) => async () => {
    let business: PdfBusiness = {};
    try {
      const s = (await getInvoiceSettings()).settings;
      business = {
        name: s.businessLegalName,
        address: s.businessAddress,
        companyRegNumber: s.companyRegistrationNumber,
        vatNumber: s.vatRegistered ? s.vatNumber : null,
      };
    } catch {
      // Settings unreachable — still produce the PDF, just without them.
    }
    return (await generatePriceQuotePdf({ ...data, business }, 'preview')) as string;
  };

  const handlePreviewCurrentPdf = () => {
    if (!calc) return;
    setPreview({
      title: `Quote ${calc.quoteNumber}`,
      filename: `ACHU-Quote-${calc.quoteNumber}.pdf`,
      build: buildQuotePdf(quotePdfPayload({ ...calc, createdAt: new Date().toISOString() }, selectedJob?.customerName)),
    });
  };

  const handlePreviewRowPdf = (row: QuoteRow) => {
    setPreview({
      title: `Quote ${row.quoteNumber}`,
      filename: `ACHU-Quote-${row.quoteNumber}.pdf`,
      build: buildQuotePdf(quotePdfPayload({
        ...row, subtotal: Number(row.subtotal), discountAmount: Number(row.discountAmount), grandTotal: Number(row.grandTotal),
      }, row.customerName ?? undefined)),
    });
  };

  const isEditingDisabled = editingId !== null && quotes?.find(q => q.id === editingId)?.status === 'Final';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-bold">Price Calculator</h2>
        </div>
        <div className="flex gap-2 items-center">
          <RefreshButton onRefresh={loadQuotes} />
          <Button variant={view === 'calculate' ? 'default' : 'outline'} size="sm" onClick={() => setView('calculate')}>Calculate</Button>
          <Button variant={view === 'settings' ? 'default' : 'outline'} size="sm" onClick={() => setView('settings')}><Settings className="h-3.5 w-3.5 mr-1.5" />Settings</Button>
        </div>
      </div>

      {view === 'settings' ? (
        <RatesSettings />
      ) : (
        <>
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex gap-2 flex-wrap">
                  <Button variant={mode === 'job' ? 'default' : 'outline'} size="sm" onClick={() => { setMode('job'); resetResult(); }} disabled={!!editingId && mode !== 'job'}>From a Job</Button>
                  <Button variant={mode === 'manual' ? 'default' : 'outline'} size="sm" onClick={() => { setMode('manual'); resetResult(); }} disabled={!!editingId && mode !== 'manual'}>Manual Entry</Button>
                </div>
                {editingId && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="whitespace-nowrap shrink-0">Editing an existing quote</Badge>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={handleNewQuote}><Plus className="h-3.5 w-3.5 mr-1" />New Quote</Button>
                  </div>
                )}
              </div>

              {isEditingDisabled && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                  This quote is Final and cannot be edited — reopen it from the Quotes list below first.
                </p>
              )}

              {mode === 'job' ? (
                <div className="space-y-2">
                  <Label htmlFor="pricecalcu-search-job-by-customer">Search Job (by customer, service, or address)</Label>
                  <Input id="pricecalcu-search-job-by-customer" value={jobSearch} onChange={e => { setJobSearch(e.target.value); setSelectedJob(null); resetResult(); }} placeholder="Type to search..." disabled={!!editingId} />
                  {jobOptions.length > 0 && !selectedJob && (
                    <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
                      {jobOptions.map(j => (
                        <button key={j.id} className="w-full text-left p-2 text-sm hover:bg-muted/50" onClick={() => { setSelectedJob(j); setJobOptions([]); setJobSearch(`Job #${j.jobId} — ${j.customerName}`); }}>
                          Job #{j.jobId} — {j.customerName} — {j.service} ({fmtDate(j.jobDate)})
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedJob && <Badge variant="outline">Selected: Job #{selectedJob.jobId} — {selectedJob.customerName}</Badge>}
                </div>
              ) : (
                /* ACHU-523: un grup de bifă e chiar cazul pentru care există `fieldset` +
                   `legend` — forma NATIVĂ, care nu are nevoie de niciun atribut ARIA. */
                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium leading-none">Select Services</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {serviceNames.map(service => (
                      <label key={service} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={services.includes(service)} onCheckedChange={c => toggleService(service, c === true)} disabled={isEditingDisabled} />
                        {service}
                      </label>
                    ))}
                  </div>
                  {services.map(service => (
                    <div key={service} className="border rounded-md p-3 space-y-2">
                      <p className="text-sm font-medium">{service} — quantities</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {(fieldsByService[service] ?? []).map(field => (
                          <div key={field.key}>
                            <Label htmlFor={`calc-${service}-${field.key}`} className="text-xs">{field.label}</Label>
                            <Input id={`calc-${service}-${field.key}`} type="number" min="0" value={quantities[field.key] ?? ''} onChange={e => setQuantity(field.key, e.target.value)} disabled={isEditingDisabled} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </fieldset>
              )}

              <div className="w-40"><Label htmlFor="pricecalcu-discount">Discount (%)</Label><Input id="pricecalcu-discount" type="number" min="0" max="100" value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} disabled={isEditingDisabled} /></div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button onClick={handleCalculate} disabled={calculating || isEditingDisabled}>
                {calculating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Calculate
              </Button>
            </CardContent>
          </Card>

          {calc && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Breakdown</h3>

                {calc.unpriced.length > 0 && (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                    No rate configured yet for: {calc.unpriced.join(', ')} — set it on the Settings tab, these were left out of the total.
                  </p>
                )}

                <QuoteLineItemsTable
                  lineItems={calc.lineItems}
                  optionalFields={optionalFields}
                  disabled={isEditingDisabled}
                  onToggleOptional={(field, optional) => setOptionalFields(prev =>
                    optional ? [...prev, field] : prev.filter(f => f !== field))}
                />

                {/* 🔴 §7 (Sesiunea 150) — cât e de lucru, ÎNAINTEA banilor: fereastra vizitei se
                    hotărăște din durată, iar cine cotează vedea până azi doar minutele pe rând. */}
                <QuoteWorkloadSummary totalMinutes={calc.totalMinutes} />

                <div className="flex justify-end">
                  <div className="w-64 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>£{calc.subtotal.toFixed(2)}</span></div>
                    {calc.discountAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-£{calc.discountAmount.toFixed(2)}</span></div>}
                    <div className="flex justify-between font-semibold text-base pt-1 border-t"><span>Grand Total</span><span>£{calc.grandTotal.toFixed(2)}</span></div>
                  </div>
                </div>

                {savedQuoteNumber && <p className="text-sm text-green-700">Saved as {savedQuoteNumber}.</p>}

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={handlePreviewCurrentPdf}><Download className="h-4 w-4 mr-1.5" />Preview PDF</Button>
                  <Button onClick={handleSave} disabled={saving || !!savedQuoteNumber}>
                    {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}<Save className="h-4 w-4 mr-1.5" />{editingId ? 'Save Changes' : 'Save to History'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Quotes</h3>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="relative max-w-sm flex-1 w-full sm:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" aria-label="Search quotes" placeholder="Search quotes..." value={quotesSearch} onChange={e => setQuotesSearch(e.target.value)} />
                </div>
                <SortControl options={QUOTE_SORT_FIELDS} sortBy={sortBy} sortDir={sortDir} onChange={handleSort} />
              </div>

              {quotes === null ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : filteredQuotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No quotes match.</p>
              ) : (
                <QuoteHistoryTable
                  quotes={filteredQuotes}
                  onPreview={handlePreviewRowPdf}
                  onEdit={handleEditQuote}
                  onToggleStatus={handleToggleStatus}
                  onChanged={loadQuotes}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {preview && (
        <PdfPreviewDialog
          open
          onClose={() => setPreview(null)}
          title={preview.title}
          filename={preview.filename}
          build={preview.build}
        />
      )}
    </div>
  );
}

