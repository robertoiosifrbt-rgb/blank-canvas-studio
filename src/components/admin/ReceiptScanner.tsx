import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Upload, RotateCcw, AlertTriangle, FileText, X, Check, Loader2, Sparkles, AlertCircle, Info } from 'lucide-react';
import { uploadFile } from 'zite-file-upload-sdk';
import { saveExpense, getJobsForSelect, extractReceipt } from 'zite-endpoints-sdk';
import { toast } from 'sonner';
import { useDebouncedCallback } from 'use-debounce';
import { fmtDate, fmt } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ACHU-022: "Needs Review" added as a category prompt, not a real saved value
const categories = ['Cleaning Supplies', 'Equipment', 'Fuel', 'Parking', 'Vehicle', 'Insurance', 'Marketing', 'Printing', 'Uniform', 'Software', 'Phone', 'Bank Fees', 'Professional Fees', 'Staff Payment', 'Refund', 'Other'];
const methods = ['Card', 'Cash', 'Bank Transfer', 'Other'];
const docTypes = [
  { value: 'Receipt', label: 'Receipt' },
  { value: 'Invoice', label: 'Invoice' },
  { value: 'Credit Note', label: 'Credit Note' },
  { value: 'Other', label: 'Other' },
];

import { MAX_PDF_BYTES, MAX_IMAGE_BYTES } from '@/lib/validation';

// Use shared constants for upload limits
const MAX_PDF_SIZE = MAX_PDF_BYTES;
const MAX_IMAGE_SIZE = MAX_IMAGE_BYTES;
const SUPPORTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

type Step = 'capture' | 'uploading' | 'extracting' | 'review' | 'duplicate' | 'saving';
type JobOption = { id: string; jobId?: any; customerName: string; service: string; jobDate: string };
type DuplicateMatch = { expenseId?: any; supplier?: string; expenseDate?: string; amount?: number; category?: string; linkedJobLabel?: string; documentNumber?: string };

function validateFile(file: File): string | null {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  const typeOk = SUPPORTED_TYPES.includes(file.type);
  const extOk = SUPPORTED_EXTENSIONS.includes(ext);
  if (!typeOk && !extOk) return 'Unsupported file type. Upload a JPG, PNG, WEBP, or PDF.';
  const isPdf = file.type === 'application/pdf' || ext === '.pdf';
  const limit = isPdf ? MAX_PDF_SIZE : MAX_IMAGE_SIZE;
  const limitMB = Math.floor(limit / (1024 * 1024));
  if (file.size > limit) return `This ${isPdf ? 'PDF' : 'image'} is too large to process. Maximum supported size is ${limitMB} MB.`;
  return null;
}

/** Determine if a field was AI-filled vs empty — treat 0 as valid */
function isAiFilled(v: string | number | undefined | null): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return true; // 0 is a valid extracted value
  return false;
}

