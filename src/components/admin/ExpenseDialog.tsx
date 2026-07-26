import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState, useEffect, useCallback, useRef } from 'react';
import { saveExpense, getJobsForSelect } from 'zite-endpoints-sdk';
import { uploadFile } from 'zite-file-upload-sdk';
import { toast } from 'sonner';
import { useDebouncedCallback } from 'use-debounce';
import { Search, X, AlertTriangle, Loader2, Upload, FileText, Eye, Trash2, Image } from 'lucide-react';
import { fmtDate, fmt } from '@/lib/format';
import { MAX_PDF_BYTES } from '@/lib/validation';
import AuditHistory from './AuditHistory';
import { computeRevision, REVISION_FIELDS } from '@/lib/concurrency';

const categories = ['Cleaning Supplies', 'Equipment', 'Fuel', 'Parking', 'Vehicle', 'Insurance', 'Marketing', 'Printing', 'Uniform', 'Software', 'Phone', 'Bank Fees', 'Professional Fees', 'Staff Payment', 'Refund', 'Other'];
const methods = ['Card', 'Cash', 'Bank Transfer', 'Other'];
const docTypes = ['Receipt', 'Invoice', 'Credit Note', 'Other'];

type JobOption = { id: string; jobId?: any; customerName: string; service: string; jobDate: string };
type DuplicateMatch = { expenseId?: any; supplier?: string; expenseDate?: string; amount?: number; category?: string; linkedJobLabel?: string; documentNumber?: string };

