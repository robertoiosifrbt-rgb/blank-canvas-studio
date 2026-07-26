import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { StatusBadge, fmtDate } from '@/lib/format';
import { updateJobStatus, saveCleanerNotes, getJobChecklist } from 'zite-endpoints-sdk';
import { toast } from 'sonner';
import {
  Play, CheckCircle, Ban, FileText, Phone, MapPin, Clock, User, Hash, Calendar,
  AlertCircle, RefreshCw, ChevronDown, ClipboardList, Home, StickyNote,
} from 'lucide-react';
import type { CleanerJob } from './CleanerApp';
import WorkChecklist from './WorkChecklist';

/** ACHU-116: Generate a unique request token for idempotency */
let tokenCounter = 0;
function genToken(): string {
  return `${Date.now()}-${++tokenCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** ACHU-116: Request timeout */
const REQUEST_TIMEOUT = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

const FRIENDLY_ERROR = "We couldn't complete this action because the connection was lost.";
const TIMEOUT_ERROR = "The request timed out. Please check your connection and retry.";

function classifyFetchError(e: any): string {
  const msg: string = (e?.message ?? '').toLowerCase();
  if (msg.includes('timed out') || msg.includes('timeout')) return TIMEOUT_ERROR;
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('err_') || msg.includes('load')) return FRIENDLY_ERROR;
  return e?.message || 'Something went wrong.';
}

export default function JobCard({
  job,
  showDate,
  onRefresh,
  actionsEnabled,
}: {
  job: CleanerJob;
  showDate?: boolean;
  onRefresh?: () => void;
  actionsEnabled?: boolean;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState('');

  // Inline error state with retry support
  const [inlineError, setInlineError] = useState<string | null>(null);
  const retryRef = useRef<(() => Promise<void>) | null>(null);
  const retryingRef = useRef(false);
  const [retrying, setRetrying] = useState(false);

  // ACHU-116: Track mounted state to cancel stale updates
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // ACHU-116: Lock to prevent duplicate mutations
  const actionLockRef = useRef(false);

  // Completion confirmation dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [checklistProgress, setChecklistProgress] = useState<{ completed: number; total: number } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  const clearError = () => { setInlineError(null); retryRef.current = null; };

  // ACHU-116: Safe setState that respects mounted
  const safeSet = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    if (mountedRef.current) setter(value);
  };

  // ACHU-116: Stable token ref — generated once per action, reused on retry
  const actionTokenRef = useRef<string>('');

  const doCompleteJob = useCallback(async (reason?: string, reuseToken?: string) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    const token = reuseToken || genToken();
    if (!reuseToken) actionTokenRef.current = token;
    safeSet(setActionLoading, 'Completed');
    safeSet(setConfirmOpen, false);
    clearError();
    try {
      // ACHU-115: Send override reason separately, never in cleanerCompletionNotes
      const statusResult = await withTimeout(updateJobStatus({
        id: job.id,
        status: 'Completed',
        requestToken: token,
        ...(reason ? { checklistOverrideReason: reason } : {}),
      }), REQUEST_TIMEOUT);
      if (mountedRef.current) {
        if (statusResult.auditWarning) {
          toast.warning('Status updated, but audit history could not be updated.', { duration: 6000 });
        } else {
          toast.success('Job completed');
        }
      }
      onRefresh?.();
    } catch (e: any) {
      if (mountedRef.current) {
        safeSet(setInlineError, classifyFetchError(e));
        retryRef.current = async () => {
          // ACHU-116: Refetch authoritative state before retry
          onRefresh?.();
          return doCompleteJob(reason, token);
        };
      }
    } finally {
      actionLockRef.current = false;
      safeSet(setActionLoading, null);
    }
  }, [job.id, onRefresh]);

  const handleMarkCompleted = useCallback(async () => {
    if (actionLockRef.current) return;
    safeSet(setConfirmLoading, true);
    try {
      const cl = await withTimeout(getJobChecklist({ jobId: job.id }), REQUEST_TIMEOUT);
      if (cl.hasChecklist && cl.total > 0 && cl.completed < cl.total) {
        safeSet(setChecklistProgress, { completed: cl.completed, total: cl.total });
        safeSet(setOverrideReason, '');
        safeSet(setConfirmOpen, true);
        safeSet(setConfirmLoading, false);
        return;
      }
    } catch { /* if checklist fails, try completing — backend will enforce */ }
    safeSet(setConfirmLoading, false);
    doCompleteJob();
  }, [job.id, doCompleteJob]);

  const doAction = useCallback(async (status: string, reuseToken?: string) => {
    if (status === 'Completed') {
      handleMarkCompleted();
      return;
    }
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    const token = reuseToken || genToken();
    if (!reuseToken) actionTokenRef.current = token;
    safeSet(setActionLoading, status);
    clearError();
    try {
      const statusResult = await withTimeout(updateJobStatus({ id: job.id, status, requestToken: token }), REQUEST_TIMEOUT);
      if (mountedRef.current) {
        if (statusResult.auditWarning) {
          toast.warning('Status updated, but audit history could not be updated.', { duration: 6000 });
        } else {
          toast.success(
            status === 'In Progress' ? 'Job started' :
            status === 'No Access' ? 'Marked as No Access' : 'Status updated'
          );
        }
      }
      onRefresh?.();
    } catch (e: any) {
      if (mountedRef.current) {
        safeSet(setInlineError, classifyFetchError(e));
        retryRef.current = async () => {
          // ACHU-116: Refetch authoritative state before retry
          onRefresh?.();
          return doAction(status, token);
        };
      }
    } finally {
      actionLockRef.current = false;
      safeSet(setActionLoading, null);
    }
  }, [job.id, onRefresh, handleMarkCompleted]);

  const saveNotes = useCallback(async (reuseToken?: string) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    const token = reuseToken || genToken();
    if (!reuseToken) actionTokenRef.current = token;
    safeSet(setActionLoading, 'notes');
    clearError();
    try {
      await withTimeout(saveCleanerNotes({ jobId: job.id, cleanerCompletionNotes: notesText, requestToken: token }), REQUEST_TIMEOUT);
      if (mountedRef.current) {
        toast.success('Notes saved');
        setNotesOpen(false);
      }
      onRefresh?.();
    } catch (e: any) {
      if (mountedRef.current) {
        safeSet(setInlineError, classifyFetchError(e));
        retryRef.current = async () => {
          onRefresh?.();
          return saveNotes(token);
        };
      }
    } finally {
      actionLockRef.current = false;
      safeSet(setActionLoading, null);
    }
  }, [job.id, notesText, onRefresh]);

  const handleRetry = useCallback(async () => {
    if (retryingRef.current || !retryRef.current) return;
    retryingRef.current = true;
    safeSet(setRetrying, true);
    clearError();
    try {
      await retryRef.current();
    } finally {
      retryingRef.current = false;
      safeSet(setRetrying, false);
    }
  }, []);

  const canStart = actionsEnabled && (job.status === 'Booked' || job.status === 'Confirmed');
  const canComplete = actionsEnabled && job.status === 'In Progress';
  const canNoAccess = actionsEnabled && ['Booked', 'Confirmed', 'In Progress'].includes(job.status ?? '');
  const canNotes = actionsEnabled;
  const hasPhone = !!job.customerPhone;
  const hasAddress = !!job.address;
  const busy = !!actionLoading || retrying;

  // ACHU-115: Validate override reason (min 10 chars, non-whitespace)
  const trimmedOverride = overrideReason.trim();
  const overrideValid = trimmedOverride.length >= 10;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                <Hash className="h-3 w-3" />{job.jobId}
              </span>
              {showDate && job.jobDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />{fmtDate(job.jobDate)}
                </span>
              )}
            </div>
            <p className="font-semibold text-base mt-1">{job.service || 'Cleaning'}</p>
          </div>
          <StatusBadge status={job.status} />
        </div>

        {/* Details */}
        <div className="text-sm space-y-1.5">
          <p className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{job.customerName || '—'}</span>
          </p>
          <p className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="break-words">{job.address || '—'}</span>
          </p>
          <p className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Scheduled:</span>
            <span>{job.startTime || '—'}{job.finishTime ? ` – ${job.finishTime}` : ''}</span>
          </p>
          {(job as any).actualStartTime && (
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-muted-foreground">Actual Start:</span>
              <span className="text-green-700 font-medium">{(job as any).actualStartTime}</span>
            </p>
          )}
          {(job as any).actualFinishTime && (
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-muted-foreground">Actual Finish:</span>
              <span className="text-green-700 font-medium">{(job as any).actualFinishTime}</span>
            </p>
          )}
        </div>

        {/* Customer instructions */}
        {job.customerInstructions && (
          <div className="text-sm bg-muted/50 p-3 rounded-lg break-words">
            <span className="font-medium text-muted-foreground">Customer instructions:</span>
            <p className="mt-0.5 whitespace-pre-wrap">{job.customerInstructions}</p>
          </div>
        )}

        {/* Job Details / Work Required — expandable */}
        <WorkDetailsSection job={job} />

        {/* Work Checklist — ACHU-117: lazy loaded on expand only */}
        <WorkChecklist jobId={job.id} />

        {/* Existing completion notes */}
        {job.cleanerCompletionNotes && !notesOpen && (
          <div className="text-sm bg-primary/5 p-3 rounded-lg break-words">
            <span className="font-medium text-muted-foreground">Your notes:</span>
            <p className="mt-0.5 whitespace-pre-wrap">{job.cleanerCompletionNotes}</p>
          </div>
        )}

        {/* Notes editor */}
        {notesOpen && (
          <div className="space-y-2">
            <Textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="Add completion notes..."
              rows={3}
              className="text-base"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveNotes()} disabled={busy} className="min-h-[40px]">
                {actionLoading === 'notes' ? 'Saving...' : 'Save Notes'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setNotesOpen(false); clearError(); }} className="min-h-[40px]">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Inline error with retry */}
        {inlineError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-2" role="alert">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{inlineError}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="min-h-[40px] border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={handleRetry}
              disabled={retrying}
            >
              {retrying ? (
                <><RefreshCw className="h-4 w-4 animate-spin mr-1.5" />Retrying…</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-1.5" />Retry</>
              )}
            </Button>
          </div>
        )}

        {/* Actions */}
        {actionsEnabled && (
          <div className="space-y-2 pt-1">
            <div className="flex gap-2 flex-wrap">
              {canStart && (
                <Button size="sm" className="flex-1 min-h-[44px]" onClick={() => doAction('In Progress')} disabled={busy}>
                  <Play className="h-4 w-4 mr-1.5" />Start Job
                </Button>
              )}
              {canComplete && (
                <Button size="sm" className="flex-1 min-h-[44px]" onClick={() => doAction('Completed')} disabled={busy || confirmLoading}>
                  <CheckCircle className="h-4 w-4 mr-1.5" />{confirmLoading ? 'Checking...' : 'Mark Completed'}
                </Button>
              )}
              {canNoAccess && (
                <Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => doAction('No Access')} disabled={busy}>
                  <Ban className="h-4 w-4 mr-1.5" />No Access
                </Button>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              {canNotes && !notesOpen && (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => { setNotesOpen(true); setNotesText(job.cleanerCompletionNotes ?? ''); clearError(); }}
                >
                  <FileText className="h-4 w-4 mr-1.5" />Notes
                </Button>
              )}
              {hasPhone && (
                <Button size="sm" variant="outline" className="min-h-[44px]" asChild>
                  <a href={`tel:${job.customerPhone}`}>
                    <Phone className="h-4 w-4 mr-1.5" />Call
                  </a>
                </Button>
              )}
              {hasAddress && (
                <Button size="sm" variant="outline" className="min-h-[44px]" asChild>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address!)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="h-4 w-4 mr-1.5" />Maps
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}
        {/* ACHU-115: Completion confirmation dialog with proper override */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Some checklist items are still incomplete</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                    <span className="text-sm text-foreground">Completed</span>
                    <span className="font-semibold text-foreground">{checklistProgress?.completed ?? 0} / {checklistProgress?.total ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                    <span className="text-sm text-foreground">Remaining</span>
                    <span className="font-semibold text-foreground">{(checklistProgress?.total ?? 0) - (checklistProgress?.completed ?? 0)}</span>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1">Reason for completing anyway *</label>
                    <Textarea
                      value={overrideReason}
                      onChange={e => setOverrideReason(e.target.value)}
                      placeholder="Explain why remaining items are not needed (min 10 characters)..."
                      rows={2}
                      className="text-sm"
                    />
                    {trimmedOverride.length > 0 && trimmedOverride.length < 10 && (
                      <p className="text-xs text-destructive mt-1">
                        {10 - trimmedOverride.length} more character{10 - trimmedOverride.length === 1 ? '' : 's'} needed
                      </p>
                    )}
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
              <AlertDialogCancel className="min-h-[44px]">Return to Checklist</AlertDialogCancel>
              <Button
                className="min-h-[44px] w-full"
                disabled={!overrideValid}
                onClick={() => doCompleteJob(trimmedOverride)}
              >
                Complete Anyway
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

// ─── Work Details Section ──────────────────────────────────────────

type QuoteDetails = NonNullable<CleanerJob['quoteDetails']>;

const gt0 = (v: number | null | undefined): v is number => typeof v === 'number' && v > 0;
const hasStr = (v: string | null | undefined): v is string => typeof v === 'string' && v.trim() !== '';

interface ServiceGroup {
  title: string;
  rows: { label: string; value: number | null | undefined }[];
}

function buildServiceGroups(qd: QuoteDetails): ServiceGroup[] {
  return [
    { title: 'Regular Cleaning', rows: [
      { label: 'Bedrooms', value: qd.regularCleaningBedrooms },
      { label: 'Bathrooms', value: qd.regularCleaningBathrooms },
      { label: 'Kitchens', value: qd.regularCleaningKitchens },
      { label: 'Living Rooms', value: qd.regularCleaningLivingRooms },
      { label: 'Hallways', value: qd.regularCleaningHallways },
    ]},
    { title: 'Deep Cleaning', rows: [
      { label: 'Bedrooms', value: qd.deepCleaningBedrooms },
      { label: 'Bathrooms', value: qd.deepCleaningBathrooms },
      { label: 'Kitchens', value: qd.deepCleaningKitchens },
      { label: 'Living Rooms', value: qd.deepCleaningLivingRooms },
      { label: 'Hallways', value: qd.deepCleaningHallways },
    ]},
    { title: 'End of Tenancy', rows: [
      { label: 'Bedrooms', value: qd.endOfTenancyBedrooms },
      { label: 'Bathrooms', value: qd.endOfTenancyBathrooms },
      { label: 'Kitchens', value: qd.endOfTenancyKitchens },
      { label: 'Living Rooms', value: qd.endOfTenancyLivingRooms },
      { label: 'Hallways', value: qd.endOfTenancyHallways },
    ]},
    { title: 'Carpet Cleaning', rows: [
      { label: 'Carpeted Rooms', value: qd.carpetedRooms },
      { label: 'Staircases', value: qd.staircases },
    ]},
    { title: 'Upholstery Cleaning', rows: [
      { label: 'Dining Chairs', value: qd.diningChairs },
      { label: 'Armchairs', value: qd.armchairs },
      { label: '2 Seat Sofas', value: qd._2SeatSofas },
      { label: '3 Seat Sofas', value: qd._3SeatSofas },
      { label: 'Corner Sofas', value: qd.cornerSofas },
    ]},
    { title: 'Window Cleaning', rows: [
      { label: 'Interior Windows', value: qd.interiorWindows },
      { label: 'Exterior Windows', value: qd.exteriorWindows },
      { label: 'Both Sides', value: qd.windowsBothSides },
    ]},
    { title: 'Oven / Appliance Cleaning', rows: [
      { label: 'Standard Ovens', value: qd.standardOvens },
      { label: 'Double Ovens', value: qd.doubleOvens },
      { label: 'Fridges', value: qd.fridges },
      { label: 'Fridge Freezers', value: qd.fridgeFreezers },
    ]},
    { title: 'Garden Tidy', rows: [
      { label: 'Lawns', value: qd.lawns },
      { label: 'Leaf-Clearing Areas', value: qd.leafClearingAreas },
      { label: 'Weeding Areas', value: qd.weedingAreas },
      { label: 'Hedges', value: qd.hedges },
      { label: 'Paths', value: qd.paths },
    ]},
    { title: 'Steam Sanitisation', rows: [
      { label: 'Bedrooms', value: qd.steamSanitisationBedrooms },
      { label: 'Bathrooms', value: qd.steamSanitisationBathrooms },
      { label: 'Kitchens', value: qd.steamSanitisationKitchens },
      { label: 'Living Rooms', value: qd.steamSanitisationLivingRooms },
    ]},
  ];
}

function WorkDetailsSection({ job }: { job: CleanerJob }) {
  const [open, setOpen] = useState(false);
  const qd = job.quoteDetails;
  if (!qd) return null;

  const services = (qd.services?.length ?? 0) > 0 ? qd.services! : [];
  const allGroups = buildServiceGroups(qd);
  const populatedGroups = allGroups.filter(g => g.rows.some(r => gt0(r.value)));
  const hasProperty = hasStr(qd.propertyType) || gt0(qd.totalBedrooms) || gt0(qd.totalBathrooms) || hasStr(qd.propertyDetails);
  const hasNotes = hasStr(qd.additionalNotes);
  const hasPreferred = hasStr(qd.preferredDate) || hasStr(qd.preferredTime);

  if (services.length === 0 && populatedGroups.length === 0 && !hasProperty && !hasNotes && !hasPreferred) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm font-medium hover:bg-muted/80 transition-colors"
        >
          <span className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            Job Details / Work Required
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-3 text-sm">
          {services.length > 0 && (
            <DetailGroup title="Services Requested">
              <div className="flex flex-wrap gap-1.5">
                {services.map((s, i) => <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>)}
              </div>
            </DetailGroup>
          )}

          {hasPreferred && (
            <DetailGroup title="Preferred Schedule">
              {hasStr(qd.preferredDate) && <DetailRow label="Date" value={fmtDate(qd.preferredDate!)} />}
              {hasStr(qd.preferredTime) && <DetailRow label="Time" value={qd.preferredTime!} />}
            </DetailGroup>
          )}

          {hasProperty && (
            <DetailGroup title="Property Details" icon={<Home className="h-3.5 w-3.5" />}>
              {hasStr(qd.propertyType) && <DetailRow label="Property Type" value={qd.propertyType!} />}
              {gt0(qd.totalBedrooms) && <DetailRow label="Bedrooms" value={String(qd.totalBedrooms)} />}
              {gt0(qd.totalBathrooms) && <DetailRow label="Bathrooms" value={String(qd.totalBathrooms)} />}
              {hasStr(qd.propertyDetails) && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words pt-1">{qd.propertyDetails}</p>
              )}
            </DetailGroup>
          )}

          {populatedGroups.map((g, i) => (
            <DetailGroup key={i} title={g.title}>
              {g.rows.filter(r => gt0(r.value)).map((r, j) => (
                <DetailRow key={j} label={r.label} value={String(r.value)} />
              ))}
            </DetailGroup>
          ))}

          {hasNotes && (
            <DetailGroup title="Additional Notes" icon={<StickyNote className="h-3.5 w-3.5" />}>
              <p className="text-sm whitespace-pre-wrap break-words">{qd.additionalNotes}</p>
            </DetailGroup>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DetailGroup({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
        {icon}{title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