export default function ReceiptScanner({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<Step>('capture');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [filePreviewUrl, setFilePreviewUrl] = useState('');
  const [isPdf, setIsPdf] = useState(false);
  const [error, setError] = useState('');

  // Extraction metadata
  const [extractionConfidence, setExtractionConfidence] = useState(0);
  const [extractionNotes, setExtractionNotes] = useState('');
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [extractionError, setExtractionError] = useState('');

  const [form, setForm] = useState({
    supplier: '', expenseDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date()), amount: 0, subtotal: 0, vatAmount: 0,
    documentType: 'Receipt', documentNumber: '', category: '', paymentMethod: '', description: '',
    currency: 'GBP', linkedJob: '', notes: '',
  });
  const [selectedJob, setSelectedJob] = useState<JobOption | null>(null);
  const [jobSearch, setJobSearch] = useState('');
  const [jobOptions, setJobOptions] = useState<JobOption[]>([]);
  const [showJobSearch, setShowJobSearch] = useState(false);

  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Track which fields were AI-extracted for highlighting
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ACHU-018: Use crypto.randomUUID() instead of Date.now() + Math.random()
  const idempotencyTokenRef = useRef('');
  function generateToken() {
    idempotencyTokenRef.current = crypto.randomUUID();
  }

  // ACHU-019: Revoke object URLs on cleanup
  const revokePreviewUrl = useCallback(() => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl('');
    }
  }, [filePreviewUrl]);

  // ACHU-019: Revoke on unmount
  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  const resetState = useCallback(() => {
    revokePreviewUrl(); // ACHU-019
    setStep('capture');
    setFileUrl('');
    setFileName('');
    setFilePreviewUrl('');
    setIsPdf(false);
    setError('');
    setExtractionConfidence(0);
    setExtractionNotes('');
    setExtractionWarnings([]);
    setExtractionFailed(false);
    setExtractionError('');
    setAiFilledFields(new Set());
    setForm({ supplier: '', expenseDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date()), amount: 0, subtotal: 0, vatAmount: 0, documentType: 'Receipt', documentNumber: '', category: '', paymentMethod: '', description: '', currency: 'GBP', linkedJob: '', notes: '' });
    setSelectedJob(null);
    setDuplicates([]);
    setValidationErrors([]);
    generateToken();
  }, [revokePreviewUrl]);

  const handleFileSelected = async (file: File) => {
    setError('');
    const fileError = validateFile(file);
    if (fileError) { setError(fileError); return; }
    setStep('uploading');
    const isFilePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setIsPdf(isFilePdf);
    setFileName(file.name);

    // ACHU-019: Revoke old preview URL before creating new one
    revokePreviewUrl();
    if (!isFilePdf) { setFilePreviewUrl(URL.createObjectURL(file)); }

    try {
      const { fileUrl: url } = await uploadFile({ data: file, filename: file.name });
      setFileUrl(url);
      generateToken();

      // Automatically run extraction
      setStep('extracting');
      try {
        const result = await extractReceipt({ fileUrl: url, isPdf: isFilePdf });

        if (result.success && result.data) {
          const d = result.data;
          const filled = new Set<string>();

          const newForm = { ...form };
          if (isAiFilled(d.supplier)) { newForm.supplier = d.supplier; filled.add('supplier'); }
          if (isAiFilled(d.expenseDate)) { newForm.expenseDate = d.expenseDate; filled.add('expenseDate'); }
          if (isAiFilled(d.documentType)) { newForm.documentType = d.documentType; filled.add('documentType'); }
          if (isAiFilled(d.documentNumber)) { newForm.documentNumber = d.documentNumber; filled.add('documentNumber'); }
          if (isAiFilled(d.subtotal)) { newForm.subtotal = d.subtotal; filled.add('subtotal'); }
          if (isAiFilled(d.vatAmount)) { newForm.vatAmount = d.vatAmount; filled.add('vatAmount'); }
          if (isAiFilled(d.amount)) { newForm.amount = d.amount; filled.add('amount'); }
          if (isAiFilled(d.currency)) { newForm.currency = d.currency; filled.add('currency'); }
          // ACHU-022: Don't auto-fill category — require manual selection
          if (isAiFilled(d.category) && d.category !== 'Other') { newForm.category = d.category; filled.add('category'); }
          if (isAiFilled(d.paymentMethod)) { newForm.paymentMethod = d.paymentMethod; filled.add('paymentMethod'); }
          if (isAiFilled(d.description)) { newForm.description = d.description; filled.add('description'); }

          setForm(newForm);
          setAiFilledFields(filled);
          setExtractionConfidence(result.confidence);
          setExtractionNotes(result.notes);
          setExtractionWarnings(result.warnings);
          setExtractionFailed(false);
          setExtractionError('');
        } else {
          // Extraction returned but failed
          setExtractionFailed(true);
          setExtractionError(result.error ?? 'Extraction could not read this document.');
          setExtractionWarnings(result.warnings ?? []);
        }
      } catch (extractErr: any) {
        console.error('[ReceiptScanner] Extraction error:', extractErr?.message);
        setExtractionFailed(true);
        setExtractionError(extractErr?.message ?? 'Extraction failed. Please enter details manually.');
      }

      setStep('review');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to upload file');
      setStep('capture');
    }
  };

  const handleCapture = () => cameraInputRef.current?.click();
  const handleUpload = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    e.target.value = '';
  };
  const handleRetake = () => {
    revokePreviewUrl(); // ACHU-019
    setStep('capture'); setFileUrl(''); setFileName(''); setError(''); setAiFilledFields(new Set()); setExtractionFailed(false); setExtractionError(''); setExtractionWarnings([]);
  };

  const searchJobs = useCallback(async (q: string) => {
    try {
      const res = await getJobsForSelect({ search: q || undefined });
      setJobOptions(res.jobs);
    } catch (err: any) {
      // ACHU-020: Log instead of silently ignoring
      console.warn('[ReceiptScanner] Job search failed:', err?.message);
    }
  }, []);
  const debouncedJobSearch = useDebouncedCallback((q: string) => searchJobs(q), 300);

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!form.supplier.trim()) errs.push('Supplier is required');
    if (!form.expenseDate || !/^\d{4}-\d{2}-\d{2}$/.test(form.expenseDate)) errs.push('Valid expense date is required');
    else {
      const [y, m, d] = form.expenseDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) errs.push('Invalid date');
    }
    if (form.amount < 0) errs.push('Amount cannot be negative');
    if (form.vatAmount > form.amount) errs.push('VAT cannot exceed total amount');
    if (form.subtotal > 0 && form.vatAmount > 0) {
      const diff = Math.abs((form.subtotal + form.vatAmount) - form.amount);
      if (diff > 0.05 && form.amount > 0) errs.push(`Subtotal (${fmt(form.subtotal)}) + VAT (${fmt(form.vatAmount)}) = ${fmt(form.subtotal + form.vatAmount)} does not match total (${fmt(form.amount)}). Check values.`);
    }
    if (form.category && !categories.includes(form.category)) errs.push('Invalid category');
    // ACHU-022: Require category before saving
    if (!form.category) errs.push('Please select a category before saving');
    return errs;
  };

  const doSave = async (overrideConfirmed: boolean) => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await saveExpense({
        expenseDate: form.expenseDate,
        supplier: form.supplier.trim(),
        category: form.category || undefined,
        description: form.description?.trim() || undefined,
        amount: form.amount,
        paymentMethod: form.paymentMethod || undefined,
        linkedJob: form.linkedJob || undefined,
        receiptAvailable: true,
        notes: form.notes?.trim() || undefined,
        receiptFileUrl: fileUrl,
        documentType: form.documentType || undefined,
        documentNumber: form.documentNumber?.trim() || undefined,
        // ACHU-014A: Use ?? to preserve zero values
        subtotal: form.subtotal ?? undefined,
        vatAmount: form.vatAmount ?? undefined,
        currency: form.currency || 'GBP',
        extractionStatus: 'Confirmed',
        extractionConfidence: extractionConfidence ?? undefined,
        extractionNotes: [extractionNotes, ...(extractionWarnings.length > 0 ? [`Warnings: ${extractionWarnings.join('; ')}`] : [])].filter(Boolean).join(' | ') || undefined,
        manuallyReviewed: true,
        duplicateOverrideConfirmed: overrideConfirmed,
        idempotencyToken: idempotencyTokenRef.current,
      });

      if (res.duplicateConflict && res.duplicates && res.duplicates.length > 0) {
        setDuplicates(res.duplicates);
        setStep('duplicate');
        setSaving(false);
        return;
      }

      // ACHU-019: Revoke object URL on successful save
      revokePreviewUrl();
      toast.success('Expense created from scanned document');
      onSaved();
      resetState();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save expense');
    } finally { setSaving(false); }
  };

  const handleConfirmSave = async () => {
    const errs = validate();
    setValidationErrors(errs);
    if (errs.length > 0) return;
    await doSave(false);
  };

  const handleSaveAnyway = () => {
    generateToken();
    doSave(true);
  };

  const handleClose = () => {
    revokePreviewUrl(); // ACHU-019
    resetState();
    onClose();
  };

  const confidenceBadge = extractionConfidence >= 80
    ? <Badge className="bg-green-600/15 text-green-700 border-green-200 text-xs">High confidence ({extractionConfidence}%)</Badge>
    : extractionConfidence >= 50
      ? <Badge className="bg-amber-500/15 text-amber-700 border-amber-200 text-xs">Medium confidence ({extractionConfidence}%)</Badge>
      : extractionConfidence > 0
        ? <Badge variant="destructive" className="text-xs">Low confidence ({extractionConfidence}%)</Badge>
        : null;

  /** Highlight ring for AI-filled fields that are low confidence */
  const fieldRing = (fieldName: string) => {
    if (!aiFilledFields.has(fieldName)) return '';
    if (extractionConfidence < 50) return 'ring-2 ring-destructive/40';
    if (extractionConfidence < 80) return 'ring-2 ring-amber-400/50';
    return 'ring-2 ring-green-400/40';
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Scan Receipt / Invoice
          </DialogTitle>
        </DialogHeader>

        <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={handleFileChange} />
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileChange} />

        {step === 'capture' && <CaptureStep onCapture={handleCapture} onUpload={handleUpload} error={error} />}

        {step === 'uploading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading {fileName}...</p>
          </div>
        )}

        {step === 'extracting' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="relative">
              <Sparkles className="h-10 w-10 text-primary animate-pulse" />
            </div>
            <p className="text-sm font-medium">Reading document...</p>
            <p className="text-xs text-muted-foreground">Extracting supplier, amounts, date, and other details</p>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            {/* Document preview */}
            <DocumentPreview isPdf={isPdf} fileName={fileName} fileUrl={fileUrl} filePreviewUrl={filePreviewUrl} onRetake={handleRetake} onUpload={handleUpload} />

            {/* Extraction status banner */}
            {extractionFailed ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">Extraction failed</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{extractionError || 'Please enter the details manually from the document.'}</p>
                </div>
              </div>
            ) : aiFilledFields.size > 0 ? (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-sm font-medium">Data extracted automatically</p>
                  </div>
                  {confidenceBadge}
                </div>
                <p className="text-xs text-muted-foreground">
                  {aiFilledFields.size} field{aiFilledFields.size !== 1 ? 's' : ''} pre-filled. Please review and correct before saving.
                </p>
                {extractionWarnings.length > 0 && (
                  <div className="space-y-1 mt-1">
                    {extractionWarnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-700">{w}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-muted/40 border rounded-lg p-3 flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">No data could be extracted. Please enter the details manually from the document.</p>
              </div>
            )}

            {/* Form */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Document Type</Label>
                  <Select value={form.documentType} onValueChange={v => setForm(f => ({ ...f, documentType: v }))}>
                    <SelectTrigger className={fieldRing('documentType')}><SelectValue /></SelectTrigger>
                    <SelectContent>{docTypes.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Document Number</Label><Input className={fieldRing('documentNumber')} value={form.documentNumber} onChange={e => setForm(f => ({ ...f, documentNumber: e.target.value }))} placeholder="INV-001" /></div>
              </div>
              <div><Label>Supplier *</Label><Input className={fieldRing('supplier')} value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Expense Date *</Label><Input className={fieldRing('expenseDate')} type="date" value={form.expenseDate} onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))} /></div>
                <div><Label>Currency</Label><Input className={fieldRing('currency')} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Subtotal (£)</Label><Input className={fieldRing('subtotal')} type="number" step="0.01" value={aiFilledFields.has('subtotal') || form.subtotal !== 0 ? form.subtotal : ''} onChange={e => setForm(f => ({ ...f, subtotal: parseFloat(e.target.value) || 0 }))} /></div>
                <div><Label>VAT (£)</Label><Input className={fieldRing('vatAmount')} type="number" step="0.01" value={aiFilledFields.has('vatAmount') || form.vatAmount !== 0 ? form.vatAmount : ''} onChange={e => setForm(f => ({ ...f, vatAmount: parseFloat(e.target.value) || 0 }))} /></div>
                <div><Label>Total (£) *</Label><Input className={fieldRing('amount')} type="number" step="0.01" value={aiFilledFields.has('amount') || form.amount !== 0 ? form.amount : ''} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} /></div>
              </div>
              {/* ACHU-022: Category is required — highlight if not set */}
              <div>
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className={`${fieldRing('category')} ${!form.category ? 'ring-2 ring-amber-400/50' : ''}`}>
                    <SelectValue placeholder="Select category (required)" />
                  </SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                {!form.category && (
                  <p className="text-xs text-amber-600 mt-1">Please select a category before saving</p>
                )}
              </div>
              <div><Label>Payment Method</Label>
                <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                  <SelectTrigger className={fieldRing('paymentMethod')}><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{methods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div>
                <Label>Linked Job (optional)</Label>
                {selectedJob ? (
                  <div className="flex items-center gap-2 p-2 border border-border rounded-lg bg-muted/30">
                    <span className="flex-1 text-sm truncate">#{selectedJob.jobId} — {selectedJob.service} — {selectedJob.customerName}</span>
                    <button onClick={() => { setSelectedJob(null); setForm(f => ({ ...f, linkedJob: '' })); }} className="p-1"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : showJobSearch ? (
                  <div className="space-y-1">
                    <Input placeholder="Search jobs..." value={jobSearch} onChange={e => { setJobSearch(e.target.value); debouncedJobSearch(e.target.value); }} autoFocus />
                    <div className="max-h-32 overflow-y-auto border border-border rounded-lg">
                      {jobOptions.length === 0 ? <div className="p-2 text-xs text-muted-foreground">No jobs found</div> :
                        jobOptions.map(j => (
                          <button key={j.id} onClick={() => { setSelectedJob(j); setForm(f => ({ ...f, linkedJob: j.id })); setShowJobSearch(false); }} className="w-full text-left p-2 text-xs hover:bg-muted/50 border-b last:border-b-0">
                            #{j.jobId} — {j.service} — {j.customerName} ({fmtDate(j.jobDate)})
                          </button>
                        ))}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowJobSearch(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => { setShowJobSearch(true); searchJobs(''); }}>Select Job</Button>
                )}
              </div>

              <div><Label>Description / Items</Label><Textarea className={fieldRing('description')} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            </div>

            {validationErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-1">
                {validationErrors.map((err, i) => <p key={i} className="text-sm text-destructive">{err}</p>)}
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
              <Button className="flex-1" onClick={handleConfirmSave} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving...</> : <><Check className="h-4 w-4 mr-1" />Confirm & Save</>}
              </Button>
            </div>
          </div>
        )}

        {step === 'duplicate' && (
          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Possible Duplicate Detected</p>
                  <p className="text-xs text-muted-foreground mt-1">The following existing expense(s) match the scanned document:</p>
                </div>
              </div>
            </div>
            {duplicates.map((d, i) => (
              <Card key={i} className="bg-muted/30">
                <CardContent className="p-3 text-sm space-y-1">
                  <p className="font-medium">Expense #{d.expenseId}</p>
                  <p>{d.supplier} • {fmtDate(d.expenseDate)} • {fmt(d.amount)}</p>
                  {d.category && <p className="text-muted-foreground">Category: {d.category}</p>}
                  {d.linkedJobLabel && <p className="text-muted-foreground">Job: {d.linkedJobLabel}</p>}
                  {d.documentNumber && <p className="text-muted-foreground">Doc: {d.documentNumber}</p>}
                </CardContent>
              </Card>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setDuplicates([]); setStep('review'); }}>Go Back</Button>
              <Button variant="destructive" className="flex-1" onClick={handleClose}>Cancel</Button>
              <Button className="flex-1" onClick={handleSaveAnyway} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Anyway'}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub-components ─── */

function CaptureStep({ onCapture, onUpload, error }: { onCapture: () => void; onUpload: () => void; error: string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Take a photo of a receipt or invoice, or upload an existing file. Data will be extracted automatically.</p>
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={onCapture} size="lg" className="h-24 flex-col gap-2">
          <Camera className="h-8 w-8" /><span>Take Photo</span>
        </Button>
        <Button onClick={onUpload} variant="outline" size="lg" className="h-24 flex-col gap-2">
          <Upload className="h-8 w-8" /><span>Upload File</span>
        </Button>
      </div>
      <div className="flex items-center gap-2 justify-center">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <p className="text-xs text-muted-foreground">AI will automatically extract details from your document</p>
      </div>
      <p className="text-xs text-muted-foreground text-center">Supports: JPG, PNG, WEBP, PDF • Max 14 MB (PDF) / 20 MB (images)</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function DocumentPreview({ isPdf, fileName, fileUrl, filePreviewUrl, onRetake, onUpload }: {
  isPdf: boolean; fileName: string; fileUrl: string; filePreviewUrl: string;
  onRetake: () => void; onUpload: () => void;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/20">
      {isPdf ? (
        <div className="flex items-center justify-center p-6 gap-2">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{fileName}</p>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View PDF</a>
          </div>
        </div>
      ) : filePreviewUrl ? (
        <img src={filePreviewUrl} alt="Document" className="w-full max-h-48 object-contain" />
      ) : fileUrl ? (
        <img src={fileUrl} alt="Document" className="w-full max-h-48 object-contain" />
      ) : null}
      <div className="flex gap-2 p-2 border-t border-border">
        <Button variant="ghost" size="sm" onClick={onRetake}><RotateCcw className="h-3.5 w-3.5 mr-1" />Retake</Button>
        <Button variant="ghost" size="sm" onClick={onUpload}><Upload className="h-3.5 w-3.5 mr-1" />Replace</Button>
      </div>
    </div>
  );
}
