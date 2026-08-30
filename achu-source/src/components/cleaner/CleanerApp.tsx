import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/useAuth';
import { getCleanerJobs, GetCleanerJobsOutputType } from '@/lib/endpoints';
import { BrandLogo } from '../shared/BrandLogo';
import { LogOut, RefreshCw, AlertCircle, ShieldAlert, UserX, Settings, Loader2, WifiOff, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import CleanerTabs from './CleanerTabs';
/**
 * 🔴 §15 (Sesiunea 160) — ÎNCĂRCAT LENEȘ, și paza de mărime a cerut-o: importat static, dialogul a
 * împins bucata curățătorului peste prag (23,5 din 23 kB). ⛔ Aplicația asta se deschide de pe
 * telefon, în picioare, uneori pe date mobile — fiecare kilooctet e o secundă de așteptare în ușă.
 * ⚠️ Se descarcă abia la prima apăsare pe „Report a problem", care e rar.
 */
const ReportProblemDialog = lazy(() => import('./ReportProblemDialog'));
import TodayTab from './TodayTab';
import UpcomingTab from './UpcomingTab';
import HistoryTab from './HistoryTab';
import PayTab from './PayTab';
import ChatView from '../chat/ChatView';
import NotificationBell from '../shared/NotificationBell';
import { errMsg, errCode } from '@/lib/errorMessage';

export type CleanerJob = GetCleanerJobsOutputType['today'][0];

type ErrorKind = 'network' | 'access_denied' | 'inactive' | 'config' | 'unknown';

/** Timeout constant for data requests (15 seconds) */
const REQUEST_TIMEOUT_MS = 15_000;

/** Wrap a promise with a timeout that rejects if not resolved in time */
function withTimeout<T>(promise: Promise<T>, ms: number, label = 'Request'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

function classifyError(e: unknown): ErrorKind {
  const msg: string = (errMsg(e) ?? '').toLowerCase();
  const code: string = errCode(e) ?? '';
  if (code === 'FORBIDDEN' || msg.includes('access denied') || msg.includes('forbidden')) {
    if (msg.includes('not active') || msg.includes('inactive')) return 'inactive';
    return 'access_denied';
  }
  if (code === 'UNAUTHORIZED' || msg.includes('unauthorized') || msg.includes('401') || msg.includes('expired')) return 'access_denied';
  if (code === 'NOT_FOUND' || msg.includes('not found') || msg.includes('configuration')) return 'config';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch') || msg.includes('timeout') || msg.includes('timed out') || msg.includes('502') || msg.includes('503') || msg.includes('load') || msg.includes('err_')) return 'network';
  return 'unknown';
}

function errorMessage(kind: ErrorKind): { title: string; description: string; icon: React.ReactNode } {
  switch (kind) {
    case 'network':
      return { title: 'Unable to load jobs', description: 'There was a network or server problem. Please check your connection and try again.', icon: <AlertCircle className="h-10 w-10 text-destructive/70" /> };
    case 'access_denied':
      return { title: 'Access denied', description: 'Your session may have expired. Please sign out and sign back in, or contact Admin.', icon: <ShieldAlert className="h-10 w-10 text-destructive/70" /> };
    case 'inactive':
      return { title: 'Account inactive', description: 'Your cleaner account is currently inactive. Please contact Admin to reactivate your account.', icon: <UserX className="h-10 w-10 text-destructive/70" /> };
    case 'config':
      return { title: 'Account not configured', description: 'Your account is not linked to a cleaner profile. Please contact Admin to set up your account.', icon: <Settings className="h-10 w-10 text-destructive/70" /> };
    default:
      return { title: 'Unable to load jobs', description: 'Something went wrong. Please retry or contact Admin.', icon: <AlertCircle className="h-10 w-10 text-destructive/70" /> };
  }
}

type LogoutState = 'idle' | 'attempting' | 'offline';

export default function CleanerApp() {
  const { logout } = useAuth();
  const [data, setData] = useState<GetCleanerJobsOutputType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [retrying, setRetrying] = useState(false);
  /** §15 (Sesiunea 160) — dialogul „Report a problem", deschis de butonul de deasupra listelor. */
  const [reportOpen, setReportOpen] = useState(false);
  const [logoutState, setLogoutState] = useState<LogoutState>('idle');
  const [tab, setTab] = useState<'today' | 'upcoming' | 'history' | 'chat' | 'pay'>('today');
  const loadingRef = useRef(false);
  // Sesiunea 34 (ACHU-233): a notification click arrives as
  // `/cleaner?tab=chat&channel=<id>`. The cleaner's chat is a TAB, not a route,
  // so the tab has to be switched from the URL rather than navigated to.
  const [searchParams, setSearchParams] = useSearchParams();
  const notifiedChannel = searchParams.get('channel');
  const [chatRefresh, setChatRefresh] = useState<(() => void) | null>(null);
  const registerChatRefresh = useCallback((fn: () => void) => setChatRefresh(() => fn), []);
  // Sesiunea 80: Pay borrows the same mechanism as Chat. Without it the header
  // Refresh button would reload JOBS while the person is looking at their holiday
  // balance — nothing on screen would change, which reads as a broken button.
  const [payRefresh, setPayRefresh] = useState<(() => void) | null>(null);
  const registerPayRefresh = useCallback((fn: () => void) => setPayRefresh(() => fn), []);
  const logoutAttemptRef = useRef(false);

  useEffect(() => {
    if (searchParams.get('tab') !== 'chat') return;
    setTab('chat');
    // `tab` is consumed; `channel` is left in place because ChatView needs it and
    // guards against re-applying it itself.
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const load = useCallback(async (isRetry = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (isRetry) setRetrying(true); else setLoading(true);
    setError(null);
    try {
      const res = await withTimeout(getCleanerJobs({}), REQUEST_TIMEOUT_MS, 'Job data request');
      setData(res);
    } catch (e) {
      console.error('[CleanerApp] Load error:', errMsg(e) ?? e);
      const kind = classifyError(e);
      setError(kind);
    }
    loadingRef.current = false;
    if (isRetry) setRetrying(false); else setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRetry = () => load(true);

  /**
   * FIX 7 — ACHU-001: Offline-safe logout.
   * Attempts SDK logout. If it fails (offline), shows a clear offline message
   * with Retry and Cancel buttons. Does NOT clear local state (no false logout).
   * Does NOT show an endless spinner.
   */
  const handleLogout = useCallback(async () => {
    if (logoutAttemptRef.current) return;
    // Check online before handing control to SDK
    if (!navigator.onLine) {
      setLogoutState('offline');
      return;
    }
    logoutAttemptRef.current = true;
    setLogoutState('attempting');

    try {
      await Promise.race([
        Promise.resolve(logout()),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Logout timed out')), 5000)),
      ]);
      setData(null);
      setLogoutState('idle');
    } catch (e) {
      console.error('[CleanerApp] Logout error:', errMsg(e) ?? e);
      setLogoutState('offline');
    }
    logoutAttemptRef.current = false;
  }, [logout]);

  const handleLogoutRetry = () => handleLogout();

  const handleLogoutCancel = () => {
    setLogoutState('idle');
  };

  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const showError = error !== null && data === null;
  const showBannerError = error !== null && data !== null;

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
          <Button onClick={handleLogoutRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />Retry
          </Button>
          <Button variant="outline" onClick={handleLogoutCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/**
        * ACHU-502 (Sesiunea 108) — `z-20`, not `z-10`, and the reason is not
        * "make it bigger until it works".
        *
        * 🔴 Reported by Roberto with a photograph: the notification panel opened
        * from the bell and the TAB BAR was drawn on top of it, slicing "You have a
        * new job" in half.
        *
        * ⚠️ The panel already asks for `z-50` (`NotificationBell.tsx`) and it made
        * no difference — because a `sticky` element with a z-index creates its own
        * STACKING CONTEXT. The panel lives inside this header, so its `z-50` is
        * measured against its siblings in here, and the whole header is then placed
        * as one unit at `z-10`. The tab bar is `z-10` too and comes LATER in the
        * document, so it wins the tie and paints over everything the header
        * contains, panel included.
        *
        * ✅ Raising the HEADER to `z-20` moves the whole context above the tab bar.
        * Raising the panel further would have changed nothing at all — which is
        * exactly the trap this note exists to save the next person from.
        */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex flex-col gap-0.5">
          <BrandLogo subtitle="Cleaner" compact />
          <p className="text-xs text-muted-foreground">{dateStr}</p>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell
            homePath="/cleaner"
            // The cleaner has no `/admin` and no `/chat` route — chat is a tab
            // here — so a chat target becomes a query on this same screen.
            resolvePath={p => {
              const chat = p.match(/^\/chat(?:\?channel=(.+))?$/);
              if (chat) return `/cleaner?tab=chat${chat[1] ? `&channel=${chat[1]}` : ''}`;
              // Anything this portal has no screen for falls back to home rather
              // than navigating somewhere blank.
              return null;
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (tab === 'chat' && chatRefresh) return chatRefresh();
              if (tab === 'pay' && payRefresh) return payRefresh();
              return load(true);
            }}
            disabled={tab !== 'chat' && tab !== 'pay' && (retrying || loading)}
            className="h-9 w-9"
            aria-label={tab === 'chat' ? 'Refresh conversations' : tab === 'pay' ? 'Refresh pay details' : 'Refresh'} title={tab === 'chat' ? 'Refresh conversations' : tab === 'pay' ? 'Refresh pay details' : 'Refresh'}
          >
            <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            disabled={logoutState === 'attempting'}
            className="h-9 w-9"
            aria-label="Sign out" title="Sign out"
          >
            {logoutState === 'attempting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {showBannerError && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center gap-2" role="alert">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">Failed to refresh. Showing previously loaded data.</p>
          <Button variant="ghost" size="sm" onClick={handleRetry} disabled={retrying} className="shrink-0 h-7 text-xs">
            {retrying ? <><RefreshCw className="h-3 w-3 animate-spin mr-1" />Retrying</> : 'Retry'}
          </Button>
        </div>
      )}

      <CleanerTabs active={tab} onChange={setTab} counts={data ? { today: data.today.length, upcoming: data.upcoming.length, history: data.history.length } : undefined} />

      {/*
        🔴 §15 „Report incident" (Sesiunea 160), hotărârea lui Roberto din 29/08 — butonul stă
        **deasupra listelor, mereu la vedere**, nu pe cardul unei vizite. ⛔ Un pericol găsit între
        două vizite, sau o vizită care nici n-a început, e tot un incident; ascuns pe un card, ar fi
        fost de negăsit exact când omul e grăbit și supărat.
        ⚠️ Vizita se leagă opțional, din caseta dialogului.
      */}
      <div className="max-w-lg mx-auto w-full px-4 pt-3">
        <Button variant="outline" size="sm" className="w-full" onClick={() => setReportOpen(true)}>
          <TriangleAlert className="h-4 w-4 mr-2" />Report a problem
        </Button>
      </div>
      {/* ⚠️ `Suspense` fără nimic vizibil: dialogul se deschide oricum peste ecran, iar un
          indicator de încărcare ar clipi pentru o zecime de secundă. */}
      {reportOpen && (
      <Suspense fallback={null}>
      <ReportProblemDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        // ⚠️ Ziua de LONDRA, nu a telefonului: un curățător cu ceasul pe alt fus ar fi scris altă zi.
        today={new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())}
        jobs={(data?.today ?? []).map((j: CleanerJob) => ({
          id: j.id,
          label: `${j.customerName ?? 'Job'}${j.address ? ` — ${j.address}` : ''}`,
        }))}
      />
      </Suspense>
      )}

      <main className="flex-1 p-4 max-w-lg mx-auto w-full">
        {/* Sesiunea 29: chat is checked BEFORE the loading/error branches on
            purpose. It does not depend on getCleanerJobs, so a failure to load
            today's jobs must not also cut off the only way to tell the office
            about it. */}
        {tab === 'chat' ? (
          <ChatView canCreateChannels={false} openChannelId={notifiedChannel} onRefreshed={registerChatRefresh} />
        ) : tab === 'pay' ? (
          /* Sesiunea 80: checked before the loading/error branches for the same
             reason as Chat — Pay does not use getCleanerJobs, so a failure to load
             today's jobs must not also hide somebody's holiday balance. */
          <PayTab onRefreshed={registerPayRefresh} />
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : showError ? (
          <ErrorPanel kind={error} onRetry={handleRetry} retrying={retrying} onLogout={handleLogout} loggingOut={logoutState === 'attempting'} />
        ) : tab === 'today' ? (
          <TodayTab jobs={data?.today ?? []} onRefresh={() => load(true)} />
        ) : tab === 'upcoming' ? (
          <UpcomingTab jobs={data?.upcoming ?? []} />
        ) : (
          <HistoryTab jobs={data?.history ?? []} />
        )}
      </main>
    </div>
  );
}

function ErrorPanel({ kind, onRetry, retrying, onLogout, loggingOut }: {
  kind: ErrorKind; onRetry: () => void; retrying: boolean;
  onLogout: () => void; loggingOut: boolean;
}) {
  const info = errorMessage(kind);
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4" role="alert" aria-live="assertive">
      {info.icon}
      <h2 className="text-lg font-semibold mt-4">{info.title}</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-xs">{info.description}</p>
      <div className="flex gap-3 mt-6">
        <Button className="min-h-[44px]" onClick={onRetry} disabled={retrying}>
          {retrying ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Retrying...</> : <><RefreshCw className="h-4 w-4 mr-2" />Retry</>}
        </Button>
        <Button variant="outline" className="min-h-[44px]" onClick={onLogout} disabled={loggingOut}>
          {loggingOut ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Signing out...</> : <><LogOut className="h-4 w-4 mr-2" />Sign Out</>}
        </Button>
      </div>
    </div>
  );
}

