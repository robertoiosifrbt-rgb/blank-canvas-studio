import { useEffect, useState, useCallback, useRef } from 'react';
import { getCustomerPortal, GetCustomerPortalOutputType, updateCustomerProfile } from 'zite-endpoints-sdk';
import { useTrackedRequest, withTimeout } from '@/lib/useTrackedRequest';
import { useAuth } from 'zite-auth-sdk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { LogOut, CalendarDays, History, CreditCard, User, Plus, AlertCircle, Info, ChevronDown, Pencil, X, Check, Loader2, WifiOff, RefreshCw, Eye } from 'lucide-react';
import { StatusBadge, fmtDate, fmt } from '@/lib/format';
import { toast } from 'sonner';
import { LIMITS } from '@/lib/validation';
import QuoteFormDialog from './QuoteFormDialog';
import StatusLegend from './StatusLegend';

type PortalData = GetCustomerPortalOutputType;

type LogoutState = 'idle' | 'attempting' | 'offline';

export default function CustomerApp() {
  const { user, logout } = useAuth();
  const portalReq = useTrackedRequest<PortalData>({ timeoutMs: 30000 });
  const data = portalReq.data;
  const loading = !data && !portalReq.error;
  const error = (!data && portalReq.error) ? portalReq.error : '';
  const refreshing = portalReq.loading;
  const [bookingOpen, setBookingOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history' | 'payments' | 'account'>('upcoming');
  const [logoutState, setLogoutState] = useState<LogoutState>('idle');

  /**
   * FIX 7 — ACHU-001: Offline-safe logout for Customer portal.
   * Does NOT clear local state on failure (no false logout / no exposing empty state).
   */
  const handleLogout = useCallback(async () => {
    if (logoutState === 'attempting') return;
    // Check online before handing control to SDK
    if (!navigator.onLine) {
      setLogoutState('offline');
      return;
    }
    setLogoutState('attempting');
    try {
      await Promise.race([
        Promise.resolve(logout()),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Logout timed out')), 5000)),
      ]);
      // Success — clear local data, auth gate handles redirect
      portalReq.setData(null);
      setLogoutState('idle');
    } catch (e: any) {
      console.error('[CustomerApp] Logout error:', e?.message ?? e);
      setLogoutState('offline');
    }
  }, [logout, logoutState]);

  const handleLogoutCancel = () => setLogoutState('idle');

  // Pagination
  const [historyOffset, setHistoryOffset] = useState(0);
  const [allPastJobs, setAllPastJobs] = useState<any[]>([]);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const historyLoadingRef = useRef(false);

  // Sync pagination state when portal data changes
  useEffect(() => {
    if (!portalReq.data) return;
    setAllPastJobs(portalReq.data.pastJobs);
    setHistoryHasMore(portalReq.data.pastJobsHasMore);
    setHistoryOffset(portalReq.data.pastJobs.length);
  }, [portalReq.data]);

  const load = useCallback(() => {
    portalReq.fire(() => getCustomerPortal({}));
  }, [portalReq.fire]);

  useEffect(() => { load(); }, [load]);

  // ACHU-082/120: Load More preserves existing history, shows inline error + retry
  const loadMoreHistory = async () => {
    if (historyLoadingRef.current) return;
    historyLoadingRef.current = true;
    setLoadingMore(true);
    setHistoryError('');
    try {
      const d = await withTimeout(getCustomerPortal({ jobHistoryOffset: historyOffset }), 30000);
      setAllPastJobs(prev => [...prev, ...d.pastJobs]);
      setHistoryHasMore(d.pastJobsHasMore);
      setHistoryOffset(prev => prev + d.pastJobs.length);
    } catch (err: any) {
      // Preserve existing history and hasMore — never falsely indicate complete
      setHistoryError(err?.message || 'Failed to load more history. Please try again.');
    } finally {
      setLoadingMore(false);
      historyLoadingRef.current = false;
    }
  };

  const handleQuoteSubmitted = () => {
    setBookingOpen(false);
    load();
  };

  const handleProfileUpdated = (updatedCustomer: any) => {
    portalReq.setData(prev => prev ? { ...prev, customer: updatedCustomer } : prev);
  };

  // FIX 7: Offline logout overlay
  if (logoutState === 'offline') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">You appear to be offline</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">
          Logout could not be completed. Reconnect and try again.
        </p>
        <div className="flex gap-3 mt-6">
          <Button onClick={handleLogout}>
            <RefreshCw className="h-4 w-4 mr-2" />Retry
          </Button>
          <Button variant="outline" onClick={handleLogoutCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PortalHeader userName="" onLogout={handleLogout} loggingOut={logoutState === 'attempting'} />
        <div className="p-4 max-w-2xl mx-auto space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <PortalHeader userName="" onLogout={handleLogout} loggingOut={logoutState === 'attempting'} />
        <div className="p-4 max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
              <p className="text-muted-foreground">{error || 'Unable to load your account. Please try again.'}</p>
              <Button variant="outline" onClick={() => load()} disabled={refreshing}>
                {refreshing ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" />Retrying…</> : 'Try Again'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!data.customer) {
    return (
      <div className="min-h-screen bg-background">
        <PortalHeader userName="" onLogout={handleLogout} loggingOut={logoutState === 'attempting'} />
        <div className="p-4 max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center space-y-2">
              <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="font-medium">Account Not Linked</p>
              <p className="text-sm text-muted-foreground">Your customer record is not yet linked to your account. Please contact ACHU to get set up.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Profile completion gate
  const needsPhone = !data.customer.phone?.trim();
  const needsAddress = !data.customer.address?.trim();
  if (needsPhone || needsAddress) {
    return (
      <div className="min-h-screen bg-background">
        <PortalHeader userName={data.customer.customerName || user?.firstName || ''} onLogout={handleLogout} loggingOut={logoutState === 'attempting'} />
        <div className="p-4 max-w-2xl mx-auto">
          <ProfileCompletionForm
            customer={data.customer}
            needsPhone={needsPhone}
            needsAddress={needsAddress}
            onCompleted={handleProfileUpdated}
          />
        </div>
      </div>
    );
  }

  const { financialSummary: fs } = data;
  const tabs = [
    { key: 'upcoming' as const, label: 'Upcoming', icon: CalendarDays, count: data.upcomingJobs.length },
    { key: 'history' as const, label: 'History', icon: History },
    { key: 'payments' as const, label: 'Payments', icon: CreditCard },
    { key: 'account' as const, label: 'Account', icon: User },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <PortalHeader userName={data.customer.customerName || user?.firstName || ''} onLogout={handleLogout} loggingOut={logoutState === 'attempting'} onRefresh={() => load()} refreshing={refreshing} />

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {portalReq.stale && data && portalReq.error && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 flex-1">{portalReq.error} — showing cached data</p>
            <Button variant="ghost" size="sm" onClick={() => load()} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />Retry
            </Button>
          </div>
        )}
        <FinancialSummaryCard fs={fs} />

        <div className="flex justify-end">
          <Button onClick={() => setBookingOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />Request Quote
          </Button>
        </div>

        <div className="flex rounded-xl bg-muted/50 p-1 gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-medium transition-colors ${activeTab === t.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <t.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full text-[10px] px-1.5 min-w-[18px] text-center">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'upcoming' && <UpcomingJobs jobs={data.upcomingJobs} />}
        {activeTab === 'history' && <JobHistory jobs={allPastJobs} hasMore={historyHasMore} loadMore={loadMoreHistory} loadingMore={loadingMore} error={historyError} />}
        {activeTab === 'payments' && <PaymentsSection payments={data.payments} paymentsHasMore={data.paymentsHasMore} />}
        {activeTab === 'account' && <MyAccount customer={data.customer} onUpdated={handleProfileUpdated} />}
      </div>

      <QuoteFormDialog
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        onSubmitted={handleQuoteSubmitted}
        prefill={{
          name: data.customer.customerName || undefined,
          email: data.customer.email || undefined,
          phone: data.customer.phone || undefined,
          address: data.customer.address || undefined,
          postcode: data.customer.postcode || undefined,
        }}
      />
    </div>
  );
}

/* ==================== Sub-components ==================== */

function PortalHeader({ userName, onLogout, loggingOut, onRefresh, refreshing }: { userName: string; onLogout: () => void; loggingOut?: boolean; onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <header className="bg-card border-b border-border sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">A</span>
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">ACHU</p>
            {userName && <p className="text-xs text-muted-foreground leading-tight">{userName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={refreshing} className="h-8 w-8" aria-label="Refresh">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onLogout} disabled={loggingOut}>
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <LogOut className="h-4 w-4 mr-1" />}
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

function ProfileCompletionForm({ customer, needsPhone, needsAddress, onCompleted }: {
  customer: any;
  needsPhone: boolean;
  needsAddress: boolean;
  onCompleted: (c: any) => void;
}) {
  const [phone, setPhone] = useState(customer.phone || '');
  const [address, setAddress] = useState(customer.address || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const seqRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();
    if (!trimmedPhone) { setError('Phone is required.'); return; }
    if (trimmedPhone.length > LIMITS.phone) { setError(`Phone cannot exceed ${LIMITS.phone} characters.`); return; }
    if (!trimmedAddress) { setError('Address is required.'); return; }

    const mySeq = ++seqRef.current;
    setSaving(true);
    setError('');
    try {
      const res = await withTimeout(
        updateCustomerProfile({ phone: trimmedPhone, address: trimmedAddress }),
        30000,
      );
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      toast.success('Profile updated successfully.');
      onCompleted(res.customer);
    } catch (e: any) {
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      setError(e?.message || 'Unable to save. Please try again.');
    } finally {
      if (mountedRef.current && mySeq === seqRef.current) setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-5 w-5" /> Complete Your Profile
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-muted/40 rounded-lg p-3 mb-5">
          <p className="text-sm text-muted-foreground">
            <Info className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            {needsPhone && needsAddress
              ? 'Please provide your phone number and address so we can contact you about bookings and deliver our services.'
              : needsPhone
                ? 'Please provide your phone number so we can contact you about bookings.'
                : 'Please provide your address so we can deliver our services.'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone" className="text-sm">Phone {needsPhone && <span className="text-destructive">*</span>}</Label>
            <Input
              id="profile-phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Enter your phone number"
              maxLength={LIMITS.phone}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-address" className="text-sm">Address {needsAddress && <span className="text-destructive">*</span>}</Label>
            <Input
              id="profile-address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Enter your address"
              maxLength={LIMITS.address}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Check className="h-4 w-4 mr-2" />Save &amp; Continue</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function FinancialSummaryCard({ fs }: { fs: PortalData['financialSummary'] }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <SummaryItem label="Total Job Value" value={fmt(fs.totalJobValue)} />
          <SummaryItem label="Payments Received" value={fmt(fs.totalPaymentsReceived)} />
          <SummaryItem label="Refunds" value={fmt(fs.totalRefunds)} muted={fs.totalRefunds === 0} />
          <SummaryItem label="Net Paid" value={fmt(fs.netAmountPaid)} />
        </div>
        {fs.outstandingBalance > 0 && (
          <>
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">Amount Due</span>
              </div>
              <span className="text-lg font-bold text-orange-700">{fmt(fs.outstandingBalance)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryItem({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold ${muted ? 'text-muted-foreground' : ''}`}>{value}</p>
    </div>
  );
}

function getRelativeDay(dateStr?: string): string | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 14) return `In ${diffDays} days`;
  const weeks = Math.round(diffDays / 7);
  return `In ${weeks} week${weeks !== 1 ? 's' : ''}`;
}

function UpcomingJobs({ jobs }: { jobs: any[] }) {
  return (
    <div className="space-y-3">
      <StatusLegend />
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No upcoming jobs scheduled.</p>
          </CardContent>
        </Card>
      ) : jobs.map((j, i) => <JobCard key={i} job={j} showInstructions showRelativeTime />)}
    </div>
  );
}

function JobHistory({ jobs, hasMore, loadMore, loadingMore, error }: { jobs: any[]; hasMore: boolean; loadMore: () => void; loadingMore: boolean; error?: string }) {
  return (
    <div className="space-y-3">
      {jobs.length === 0 && !error ? (
        <Card>
          <CardContent className="p-8 text-center">
            <History className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No previous jobs found.</p>
            <p className="text-xs text-muted-foreground mt-1">Your completed and cancelled jobs will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {jobs.map((j, i) => <JobCard key={i} job={j} />)}
          {/* ACHU-082/120: Inline error with retry — preserves loaded history */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive flex-1">{error}</p>
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RefreshCw className="h-3.5 w-3.5 mr-1" />Retry</>}
              </Button>
            </div>
          )}
          {hasMore && !error && (
            <Button variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : <><ChevronDown className="h-4 w-4 mr-1" />Load More</>}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function JobCard({ job, showInstructions, showRelativeTime }: { job: any; showInstructions?: boolean; showRelativeTime?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const relTime = showRelativeTime ? getRelativeDay(job.jobDate) : null;

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{job.service || 'Cleaning Service'}</p>
              <StatusBadge status={job.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {job.jobId && <span className="font-mono">#{job.jobId} • </span>}
              {fmtDate(job.jobDate)}
              {relTime && <span className="ml-1.5 font-medium text-primary">({relTime})</span>}
              {job.startTime && <> • {job.startTime}</>}
              {job.finishTime && <> – {job.finishTime}</>}
            </p>
          </div>
          <div className="text-right shrink-0">
            <StatusBadge status={job.paymentStatus} />
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => setExpanded(v => !v)}
        >
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          {expanded ? 'Hide Details' : 'View Details'}
        </Button>

        {expanded && (
          <>
            {job.address && <p className="text-xs text-muted-foreground">{job.address}</p>}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><span className="text-muted-foreground">Charged</span><p className="font-medium">{fmt(job.amountCharged)}</p></div>
              <div><span className="text-muted-foreground">Paid</span><p className="font-medium">{fmt(job.amountPaid)}</p></div>
              <div><span className="text-muted-foreground">Balance</span><p className={`font-medium ${job.outstandingBalance > 0 ? 'text-orange-600' : ''}`}>{fmt(job.outstandingBalance)}</p></div>
            </div>
            {showInstructions && job.customerInstructions && (
              <p className="text-xs bg-muted/30 rounded-lg p-2 text-muted-foreground">
                <Info className="h-3 w-3 inline mr-1" />{job.customerInstructions}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentsSection({ payments: initialPayments, paymentsHasMore: initialHasMore }: { payments: any[]; paymentsHasMore: boolean }) {
  const [allPayments, setAllPayments] = useState<any[]>(initialPayments);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    setAllPayments(initialPayments);
    setHasMore(initialHasMore);
  }, [initialPayments, initialHasMore]);

  const loadMore = async () => {
    setLoadingMore(true);
    setLoadError('');
    try {
      const d = await withTimeout(getCustomerPortal({ paymentOffset: allPayments.length }), 30000);
      const existingKeys = new Set(allPayments.map(p => p._key));
      const newPayments = d.payments.filter((p: any) => !existingKeys.has(p._key));
      setAllPayments(prev => [...prev, ...newPayments]);
      setHasMore(d.paymentsHasMore);
    } catch (err: any) {
      console.warn('[CustomerApp] Failed to load more payments:', err?.message);
      setLoadError('Failed to load more payments. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-3">
      {allPayments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CreditCard className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Your payment history will appear here once payments are recorded.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {allPayments.map((p: any) => (
            <Card key={p._key}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{fmt(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(p.paymentDate)}
                      {p.paymentMethod && <> • {p.paymentMethod}</>}
                      {p.paymentProvider && <> ({p.paymentProvider})</>}
                    </p>
                    {p.externalReference && <p className="text-xs text-muted-foreground">Ref: {p.externalReference}</p>}
                    {p.linkedJobId && <p className="text-xs text-muted-foreground">Job #{p.linkedJobId}</p>}
                  </div>
                  <StatusBadge status={p.paymentStatus} />
                </div>
              </CardContent>
            </Card>
          ))}
          {loadError && (
            <p className="text-center text-xs text-destructive">{loadError}</p>
          )}
          {hasMore && (
            <Button variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : <><ChevronDown className="h-4 w-4 mr-1" />Load More</>}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function MyAccount({ customer, onUpdated }: { customer: any; onUpdated: (c: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(customer.phone || '');
  const [address, setAddress] = useState(customer.address || '');
  const [postcode, setPostcode] = useState(customer.postcode || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [needsReconcile, setNeedsReconcile] = useState(false);
  const seqRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleEdit = () => {
    setPhone(customer.phone || '');
    setAddress(customer.address || '');
    setPostcode(customer.postcode || '');
    setError('');
    setNeedsReconcile(false);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setError('');
    setNeedsReconcile(false);
  };

  const reconcileAndRetry = async () => {
    // Reload server state before allowing another save
    const mySeq = ++seqRef.current;
    setSaving(true);
    setError('');
    try {
      const fresh = await withTimeout(getCustomerPortal({}), 30000);
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      if (fresh.customer) {
        onUpdated(fresh.customer);
        // Re-populate form with server state
        setPhone(fresh.customer.phone || '');
        setAddress(fresh.customer.address || '');
        setPostcode(fresh.customer.postcode || '');
      }
      setNeedsReconcile(false);
      setError('');
      toast('Server state reloaded — review and save again.');
    } catch (e: any) {
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      setError('Could not reload server state. Please try again.');
    } finally {
      if (mountedRef.current && mySeq === seqRef.current) setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (needsReconcile) {
      await reconcileAndRetry();
      return;
    }

    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();
    if (!trimmedPhone) { setError('Phone is required.'); return; }
    if (trimmedPhone.length > LIMITS.phone) { setError(`Phone cannot exceed ${LIMITS.phone} characters.`); return; }
    if (!trimmedAddress) { setError('Address is required.'); return; }

    // ACHU-121: Send postcode as trimmed string — empty string clears, non-empty updates
    const trimmedPostcode = postcode.trim();

    const mySeq = ++seqRef.current;
    setSaving(true);
    setError('');
    try {
      const res = await withTimeout(
        updateCustomerProfile({ phone: trimmedPhone, address: trimmedAddress, postcode: trimmedPostcode }),
        30000,
      );
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      toast.success('Details updated successfully.');
      onUpdated(res.customer);
      setEditing(false);
    } catch (e: any) {
      if (!mountedRef.current || mySeq !== seqRef.current) return;
      const isTimeout = e?.message === 'Request timed out';
      setError(e?.message || 'Unable to save. Please try again.');
      if (isTimeout) setNeedsReconcile(true);
    } finally {
      if (mountedRef.current && mySeq === seqRef.current) setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />My Account</CardTitle>
            {!editing && (
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit Details
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <AccountRow label="Name" value={customer.customerName} />
          <AccountRow label="Email" value={customer.email} />

          {editing ? (
            <form onSubmit={handleSave} className="space-y-3">
              <Separator />
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone" className="text-sm">Phone <span className="text-destructive">*</span></Label>
                <Input id="edit-phone" value={phone} onChange={e => setPhone(e.target.value)} maxLength={LIMITS.phone} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-address" className="text-sm">Address <span className="text-destructive">*</span></Label>
                <Input id="edit-address" value={address} onChange={e => setAddress(e.target.value)} maxLength={LIMITS.address} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-postcode" className="text-sm">Postcode</Label>
                <Input id="edit-postcode" value={postcode} onChange={e => setPostcode(e.target.value)} maxLength={20} placeholder="e.g. SW1A 1AA" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Separator />
              {customer.customerType && <AccountRow label="Account Type" value={customer.customerType} />}
              <AccountRow label="Status" value={customer.status} badge />
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" className="flex-1" disabled={saving}>
                  {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving...</> : needsReconcile ? <><RefreshCw className="h-4 w-4 mr-1.5" />Reload &amp; Retry</> : <><Check className="h-4 w-4 mr-1.5" />Save Changes</>}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                  <X className="h-4 w-4 mr-1.5" />Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <AccountRow label="Phone" value={customer.phone} />
              <AccountRow label="Address" value={customer.address} />
              <AccountRow label="Postcode" value={customer.postcode} />
              {customer.customerType && <AccountRow label="Account Type" value={customer.customerType} />}
              <AccountRow label="Status" value={customer.status} badge />
            </>
          )}
        </CardContent>
      </Card>
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <Info className="h-3 w-3 inline mr-1" />
            If your name or email is incorrect, please contact ACHU to update your details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountRow({ label, value, badge }: { label: string; value?: string; badge?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      {badge && value ? <StatusBadge status={value} /> : <span className="text-sm font-medium text-right">{value || '—'}</span>}
    </div>
  );
}
