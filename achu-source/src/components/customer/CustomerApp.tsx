import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCustomerPortal, GetCustomerPortalOutputType } from '@/lib/endpoints';
import { useTrackedRequest, withTimeout } from '@/lib/useTrackedRequest';
import { useAuth } from '@/lib/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, History, CreditCard, User, Plus, AlertCircle, FileText, WifiOff, RefreshCw } from 'lucide-react';
import { fmtDate } from '@/lib/format';
import QuoteFormDialog from './QuoteFormDialog';
import { CustomerRequestDialog, CustomerRequestsList, type RequestKind } from './CustomerRequests';
// ACHU-576 — instrucțiunile de acces, PER CASĂ (înainte: un singur text pe client, ACHU-239).
import PropertyAccess from './PropertyAccess';
import ConsentSettings from './ConsentSettings';
import PortalHeader from './PortalHeader';
import ProfileCompletionForm from './ProfileCompletionForm';
import FinancialSummaryCard from './FinancialSummaryCard';
import UpcomingJobs from './UpcomingJobs';
import JobHistory from './JobHistory';
import PaymentsSection from './PaymentsSection';
import Documents from './Documents';
import LegalDocuments from './LegalDocuments';
import SubscriptionCards from './SubscriptionCards';
import RecurringContracts from './RecurringContracts';
import MyAccount from './MyAccount';
// ACHU-545 — nota de confidențialitate, cu retenția derivată din politica de ștergere.
import PrivacyNotice from './PrivacyNotice';
import { errMsg } from '@/lib/errorMessage';
import type { PortalJob, PortalCustomer } from './portalTypes';

type PortalData = GetCustomerPortalOutputType;

const TAB_KEYS = ['upcoming', 'history', 'payments', 'documents', 'account'] as const;
type TabKey = (typeof TAB_KEYS)[number];

type LogoutState = 'idle' | 'attempting' | 'offline';