export default function ExpenseDialog({ open, onClose, item, onSaved, prefill }: {
  open: boolean; onClose: () => void; item: any; onSaved: () => void;
  prefill?: Record<string, any>;
}) {
  const [form, setForm] = useState<{
    expenseDate: string; supplier: string; category: string; description: string; amount: number;
    paymentMethod: string; paidBy: string; receiptAvailable: boolean; notes: string; correctionNotes: string; linkedJob: string;
    documentType: string; documentNumber: string; subtotal: number | null | undefined; vatAmount: number | null | undefined; currency: string;
    manuallyReviewed: boolean;
  }>({
    expenseDate: '', supplier: '', category: '', description: '', amount: 0,
    paymentMethod: '', paidBy: '', receiptAvailable: false, notes: '', correctionNotes: '', linkedJob: '',
    documentType: '', documentNumber: '', subtotal: undefined, vatAmount: undefined, currency: 'GBP',
    manuallyReviewed: false,
  });
  const [receiptFileUrl, setReceiptFileUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [jobSearch, setJobSearch] = useState('');
  const [jobOptions, setJobOptions] = useState<JobOption[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobOption | null>(null);
  const [showJobSearch, setShowJobSearch] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [showDupWarning, setShowDupWarning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idempotencyTokenRef = useRef('');
  const revisionRef = useRef<string | undefined>(undefined);

  function generateToken() { idempotencyTokenRef.current = crypto.randomUUID(); }

  useEffect(() => {
    if (item) {
      const ljid = Array.isArray(item.linkedJob) ? item.linkedJob[0] : item.linkedJob;
      setForm({
        expenseDate: item.expenseDate ?? '', supplier: item.supplier ?? '', category: item.category ?? '',
        description: item.description ?? '', amount: item.amount ?? 0, paymentMethod: item.paymentMethod ?? '',
        paidBy: item.paidBy ?? '', receiptAvailable: item.receiptAvailable ?? false, notes: item.notes ?? '',
        correctionNotes: '', linkedJob: ljid ?? '',
        documentType: item.documentType ?? '', documentNumber: item.documentNumber ?? '',
        subtotal: item.subtotal != null ? item.subtotal : undefined, vatAmount: item.vatAmount != null ? item.vatAmount : undefined, currency: item.currency ?? 'GBP',
        manuallyReviewed: item.manuallyReviewed ?? false,
      });
      setReceiptFileUrl(item.receiptFile?.[0]?.url ?? '');
      if (ljid) loadLinkedJobInfo(ljid); else setSelectedJob(null);
      revisionRef.current = computeRevision(item, REVISION_FIELDS.expense);
    } else {
      const base = {
        expenseDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date()),
        supplier: '', category: '', description: '', amount: 0, paymentMethod: '', paidBy: '',
        receiptAvailable: false, notes: '', correctionNotes: '', linkedJob: '',
        documentType: '', documentNumber: '', subtotal: undefined, vatAmount: undefined, currency: 'GBP',
        manuallyReviewed: false,
      };
      if (prefill) setForm({ ...base, ...prefill }); else setForm(base);
      setReceiptFileUrl(prefill?.receiptFileUrl ?? '');
      setSelectedJob(null);
    }
    setError(''); setShowJobSearch(false); setDuplicates([]); setShowDupWarning(false);
    generateToken();
    if (!item) revisionRef.current = undefined;
  }, [item, open, prefill]);

  const loadLinkedJobInfo = async (jobRecordId: string) => {
    try { const res = await getJobsForSelect({}); setSelectedJob(res.jobs.find((j: JobOption) => j.id === jobRecordId) ?? null); }
    catch { setSelectedJob(null); }
  };

  const searchJobs = useCallback(async (q: string) => {
    setLoadingJobs(true);
    try { const res = await getJobsForSelect({ search: q || undefined }); setJobOptions(res.jobs); }
    catch { /* ignore */ }
    setLoadingJobs(false);
  }, []);

  const debouncedJobSearch = useDebouncedCallback((q: string) => searchJobs(q), 300);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > MAX_PDF_BYTES) { setError(`File exceeds ${Math.floor(MAX_PDF_BYTES / 1024 / 1024)} MB limit`); return; }
    setUploading(true); setError('');
    try {
      const { fileUrl } = await uploadFile({ data: file, filename: file.name });
      setReceiptFileUrl(fileUrl);
      setForm(f => ({ ...f, receiptAvailable: true }));
      toast.success('Receipt uploaded');
    } catch (e: any) { setError(e?.message ?? 'Upload failed'); }
    finally { setUploading(false); }
  };

  const handleRemoveReceipt = () => {
    setReceiptFileUrl('');
    setForm(f => ({ ...f, receiptAvailable: false }));
    setShowRemoveConfirm(false);
  };

  const isImage = receiptFileUrl && /\.(jpg|jpeg|png|webp|gif)/i.test(receiptFileUrl);
  const isPdf = receiptFileUrl && /\.pdf/i.test(receiptFileUrl);

  const handleSaveClick = async (overrideConfirmed = false) => {
    if (!form.supplier.trim() || !form.expenseDate) { setError('Supplier and date are required'); return; }
    if (form.amount <= 0) { setError('Amount must be greater than zero'); return; }
    if (saving) return;
    setSaving(true); setError('');
    try {
      const existingHadReceipt = item?.receiptFile?.length > 0;
      const removingReceipt = existingHadReceipt && !receiptFileUrl;
      const res = await saveExpense({
        ...form, id: item?.id, _revision: revisionRef.current, voidStatus: item?.voidStatus || 'Active',
        correctionNotes: form.correctionNotes || undefined,
        linkedJob: form.linkedJob || undefined,
        duplicateOverrideConfirmed: overrideConfirmed,
        idempotencyToken: item?.id ? undefined : idempotencyTokenRef.current,
        receiptFileUrl: receiptFileUrl || undefined,
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
      if (res.duplicateConflict && res.duplicates?.length) { setDuplicates(res.duplicates); setShowDupWarning(true); setSaving(false); return; }
      // ACHU-047: Show audit warning if present
      if (res.auditWarning) {
        console.warn('[ExpenseDialog] Audit warning:', res.auditWarning);
        toast.warning('Record saved, but audit history could not be updated. The change was applied.', { duration: 6000 });
      } else {
        toast.success(item ? 'Expense updated' : 'Expense recorded');
      }
      setAuditRefreshKey(k => k + 1);
      onSaved();
    } catch (e: any) { setError(e?.message || 'Failed to save expense'); }
    finally { setSaving(false); }
  };

  const handleSaveAnyway = () => { generateToken(); handleSaveClick(true); };

  // Duplicate warning view
  if (showDupWarning) {
    return (
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Possible Duplicate Detected</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">This expense may already exist</p>
                  <p className="text-xs text-muted-foreground mt-1">An active expense was found with the same date, supplier, and amount.</p>
                </div>
              </div>
            </div>
            {duplicates.map((d, i) => (
              <Card key={i} className="bg-muted/30"><CardContent className="p-3 text-sm space-y-1">
                <p className="font-medium">Expense #{d.expenseId}</p>
                <p>{d.supplier} • {fmtDate(d.expenseDate)} • {fmt(d.amount)}</p>
                {d.category && <p className="text-muted-foreground">Category: {d.category}</p>}
              </CardContent></Card>
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowDupWarning(false); setDuplicates([]); }}>Cancel / Review</Button>
              <Button className="flex-1" onClick={handleSaveAnyway} disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving...</> : 'Save Anyway'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? 'Edit Expense' : 'Record Expense'}</DialogTitle></DialogHeader>
        {item?.voidStatus === 'Voided' && <Badge variant="destructive" className="w-fit">Voided</Badge>}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date *</Label><Input type="date" value={form.expenseDate} onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))} /></div>
            <div><Label>Amount (£) *</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} /></div>
          </div>
          <div><Label>Supplier *</Label><Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} /></div>
          <div><Label>Category</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Payment Method</Label>
              <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{methods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Paid By</Label><Input value={form.paidBy} onChange={e => setForm(f => ({ ...f, paidBy: e.target.value }))} /></div>
          </div>

          {/* Linked Job */}
          <div>
            <Label>Linked Job (optional)</Label>
            {selectedJob ? (
              <div className="flex items-center gap-2 p-2 border border-border rounded-lg bg-muted/30">
                <span className="flex-1 text-sm truncate">#{selectedJob.jobId} — {selectedJob.service} — {selectedJob.customerName}</span>
                <button onClick={() => { setSelectedJob(null); setForm(f => ({ ...f, linkedJob: '' })); }} className="p-1 rounded hover:bg-destructive/10"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : showJobSearch ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Search jobs..." className="pl-8" value={jobSearch} onChange={e => { setJobSearch(e.target.value); debouncedJobSearch(e.target.value); }} autoFocus />
                </div>
                <div className="max-h-40 overflow-y-auto border border-border rounded-lg">
                  {loadingJobs ? <div className="p-3 text-sm text-muted-foreground">Loading...</div> : jobOptions.length === 0 ? <div className="p-3 text-sm text-muted-foreground">No jobs found</div> : jobOptions.map(j => (
                    <button key={j.id} onClick={() => { setSelectedJob(j); setForm(f => ({ ...f, linkedJob: j.id })); setShowJobSearch(false); setJobSearch(''); }} className="w-full text-left p-2 text-sm hover:bg-muted/50 border-b border-border last:border-b-0">
                      <span className="font-medium">#{j.jobId}</span> — {j.service} — {j.customerName} <span className="text-muted-foreground">({fmtDate(j.jobDate)})</span>
                    </button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowJobSearch(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="w-full" onClick={() => { setShowJobSearch(true); searchJobs(''); }}>Select Job</Button>
            )}
          </div>

          <Separator />

          {/* Receipt Section */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5"><FileText className="h-4 w-4" /> Receipt / Document</Label>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileUpload} />

            {receiptFileUrl ? (
              <div className="border border-border rounded-lg overflow-hidden">
                {isImage ? (
                  <img src={receiptFileUrl} alt="Receipt" className="w-full max-h-40 object-contain bg-muted/20" />
                ) : isPdf ? (
                  <div className="flex items-center gap-2 p-4 bg-muted/20">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                    <a href={receiptFileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">View PDF</a>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-4 bg-muted/20">
                    <Eye className="h-4 w-4" />
                    <a href={receiptFileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">View file</a>
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
              <div><Label className="text-xs">Document Type</Label>
                <Select value={form.documentType} onValueChange={v => setForm(f => ({ ...f, documentType: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{docTypes.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Document Number</Label><Input className="h-8 text-sm" value={form.documentNumber} onChange={e => setForm(f => ({ ...f, documentNumber: e.target.value }))} placeholder="INV-001" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Subtotal (£)</Label><Input className="h-8 text-sm" type="number" step="0.01" value={form.subtotal ?? ''} onChange={e => setForm(f => ({ ...f, subtotal: e.target.value === '' ? null : parseFloat(e.target.value) }))} /></div>
              <div><Label className="text-xs">VAT (£)</Label><Input className="h-8 text-sm" type="number" step="0.01" value={form.vatAmount ?? ''} onChange={e => setForm(f => ({ ...f, vatAmount: e.target.value === '' ? null : parseFloat(e.target.value) }))} /></div>
              <div><Label className="text-xs">Currency</Label><Input className="h-8 text-sm" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} /></div>
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
              <Checkbox checked={form.manuallyReviewed} onCheckedChange={v => setForm(f => ({ ...f, manuallyReviewed: !!v }))} />
              <Label className="text-sm">Manually Reviewed</Label>
            </div>
          </div>

          <Separator />

          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          {item && (
            <div>
              <Label>Correction Notes {item ? '(required for material changes)' : ''}</Label>
              <Textarea value={form.correctionNotes} onChange={e => setForm(f => ({ ...f, correctionNotes: e.target.value }))} rows={2} placeholder="Reason for changes..." />
            </div>
          )}
          {item?.createdBy && <p className="text-xs text-muted-foreground">Created by: {item.createdBy} • Last updated by: {item.updatedBy || '—'}</p>}

          {item?.id && <AuditHistory entityType="Expense" entityId={item.id} refreshKey={auditRefreshKey} />}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={() => handleSaveClick(false)} disabled={saving || uploading}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving...</> : 'Save'}
          </Button>
        </div>
      </DialogContent>

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
