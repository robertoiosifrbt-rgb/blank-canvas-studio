import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import DateField from '@/components/shared/DateField';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState, useEffect, useCallback, useRef } from 'react';
import { saveExpense, getJobsForSelect, type JobForSelect } from '@/lib/endpoints';
import { uploadFile, getReceiptUrl } from '@/lib/storage';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Upload, FileText, Eye, Trash2 } from 'lucide-react';
import { fmtDate } from '@/lib/format';
import { MAX_PDF_BYTES } from '@/lib/validation';
import { calculateFileSHA256 } from '@/lib/fileHash';
import SearchablePicker, { type PickerOption } from '../shared/SearchablePicker';
import DiscardChangesDialog from '../shared/DiscardChangesDialog';
// §46 „Form recovery" (Sesiunea 150) — bara care întreabă dacă se pune înapoi ce s-a scris.
import RestoreDraftBar from '../shared/RestoreDraftBar';
import { useUnsavedGuard } from '@/lib/useUnsavedGuard';
import AuditHistory from './AuditHistory';
import { computeRevision, REVISION_FIELDS } from '@/lib/concurrency';
import { errMsg } from '@/lib/errorMessage';
// ACHU-746 — `expenseDate` sosește ca timestamp întreg din ruta de listă; vezi acolo de ce.
import { toDateInputValue } from '@/lib/ukDate';
// ACHU-401 (felia 19) — forma pe care o citește dialogul, aceeași cu a listei.
import type { ExpenseRecord } from '@/lib/adminRecordTypes';

const categories = ['Cleaning Supplies', 'Equipment', 'Fuel', 'Parking', 'Vehicle', 'Insurance', 'Marketing', 'Printing', 'Uniform', 'Software', 'Phone', 'Bank Fees', 'Professional Fees', 'Staff Payment', 'Refund', 'Other'];
const methods = ['Card', 'Cash', 'Bank Transfer', 'Other'];
const docTypes = ['Receipt', 'Invoice', 'Credit Note', 'Other'];

/** Ce ține formularul între deschidere și Save — nu forma înregistrării salvate. */
type ExpenseFormState = {
  expenseDate: string; supplier: string; category: string; description: string; amount: number;
  paymentMethod: string; paidBy: string; receiptAvailable: boolean; notes: string; correctionNotes: string; linkedJob: string;
  documentType: string; documentNumber: string; subtotal: number | null | undefined; vatAmount: number | null | undefined; currency: string;
  manuallyReviewed: boolean;
};