export default function CustomerApp() {
  const { user, logout } = useAuth();
  const portalReq = useTrackedRequest<PortalData>({ timeoutMs: 30000 });
  const data = portalReq.data;
  const loading = !data && !portalReq.error;
  const error = (!data && portalReq.error) ? portalReq.error : '';
  const refreshing = portalReq.loading;
  const [bookingOpen, setBookingOpen] = useState(false);
  // ACHU-238: which request the customer is raising, and about which visit. Held as one
  // object so opening a second dialog cannot leave a stale job attached to it.
  /**
   * ACHU-435 (Sesiunea 95) — this was `job?: any`. `job.id` did not exist in the portal
   * payload (only `jobId`, the display number), so reschedule and cancellation requests
   * were rejected by the server from Sesiunea 42 onward while the dialog looked
   * perfectly filled in.
   *
   * ⚠️ **Naming the fields here DOCUMENTS the contract; it does not enforce it.** The
   * payload arrives as `any` from `getCustomerPortal` and flows through `UpcomingJobs`
   * and `JobCard`, which are `any` too — so assigning it to this shape type-checks no
   * matter what the server sends. Writing "the build would fail" here would be a
   * guarantee nothing implements, which is §9 pattern 3 in `CURRENT_STATE.md`.
   *
   * 🔴 **The actual guard is a test** — `CustomerApp.test.tsx`, "sends the visit's id",
   * which renders the real dialog over a realistic payload and asserts the posted body.
   * Verified by mutation: removing `id` from the server payload makes it fail.
   */
  const [requestDialog, setRequestDialog] = useState<
    | { kind: RequestKind; job?: { id: string; service?: string | null; jobDate: string } }
    | { kind: RequestKind; series: { id: string; description?: string | null } }
    | null
  >(null);
  /**
   * ACHU-428 (Sesiunea 94). The portal is one route with internal tabs, so a
   * notification that says "your quote is ready" has no way to land on the tab
   * holding it — unless the tab can be named in the URL. `?tab=documents` is
   * read once, for the opening tab only; after that the tabs are ordinary state
   * and pressing one does not rewrite the address bar.
   *
   * ⚠️ Validated against the known list rather than cast. `?tab=` is
   * user-editable, and an unknown value must open Upcoming, not render an empty
   * screen that looks like the portal failed to load.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const requested = searchParams.get('tab');
    return (TAB_KEYS as readonly string[]).includes(requested ?? '') ? (requested as TabKey) : 'upcoming';
  });

  /**
   * 🔴 ACHU-437 (Sesiunea 95) — "notifications are not clickable in customer portal".
   *
   * The initialiser above runs **once, on mount**. That is right for arriving from
   * outside (a cold load from a phone notification) and wrong for the far more common
   * case: the customer is ALREADY in the portal, taps the notification in the bell,
   * and React Router changes the URL **without remounting this component**. The panel
   * closed, `?tab=documents` appeared in the address bar, and nothing else happened —
   * which is indistinguishable from a dead link.
   *
   * ⚠️ **The param is CONSUMED, not just read.** Reacting to its value alone would work
   * once: after the customer manually pressed another tab, the URL would still say
   * `documents`, so tapping the same notification again navigates to an identical URL,
   * no value changes, and the effect never fires. Deleting it means every arrival is a
   * real transition — and the address bar stops claiming a tab that is not open.
   *
   * ✅ `CleanerApp.tsx:88` has done exactly this since Sesiunea 80 for the chat tab.
   * The pattern was already in the repository; this portal simply never got it — the
   * third time today that one half of the codebase knew something the other did not
   * (see ACHU-433 and ACHU-435).
   */
  useEffect(() => {
    const requested = searchParams.get('tab');
    if (!requested) return;
    if ((TAB_KEYS as readonly string[]).includes(requested)) setActiveTab(requested as TabKey);
    // Dropped even when invalid: a `?tab=nonsense` left in the address bar would be
    // re-consumed on every render pass and never resolve to anything.
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
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
    } catch (e) {
      console.error('[CustomerApp] Logout error:', errMsg(e) ?? e);
      setLogoutState('offline');
    }
  }, [logout, logoutState]);

  const handleLogoutCancel = () => setLogoutState('idle');

  // Pagination
  const [historyOffset, setHistoryOffset] = useState(0);
  const [allPastJobs, setAllPastJobs] = useState<PortalJob[]>([]);
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
    } catch (err) {
      // Preserve existing history and hasMore — never falsely indicate complete
      setHistoryError(errMsg(err) || 'Failed to load more history. Please try again.');
    } finally {
      setLoadingMore(false);
      historyLoadingRef.current = false;
    }
  };

  const handleQuoteSubmitted = () => {
    setBookingOpen(false);
    load();
  };

  const handleProfileUpdated = (updatedCustomer: PortalCustomer) => {
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
  /**
   * ACHU-553 (Sesiunea 121) — invitația la o recenzie publică, compusă într-un singur loc.
   *
   * 🔴 **Toate trei condițiile vin de la SERVER**, iar aceea e chiar regula: dacă `allowed`
   * s-ar calcula aici, ecranul ar trebui să vadă reclamațiile clientului — și al treilea loc
   * care afișează invitația ar uita condiția. Vezi `backend/src/lib/publicReviewPolicy.ts`.
   *
   * ⛔ **`undefined` dacă serverul nu a trimis pragul** — atunci invitația pur și simplu nu
   * apare. Alternativa ar fi fost o valoare de rezervă scrisă aici, adică **a doua definiție**
   * a pragului, care se poate desincroniza tăcut de cea din backend.
   */
  const reviewInvite = typeof data.reviewAskFromScore === 'number'
    ? { allowed: !!data.canInvitePublicReview, url: data.googleReviewUrl ?? null, fromScore: data.reviewAskFromScore }
    : undefined;

  const tabs = [
    { key: 'upcoming' as const, label: 'Upcoming', icon: CalendarDays, count: data.upcomingJobs.length },
    { key: 'history' as const, label: 'History', icon: History },
    { key: 'payments' as const, label: 'Payments', icon: CreditCard },
    /**
     * ACHU-236: invoices and quotes were issued to the customer and they had no way
     * to get them. Named "Documents" rather than "Invoices" because quotes live
     * here too, and a customer looking for "my paperwork" finds one tab.
     *
     * 🔴 **ACHU-504 (Sesiunea 108).** Roberto, from his phone: *"2 ala sau orice
     * alta cifra ramane acolo la infinit."* The badge used to be
     * `invoices.length + quotes.length` — a running total of everything the customer
     * has ever been sent. It never went down, and it only ever went up: one invoice
     * plus one quote showed a permanent "2", drawn as a filled primary pill,
     * identical to the unread count on the bell right next to it.
     *
     * ⚠️ **The number was correct and the SIGNAL was false** — the same shape of
     * defect as ACHU-497 and ACHU-503. A badge like that means "something here wants
     * you"; an inventory of paperwork you already have wants nothing. Read literally
     * every day, it teaches people to ignore the one badge that will matter.
     *
     * ✅ Now it counts only what is **waiting on the customer**: a quote the office
     * has finalised and they have not answered yet. That is a real to-do, it clears
     * the moment they accept or decline, and when there is nothing to do there is no
     * badge at all. ⛔ Invoices are deliberately NOT counted: an invoice is not an
     * action, and "you owe money" is already said, in money, at the top of the
     * screen.
     */
    /**
     * 🔴 `RevisionRequested` SE NUMĂRĂ, la fel ca lipsa unui răspuns (Sesiunea 118).
     * Rândul era `!q.customerResponse`, iar cu al treilea răspuns acela ar fi produs cel
     * mai rău eșec posibil al funcționalității: clientul cere o modificare, biroul trimite
     * oferta revizuită, iar `customerResponse` rămâne `RevisionRequested` — deci oferta nu
     * ar mai apărea niciodată în badge și **clientul nu ar afla că a primit un răspuns**.
     * Un „to-do" care dispare fix când devine acționabil.
     */
    {
      key: 'documents' as const, label: 'Documents', icon: FileText,
      count: (data.quotes ?? []).filter((q: { customerResponse?: string | null }) => !q.customerResponse || q.customerResponse === 'RevisionRequested').length,
    },
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

        {activeTab === 'upcoming' && (
          <UpcomingJobs jobs={data.upcomingJobs} onRequest={(kind, job) => setRequestDialog({ kind, job })} />
        )}
        {activeTab === 'history' && <JobHistory jobs={allPastJobs} hasMore={historyHasMore} loadMore={loadMoreHistory} loadingMore={loadingMore} error={historyError} onRequest={(kind, job) => setRequestDialog({ kind, job })} reviewInvite={reviewInvite} onRated={() => load()} />}
        {/* ACHU-499 — `customer` and `business` are what the receipt PDF names as
            the two parties. Both already on `data`; neither is a new fetch. */}
        {activeTab === 'payments' && (
          <PaymentsSection
            payments={data.payments}
            paymentsHasMore={data.paymentsHasMore}
            customer={data.customer}
            business={data.business}
          />
        )}
        {activeTab === 'documents' && (
          <Documents invoices={data.invoices ?? []} quotes={data.quotes ?? []} onResponded={() => load()} />
        )}
        {/* ACHU-475: the agreements Admin generates from this same record —
            shown under Documents because that is where a customer looking
            for "my paperwork" already is. */}
        {activeTab === 'documents' && <LegalDocuments />}
        {/* ACHU-238: shown under Documents too — a customer looking for "what did I ask
            for and what did they say" looks where their paperwork is. */}
        {activeTab === 'documents' && <CustomerRequestsList requests={data.requests ?? []} />}
        {activeTab === 'account' && (
          <>
            {/* ACHU-236: their recurring contract, above the account details —
                "when do you come?" is asked far more often than "change my phone
                number". */}
            {/* Sesiunea 45 (backlog 53): above the schedule, because a customer who
                paid a lump sum up front looks for that money first — "what did my
                £1,224 buy me" is a more urgent question than "when do you come". */}
            <SubscriptionCards subscriptions={data.subscriptions ?? []} />
            <RecurringContracts
              contracts={data.recurringContracts ?? []}
              onRequest={(kind, series) => setRequestDialog({ kind, series })}
            />
            {/* ACHU-239: above the contact details on purpose — this is the thing that
                stops a cleaner ringing the office from the doorstep.
                🔴 ACHU-576: își încarcă singur casele, deci nu mai atârnă de `data.customer` —
                instrucțiunile nu mai sunt un câmp al clientului, ci ale fiecărei case. */}
            <PropertyAccess />
            {/* ACHU-427: directly under "Getting in", and that placement is the
                argument. The section above invites the customer to type a gate
                code; this is where they say whether we may hold one at all. */}
            <ConsentSettings />
            <MyAccount
              customer={data.customer}
              onUpdated={handleProfileUpdated}
              onRequest={() => setRequestDialog({ kind: 'ProfileCorrection' })}
              onCloseAccount={() => setRequestDialog({ kind: 'AccountClosure' })}
              googleReviewUrl={data.googleReviewUrl}
              canInvitePublicReview={data.canInvitePublicReview !== false}
            />
            {/* ACHU-545: sub „My account", fiindcă acolo sunt cele două butoane pe care
                le explică — „Download my data" și „Request account closure". Explicația
                a ce se întâmplă când apeși un buton stă lângă buton. */}
            <PrivacyNotice />
          </>
        )}
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

      {requestDialog && (
        <CustomerRequestDialog
          open
          kind={requestDialog.kind}
          jobId={'job' in requestDialog ? requestDialog.job?.id : undefined}
          jobLabel={'job' in requestDialog && requestDialog.job ? `${requestDialog.job.service || 'Cleaning'} — ${fmtDate(requestDialog.job.jobDate)}` : undefined}
          recurringSeriesId={'series' in requestDialog ? requestDialog.series.id : undefined}
          seriesLabel={'series' in requestDialog ? requestDialog.series.description ?? undefined : undefined}
          // ACHU-563 — promisiunea de răspuns la o reclamație, exact cum a scris-o serverul.
          responsePromise={data.complaintResponsePromise ?? null}
          onClose={() => setRequestDialog(null)}
          onSubmitted={() => load()}
        />
      )}
    </div>
  );
}