export default function ExpenseDialog({ open, onClose, item, onSaved, prefill }: {
  open: boolean; onClose: () => void; item: ExpenseRecord | null; onSaved: () => void;
  /**
   * Câmpuri cu care se deschide o cheltuială NOUĂ, plus cele două lucruri care nu sunt în
   * formular: bonul deja încărcat și eticheta vizitei alese. ⚠️ Nimic din aplicație nu-l
   * trimite azi — rămâne fiindcă scanarea de bonuri e chiar cazul pentru care există.
   */
  prefill?: Partial<ExpenseFormState> & { receiptFileUrl?: string; linkedJobLabel?: string };
}) {
  const [form, setForm] = useState<ExpenseFormState>({
    expenseDate: '', supplier: '', category: '', description: '', amount: 0,
    paymentMethod: '', paidBy: '', receiptAvailable: false, notes: '', correctionNotes: '', linkedJob: '',
    documentType: '', documentNumber: '', subtotal: undefined, vatAmount: undefined, currency: 'GBP',
    manuallyReviewed: false,
  });
  // Bare storage path (or, for rows saved before the private-bucket
  // migration, a legacy full public URL) — what actually gets persisted.
  const [receiptFileUrl, setReceiptFileUrl] = useState('');
  // SHA256 hash of receipt file for duplicate detection (ACHU-201)
  const [receiptFileHash, setReceiptFileHash] = useState('');
  // Signed, time-limited URL resolved from `receiptFileUrl` for on-screen
  // display only — never sent back to the server.
  const [receiptDisplayUrl, setReceiptDisplayUrl] = useState('');
  const [receiptDisplayError, setReceiptDisplayError] = useState('');
  const [resolvingReceiptUrl, setResolvingReceiptUrl] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [selectedJobLabel, setSelectedJobLabel] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idempotencyTokenRef = useRef('');
  const revisionRef = useRef<string | undefined>(undefined);
  // Sesiunea 29 (backlog 46): an Expense form can hold extracted receipt fields
  // that took a scan to produce — losing them to a stray click is expensive.
  /**
   * §46 „Form recovery" (Sesiunea 150) — 🔴 **cel mai scump formular de pierdut din aplicație:**
   * câmpurile pot veni din scanarea unui bon, iar aceea nu se repetă cu un click. ⚠️ Cheia poartă
   * identitatea cheltuielii; motivul întreg e în `lib/useUnsavedGuard.ts`.
   */
  const guard = useUnsavedGuard({ onClose, draftKey: `expense:${item?.id ?? 'new'}` });
  guard.track({ form, receiptFileUrl });

  function generateToken() { idempotencyTokenRef.current = crypto.randomUUID(); }

  useEffect(() => {
    if (item) {
      const ljid = item.linkedJobId;
      const initial = {
        expenseDate: toDateInputValue(item.expenseDate), supplier: item.supplier ?? '', category: item.category ?? '',
        description: item.description ?? '', amount: item.amount ?? 0, paymentMethod: item.paymentMethod ?? '',
        paidBy: item.paidBy ?? '', receiptAvailable: item.receiptAvailable ?? false, notes: item.notes ?? '',
        correctionNotes: '', linkedJob: ljid ?? '',
        documentType: item.documentType ?? '', documentNumber: item.documentNumber ?? '',
        subtotal: item.subtotal != null ? item.subtotal : undefined, vatAmount: item.vatAmount != null ? item.vatAmount : undefined, currency: item.currency ?? 'GBP',
        manuallyReviewed: item.manuallyReviewed ?? false,
      };
      setForm(initial);
      guard.captureBaseline({ form: initial, receiptFileUrl: item.receiptFileUrl ?? '' });
      // ACHU-197: was reading item.receiptFile?.[0]?.url, a shape the
      // backend never sends (it returns the Expense row as-is, with a
      // plain receiptFileUrl string) — an existing receipt never showed
      // when reopening an expense for edit. Fixed while touching this
      // code for the private-bucket migration.
      setReceiptFileUrl(item.receiptFileUrl ?? '');
      // Sesiunea 28: the label comes straight off the record the list already
      // fetched (`linkedJobLabel`, built in expenses.ts). This used to call
      // loadLinkedJobInfo(), which downloaded EVERY job just to find the name
      // of the one already linked.
      setSelectedJobLabel(ljid ? (item.linkedJobLabel || `Job ${ljid}`) : undefined);
      revisionRef.current = computeRevision(item, REVISION_FIELDS.expense);
    } else {
      const base = {
        expenseDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date()),
        supplier: '', category: '', description: '', amount: 0, paymentMethod: '', paidBy: '',
        receiptAvailable: false, notes: '', correctionNotes: '', linkedJob: '',
        documentType: '', documentNumber: '', subtotal: undefined, vatAmount: undefined, currency: 'GBP',
        manuallyReviewed: false,
      };
      const initial = prefill ? { ...base, ...prefill } : base;
      setForm(initial);
      guard.captureBaseline({ form: initial, receiptFileUrl: prefill?.receiptFileUrl ?? '' });
      setReceiptFileUrl(prefill?.receiptFileUrl ?? '');
      setSelectedJobLabel(prefill?.linkedJobLabel);
    }
    setError('');
    generateToken();
    if (!item) revisionRef.current = undefined;
  }, [item, open, prefill]);

  // Resolve a fresh signed URL for display whenever the persisted receipt
  // path changes (existing item loaded, new file uploaded, or removed).
  useEffect(() => {
    let cancelled = false;
    setReceiptDisplayError('');
    if (!receiptFileUrl) { setReceiptDisplayUrl(''); return; }
    setResolvingReceiptUrl(true);
    getReceiptUrl(receiptFileUrl)
      .then(url => { if (!cancelled) setReceiptDisplayUrl(url); })
      .catch((e: unknown) => {
        if (cancelled) return;
        setReceiptDisplayUrl('');
        setReceiptDisplayError(errMsg(e) ?? 'Unknown error');
        console.error('[ExpenseDialog] Failed to resolve receipt preview URL:', e);
      })
      .finally(() => { if (!cancelled) setResolvingReceiptUrl(false); });
    return () => { cancelled = true; };
  }, [receiptFileUrl]);

  const searchJobs = useCallback(async (q: string): Promise<PickerOption[]> => {
    const res = await getJobsForSelect(q ? { search: q } : {});
    return res.jobs.map((j: JobForSelect): PickerOption => ({
      id: j.id,
      label: `#${j.jobId} — ${j.service} — ${j.customerName}`,
      hint: `(${fmtDate(j.jobDate)})`,
    }));
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > MAX_PDF_BYTES) { setError(`File exceeds ${Math.floor(MAX_PDF_BYTES / 1024 / 1024)} MB limit`); return; }
    setUploading(true); setError('');
    try {
      const hash = await calculateFileSHA256(file);
      const { path } = await uploadFile({ data: file, filename: file.name });
      setReceiptFileUrl(path);
      setReceiptFileHash(hash);
      setForm(f => ({ ...f, receiptAvailable: true }));
      toast.success('Receipt uploaded');
    } catch (e) { setError(errMsg(e) ?? 'Upload failed'); }
    finally { setUploading(false); }
  };

  const handleRemoveReceipt = () => {
    setReceiptFileUrl('');
    setReceiptFileHash('');
    setForm(f => ({ ...f, receiptAvailable: false }));
    setShowRemoveConfirm(false);
  };

  const isImage = receiptFileUrl && /\.(jpg|jpeg|png|webp|gif)/i.test(receiptFileUrl);
  const isPdf = receiptFileUrl && /\.pdf/i.test(receiptFileUrl);

  const handleSaveClick = async () => {
    if (!form.supplier.trim() || !form.expenseDate) { setError('Supplier and date are required'); return; }
    if (form.amount <= 0) { setError('Amount must be greater than zero'); return; }
    if (saving) return;
    setSaving(true); setError('');
    try {
      /**
       * 🔴 ACHU-748 — citea `item.receiptFile?.length`, o formă pe care ruta **nu o trimite**:
       * aceeași greșeală semnalată deja mai sus pentru AFIȘARE (ACHU-197), rămasă aici, pe
       * calea de ȘTERGERE. Deci `removeReceipt` nu pleca niciodată, iar bonul pe care biroul
       * credea că l-a scos rămânea atașat de cheltuială. Ruta cere anunțul explicit: fără el,
       * „fără bon" arată identic cu „bonul nu s-a atins" (`expenses.ts`).
       */
      const existingHadReceipt = Boolean(item?.receiptFileUrl);
      const removingReceipt = existingHadReceipt && !receiptFileUrl;
      const res = await saveExpense({
        ...form, id: item?.id, _revision: revisionRef.current, voidStatus: item?.voidStatus || 'Active',
        correctionNotes: form.correctionNotes || undefined,
        linkedJob: form.linkedJob || undefined,
        idempotencyToken: item?.id ? undefined : idempotencyTokenRef.current,
        receiptFileUrl: receiptFileUrl || undefined,
        receiptFileHash: receiptFileHash || undefined,
        removeReceipt: removingReceipt || undefined,
        documentType: form.documentType || undefined,
        documentNumber: form.documentNumber || undefined,
        subtotal: form.subtotal !== undefined ? form.subtotal : undefined,
        vatAmount: form.vatAmount !== undefined ? form.vatAmount : undefined,
        currency: form.currency || undefined,
        extractionStatus: item?.extractionStatus,
        extractionConfidence: item?.extractionConfidence,
        extractionNotes: item?.extractionNotes,
        manuallyReviewed: form.manuallyReviewed,
      });
      // ACHU-047: Show audit warning if present
      if (res.auditWarning) {
        console.warn('[ExpenseDialog] Audit warning:', res.auditWarning);
        toast.warning('Record saved, but audit history could not be updated. The change was applied.', { duration: 6000 });
      } else {
        toast.success(item ? 'Expense updated' : 'Expense recorded');
      }
      setAuditRefreshKey(k => k + 1);
      guard.markSaved();
      onSaved();
    } catch (e) { setError(errMsg(e) || 'Failed to save expense'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && guard.requestClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? 'Edit Expense' : 'Record Expense'}</DialogTitle></DialogHeader>
        {item?.voidStatus === 'Voided' && <Badge variant="destructive" className="w-fit">Voided</Badge>}
        <div className="space-y-3">
          {/* 🔴 §46 „Form recovery" (Sesiunea 150) — SUS, deasupra câmpurilor. ⚠️ Pune înapoi și calea
              bonului: fără ea, formularul ar fi recuperat cifrele și ar fi pierdut poza din care au
              venit — adică o cheltuială care arată completă și nu are dovadă. */}
          {guard.recoveredDraft !== null && (
            <RestoreDraftBar
              onRestore={() => {
                const draft = guard.recoveredDraft as { form: typeof form; receiptFileUrl: string };
                setForm(draft.form);
                setReceiptFileUrl(draft.receiptFileUrl ?? '');
                guard.dismissDraft();
              }}
              onDismiss={guard.dismissDraft}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="expensedia-date">Date *</Label><DateField id="expensedia-date" value={form.expenseDate} onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))} /></div>
            <div><Label htmlFor="expensedia-amount">Amount (£) *</Label><Input id="expensedia-amount" type="number" step="0.01" value={form.amount !== 0 ? form.amount : ''} onFocus={e => e.target.select()} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} /></div>
          </div>
          <div><Label htmlFor="expensedia-supplier">Supplier *</Label><Input id="expensedia-supplier" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} /></div>
          <div><Label htmlFor="expensedia-category">Category</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger id="expensedia-category"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="expensedia-description">Description</Label><Textarea id="expensedia-description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="expensedia-payment-method">Payment Method</Label>
              <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                <SelectTrigger id="expensedia-payment-method"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{methods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="expensedia-paid-by">Paid By</Label><Input id="expensedia-paid-by" value={form.paidBy} onChange={e => setForm(f => ({ ...f, paidBy: e.target.value }))} /></div>
          </div>

          {/* Linked Job */}
          <div>
            {/* ⚠️ `labelId`, nu `htmlFor` — vezi antetul lui `SearchablePicker`: componenta
                randează trei lucruri diferite după stare, deci un `for=` ar rămâne suspendat
                într-una dintre ele. */}
            <Label id="expense-linked-job-label">Linked Job (optional)</Label>
            {/* Sesiunea 28: this dialog had the original hand-rolled version of
                this picker — the one the owner pointed to as the behaviour they
                wanted everywhere. Now shares the extracted component with Jobs
                and Payments instead of being a third copy. */}
            <SearchablePicker
              value={form.linkedJob}
              selectedLabel={selectedJobLabel}
              onSelect={(id, option) => {
                setForm(f => ({ ...f, linkedJob: id }));
                setSelectedJobLabel(option?.label);
              }}
              fetchOptions={searchJobs}
              triggerLabel="Select Job"
              placeholder="Search jobs by number, service, customer…"
              emptyLabel="No jobs found"
              labelId="expense-linked-job-label"
            />
          </div>

          <Separator />

          {/* Receipt Section */}
          <div className="space-y-3" role="group" aria-labelledby="expense-receipt-label">
            {/* ACHU-523: TITLU peste un grup (încărcare, previzualizare, ștergere), nu eticheta
                unui câmp. `role="group"` + `aria-labelledby` spune cititorului de ecran la ce
                se referă butoanele; un `<Label>` singur nu e asociat cu niciunul. */}
            <Label id="expense-receipt-label" className="flex items-center gap-1.5"><FileText className="h-4 w-4" /> Receipt / Document</Label>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileUpload} />

            {receiptFileUrl ? (
              <div className="border border-border rounded-lg overflow-hidden">
                {resolvingReceiptUrl ? (
                  <div className="flex items-center gap-2 p-4 bg-muted/20">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Loading preview...</span>
                  </div>
                ) : receiptDisplayError ? (
                  <div className="flex items-start gap-2 p-4 bg-destructive/10">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-destructive font-medium">Could not load receipt preview</p>
                      <p className="text-xs text-destructive/80 mt-0.5">{receiptDisplayError}</p>
                    </div>
                  </div>
                ) : isImage ? (
                  <img src={receiptDisplayUrl} alt="Receipt" className="w-full max-h-40 object-contain bg-muted/20" />
                ) : isPdf ? (
                  <div className="flex items-center gap-2 p-4 bg-muted/20">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                    <a href={receiptDisplayUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">View PDF</a>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-4 bg-muted/20">
                    <Eye className="h-4 w-4" />
                    <a href={receiptDisplayUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">View file</a>
                  </div>
                )}
                <div className="flex gap-2 p-2 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}><Upload className="h-3.5 w-3.5 mr-1" />Replace</Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setShowRemoveConfirm(true)}><Trash2 className="h-3.5 w-3.5 mr-1" />Remove</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Uploading...</> : <><Upload className="h-4 w-4 mr-1" />Upload Receipt</>}
              </Button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="expensedia-document-type" className="text-xs">Document Type</Label>
                <Select value={form.documentType} onValueChange={v => setForm(f => ({ ...f, documentType: v }))}>
                  <SelectTrigger id="expensedia-document-type" className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{docTypes.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="expensedia-document-number" className="text-xs">Document Number</Label><Input id="expensedia-document-number" className="h-8 text-sm" value={form.documentNumber} onChange={e => setForm(f => ({ ...f, documentNumber: e.target.value }))} placeholder="INV-001" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label htmlFor="expensedia-subtotal" className="text-xs">Subtotal (£)</Label><Input id="expensedia-subtotal" className="h-8 text-sm" type="number" step="0.01" value={form.subtotal ?? ''} onChange={e => setForm(f => ({ ...f, subtotal: e.target.value === '' ? null : parseFloat(e.target.value) }))} /></div>
              <div><Label htmlFor="expensedia-vat" className="text-xs">VAT (£)</Label><Input id="expensedia-vat" className="h-8 text-sm" type="number" step="0.01" value={form.vatAmount ?? ''} onChange={e => setForm(f => ({ ...f, vatAmount: e.target.value === '' ? null : parseFloat(e.target.value) }))} /></div>
              <div><Label htmlFor="expensedia-currency" className="text-xs">Currency</Label><Input id="expensedia-currency" className="h-8 text-sm" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} /></div>
            </div>

            {item?.extractionStatus && (
              <div className="bg-muted/40 rounded-lg p-2 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Extraction:</span>
                  <Badge variant="outline" className="text-xs">{item.extractionStatus}</Badge>
                  {item.extractionConfidence != null && <span className="text-muted-foreground">({item.extractionConfidence}%)</span>}
                </div>
                {item.extractionNotes && <p className="text-muted-foreground">{item.extractionNotes}</p>}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox id="expensedia-manually-reviewed" checked={form.manuallyReviewed} onCheckedChange={v => setForm(f => ({ ...f, manuallyReviewed: !!v }))} />
              <Label htmlFor="expensedia-manually-reviewed" className="text-sm">Manually Reviewed</Label>
            </div>
          </div>

          <Separator />

          <div><Label htmlFor="expensedia-notes">Notes</Label><Textarea id="expensedia-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          {item && (
            <div>
              <Label htmlFor="expensedia-correction-notes">Correction Notes {item ? '(required for material changes)' : ''}</Label>
              <Textarea id="expensedia-correction-notes" value={form.correctionNotes} onChange={e => setForm(f => ({ ...f, correctionNotes: e.target.value }))} rows={2} placeholder="Reason for changes..." />
            </div>
          )}
          {item?.createdBy && <p className="text-xs text-muted-foreground">Created by: {item.createdBy} • Last updated by: {item.updatedBy || '—'}</p>}

          {item?.id && <AuditHistory entityType="Expense" entityId={item.id} refreshKey={auditRefreshKey} />}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={() => handleSaveClick()} disabled={saving || uploading}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving...</> : 'Save'}
          </Button>
        </div>
      </DialogContent>
      <DiscardChangesDialog open={guard.confirmOpen} onDiscard={guard.discard} onKeepEditing={guard.keepEditing} />

      <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Receipt?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the receipt file from this expense. This action will be recorded in the audit history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveReceipt}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

