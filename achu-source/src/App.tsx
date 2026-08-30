import { useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import { useVersionCheck } from './lib/useVersionCheck';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { RoleProvider, useRole } from './components/RoleProvider';
import AccessDenied from './components/AccessDenied';
import LoginPage from './components/LoginPage';
import { onSessionGone } from './lib/sessionExpiry';
// 🆕 §1 (Sesiunea 158) — o sesiune expirată nu mai mănâncă formularul de pe ecran; vezi `draftSeal.ts`.
import { sealFormDrafts, resolveSealedDrafts } from './lib/draftSeal';
import AcceptInvitePage from './components/AcceptInvitePage';
import CompleteProfilePage from './components/CompleteProfilePage';
import PublicQuoteRequestPage from './components/public/PublicQuoteRequestPage';

/**
 * Gazda pe care stă DOAR formularul public de cerere de ofertă (ACHU-186).
 *
 * ⛔ Aici, nu într-o variabilă de mediu: e un nume public, nu un secret, iar o valoare de mediu
 * lipsă pe Railway ar face pagina să dispară tăcut exact pe adresa dată clienților.
 *
 * 🔴 **DECIZIE DE OWNER, 18/08/2026: SUBDOMENIUL NU SE MAI FACE.** *„quote.achu.uk e incheiata. E pe
 * portal.achu.uk/request-quote… Sunt multumit cu urlul"*. ⛔ Deci nu se mai cere niciun DNS și
 * întrebarea „unde e administrat DNS-ul lui `achu.uk`" e închisă — nu mai blochează nimic.
 *
 * ⚠️ **Ramura de mai jos RĂMÂNE, deliberat.** Fără o înregistrare DNS, condiția nu se potrivește
 * niciodată: costă zero și nu poate păcăli pe nimeni. ⛔ Nu s-a șters ca să nu se scoată cod care
 * n-a fost cerut să fie scos — un cuvânt și pleacă. Calea `/request-quote` e cea care lucrează.
 */
const QUOTE_HOSTNAME = 'quote.achu.uk';
import ErrorBoundary from './components/shared/ErrorBoundary';
import NotFound from './components/shared/NotFound';
import DocumentTitle from './components/shared/DocumentTitle';
import { isNarrowRole, narrowRoleHome, narrowRoleMayOpen } from './lib/roleScope';

// Perf (audit finding, 29/07/2026): a user only ever uses ONE of these 3
// role portals per session, but all 3 — plus every Admin sub-page — used to
// be imported eagerly, so e.g. a Cleaner's first login downloaded the full
// Admin bundle too. Splitting by route means each role only fetches its own
// code. AuditHistory exports its page as a named export, not default, so
// its dynamic import is adapted to the { default } shape lazy() requires.
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const Dashboard = lazy(() => import('./components/admin/Dashboard'));
const CustomersPage = lazy(() => import('./components/admin/CustomersPage'));
const JobsPage = lazy(() => import('./components/admin/JobsPage'));
const PaymentsPage = lazy(() => import('./components/admin/PaymentsPage'));
const ExpensesPage = lazy(() => import('./components/admin/ExpensesPage'));
const CleanersPage = lazy(() => import('./components/admin/CleanersPage'));
const UserAccountsPage = lazy(() => import('./components/admin/UserAccountsPage'));
const FinancialSettingsPage = lazy(() => import('./components/admin/FinancialSettingsPage'));
const InvoiceSettingsPage = lazy(() => import('./components/admin/InvoiceSettingsPage'));
// 🆕 §22 (Sesiunea 158) — aspectul, mutat din bara de sus în Setup.
const AppearancePage = lazy(() => import('./components/admin/AppearancePage'));
const ActionCentrePage = lazy(() => import('./components/admin/ActionCentrePage'));
const TasksPage = lazy(() => import('./components/admin/TasksPage'));
const ReCleansPage = lazy(() => import('./components/admin/ReCleansPage'));
const QualityChecksPage = lazy(() => import('./components/admin/QualityChecksPage'));
const QualityReportPage = lazy(() => import('./components/admin/QualityReportPage'));
const AuditHistoryPage = lazy(() => import('./components/admin/AuditHistory').then(m => ({ default: m.AuditHistoryPage })));
const QuoteRequestPage = lazy(() => import('./components/admin/QuoteRequestPage'));
const PriceCalculatorPage = lazy(() => import('./components/admin/PriceCalculatorPage'));
// §8 (Sesiunea 146) — catalogul de servicii.
const ServicesPage = lazy(() => import('./components/admin/ServicesPage'));
const InvitationsPage = lazy(() => import('./components/admin/InvitationsPage'));
// §33 (Sesiunea 161) — hârtiile firmei: poliță, înregistrări, evaluări de risc.
const CompanyDocumentsPage = lazy(() => import('./components/admin/CompanyDocumentsPage'));
const CustomerRequestsPage = lazy(() => import('./components/admin/CustomerRequestsPage'));
const IncidentsPage = lazy(() => import('./components/admin/IncidentsPage'));
const InventoryPage = lazy(() => import('./components/admin/InventoryPage'));
const VehiclesPage = lazy(() => import('./components/admin/VehiclesPage'));
// ACHU-537 — notele și feedbackul clienților, plus tendința de satisfacție.
const CustomerFeedbackPage = lazy(() => import('./components/admin/CustomerFeedbackPage'));
// ACHU-540 — cine rămâne și cine pleacă.
const CustomerReportPage = lazy(() => import('./components/admin/CustomerReportPage'));
const ChatPage = lazy(() => import('./components/admin/ChatPage'));
const BackupPage = lazy(() => import('./components/admin/BackupPage'));
const DataBreachPage = lazy(() => import('./components/admin/DataBreachPage'));
// 🔴 ACHU-770 (Sesiunea 148) — registrul breșelor, ecran propriu: cere serverul, iar pagina de
// procedură nu are voie să ceară nimic (se citește când ceva e deja stricat).
const DataBreachRegister = lazy(() => import('./components/admin/DataBreachRegister'));
const DataSharingRegister = lazy(() => import('./components/admin/DataSharingRegister'));
const WaitingPage = lazy(() => import('./components/admin/WaitingPage'));
const SchedulePage = lazy(() => import('./components/admin/SchedulePage'));
const CalendarPage = lazy(() => import('./components/admin/CalendarPage'));
const DispatchSheetPage = lazy(() => import('./components/admin/DispatchSheetPage'));
const RecurringSeriesPage = lazy(() => import('./components/admin/RecurringSeriesPage'));
const SubscriptionsPage = lazy(() => import('./components/admin/SubscriptionsPage'));
const PayrollSimulatorPage = lazy(() => import('./components/admin/PayrollSimulatorPage'));
const PayrollPeoplePage = lazy(() => import('./components/admin/PayrollPeoplePage'));
const PayrollRunsPage = lazy(() => import('./components/admin/PayrollRunsPage'));
const PayrollReportPage = lazy(() => import('./components/admin/PayrollReportPage'));
const TimesheetsPage = lazy(() => import('./components/admin/TimesheetsPage'));
const LeavePage = lazy(() => import('./components/admin/LeavePage'));
const SicknessPage = lazy(() => import('./components/admin/SicknessPage'));
const FamilyLeavePage = lazy(() => import('./components/admin/FamilyLeavePage'));
const ErrorLogPage = lazy(() => import('./components/admin/ErrorLogPage'));
const TimeVariancePage = lazy(() => import('./components/admin/TimeVariancePage'));
// §38 (Sesiunea 154) — fereastra din calendar față de cât a ținut de fapt. ⛔ Altă întrebare decât cea de sus.
const ScheduleAccuracyPage = lazy(() => import('./components/admin/ScheduleAccuracyPage'));
// §38 (Sesiunea 154) — cât din ce intră ajunge muncă plătită: cererile și ofertele, ca două pâlnii.
const QuoteFunnelPage = lazy(() => import('./components/admin/QuoteFunnelPage'));
// §38 (Sesiunea 154) — ce s-a cheltuit, pe ce, și cu ce hârtie în spate.
const ExpenseReportPage = lazy(() => import('./components/admin/ExpenseReportPage'));
const MonthlySummaryPage = lazy(() => import('./components/admin/MonthlySummaryPage'));
const DuplicatesPage = lazy(() => import('./components/admin/DuplicatesPage'));
const TeamsPage = lazy(() => import('./components/admin/TeamsPage'));
// §38 (Sesiunea 154) — ce bani au intrat, pe ce drum, și ce s-a întors.
const PaymentReportPage = lazy(() => import('./components/admin/PaymentReportPage'));
const ProblemReportPage = lazy(() => import('./components/admin/ProblemReportPage'));
const JobsReportPage = lazy(() => import('./components/admin/JobsReportPage'));
const ProfitabilityPage = lazy(() => import('./components/admin/ProfitabilityPage'));
// §24 (Sesiunea 153) — creanțele, pe vechime: „de cât timp” era întrebarea care lipsea.
const AgedReceivablesPage = lazy(() => import('./components/admin/AgedReceivablesPage'));
const PushSetupPage = lazy(() => import('./components/admin/PushSetupPage'));
const CleanerApp = lazy(() => import('./components/cleaner/CleanerApp'));
const CustomerApp = lazy(() => import('./components/customer/CustomerApp'));

export default function App() {
  const lifeOSCopy = new URLSearchParams(window.location.search).get('lifeos') === '1';
  const { user, isLoading, logout } = useAuth();

  // ACHU-FU-001, adapted for Supabase (no more hosted-login redirect to
  // target): if this tab already had a user and then lost one (logout),
  // force a hard navigation to '/' the next time a user appears, instead of
  // leaving the browser sitting on the previous session's portal route —
  // otherwise the new user's role gate would be evaluated against a stale
  // path and could land them on an AccessDenied screen for someone else's role.
  //
  // 🔴 These three hooks sit ABOVE the public-page return below, and must stay
  // there (ACHU-400). They used to sit under it, so on `/request-quote` React
  // saw three fewer hooks than on every other address. It never crashed, for one
  // reason only: the condition reads `window.location.pathname`, which cannot
  // change without a full page load, so no single mounted App ever saw both
  // counts. That is a property of how the page is entered, not of this
  // component — and ACHU-399 changed how addresses are entered. Anything that
  // later makes the public page reachable by client-side navigation (a router
  // above this point, a redirect after submitting the form) would turn it into
  // "Rendered fewer hooks than expected", a crash with no useful stack.
  // Above the return, the count is the same on every address, unconditionally.
  const hadUserRef = useRef(false);
  const loggedOutRef = useRef(false);

  /**
   * 🆕 §1 „Expirarea sesiunii" / „Redirect după expirarea sesiunii" (Sesiunea 155).
   *
   * ⛔ Până azi, un token mort lăsa omul pe ecranul lui, cu o bandă roșie care spunea *„Invalid or
   * expired session"* și cu butoanele tot acolo — fiecare apăsare pica la fel. ⚠️ Aplicația ȘTIA și
   * nu făcea nimic cu informația.
   *
   * 🔴 **Reacția e o singură ieșire din cont**, iar restul se întâmplă de la sine: `useAuth` pierde
   * utilizatorul, `App` randează ecranul de intrare, iar acesta arată propoziția marcată în
   * `sessionExpiry.ts`. ⛔ Nicio navigare scrisă de mână și niciun `window.location`: ar fi al doilea
   * mecanism de „unde ești", lângă cel care există.
   *
   * ⚠️ **Numai pe codul `UNAUTHENTICATED`** — un refuz de rol nu scoate pe nimeni din cont.
   */
  /**
   * 🆕 §1 „Reautentificare fără pierderea formularului curent" (Sesiunea 158) — **sigiliul se pune
   * ÎNAINTE de ieșire.**
   *
   * ⛔ Ordinea nu e o preferință: `logout()` șterge ciornele (§46), deci după el n-ar mai fi rămas ce
   * să se sigileze. ⚠️ Emailul e al omului care era în cont **acum** — el, și numai el, poate primi
   * ciornele înapoi la intrarea următoare.
   */
  const emailRef = useRef<string | null>(null);
  /** ⚠️ Scris într-un efect, nu în randare: un `ref` atins în randare e o valoare care se poate rupe de ecran. */
  useEffect(() => { emailRef.current = user?.email ?? null; }, [user]);

  useEffect(() => {
    onSessionGone(() => { sealFormDrafts(emailRef.current); logout(); });
    return () => onSessionGone(null);
  }, [logout]);

  useEffect(() => {
    if (user) {
      /**
       * 🆕 §1 (Sesiunea 158) — la fiecare intrare, sigiliul se **rezolvă**: același om își primește
       * ciornele înapoi, altcineva le vede șterse. ⛔ Chemată aici, nu pe ecranul de intrare: e o
       * hotărâre despre date, nu despre ce se desenează, iar ecranul acela nici nu știe cine a intrat.
       */
      resolveSealedDrafts(user.email);
      if (loggedOutRef.current) {
        loggedOutRef.current = false;
        if (window.location.pathname !== '/') { window.location.replace('/'); return; }
      }
      hadUserRef.current = true;
    } else if (hadUserRef.current) {
      loggedOutRef.current = true;
    }
  }, [user]);

  // ACHU-265: the quiet half of a stale tab — see useVersionCheck.ts. A
  // one-shot toast rather than a repeated one, since `stale` only ever
  // flips false→true for the life of this tab.
  const { stale } = useVersionCheck();
  useEffect(() => {
    if (!stale) return;
    toast('A new version of ACHU is available.', {
      duration: Infinity,
      action: { label: 'Reload', onClick: () => window.location.reload() },
    });
  }, [stale]);

  // Sesiunea 26 (ACHU-186): the one genuinely public page in the app — no
  // login, checked before the auth gate below (everything else in this SPA
  // requires a Supabase session first). Matches how the old Zite public
  // quote form worked: reachable by anyone, no account needed.
  //
  // ⚠️ On this page the effect above is a no-op: there is no user and no prior
  // user, so both branches fall through. Running it costs nothing and buys a
  // hook count that does not depend on the address.
  // ACHU-406: a trailing slash is the same address to a browser and to
  // scripts/serve-frontend.mjs (which serves index.html for both), but an
  // exact string match treated it as a different, unrecognised one — falling
  // through to the login wall on the one page that must never require login.
  // 🔴 Cerut de Roberto, 17/08/2026: *„Vreau sa pun la forma quote.achu.uk"*. Subdomeniul e
  // pentru formular și pentru nimic altceva, deci se recunoaște după GAZDĂ, nu după cale —
  // altfel un client care tastează doar `quote.achu.uk` ar nimeri în peretele de login.
  // ⚠️ Aceeași ramură ca `/request-quote`, nu o a doua pagină: o copie s-ar rupe tăcut de
  // original la prima modificare.
  if (
    window.location.hostname === QUOTE_HOSTNAME
    || window.location.pathname.replace(/\/$/, '') === '/request-quote'
  ) {
    return <PublicQuoteRequestPage />;
  }

  if (isLoading) return <Spinner />;
  if (!user) return <LoginPage />;

  return (
    <BrowserRouter basename={lifeOSCopy ? '/achu-copy' : undefined}>
      <Toaster />
      {/* Sesiunea 29 (backlog 46): outermost boundary — last resort. Catches a
          throw in RoleProvider or anything else above the routes, which would
          otherwise blank the entire app. No resetKey here: it sits outside
          useLocation's reach, so recovery is the explicit Reload button. */}
      <ErrorBoundary label="app-root">
        <RoleProvider>
          <AppRoutes />
        </RoleProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

function AppRoutes() {
  const { role, active, loading, configError, firstName, lastName } = useRole();
  const { logout } = useAuth();
  const location = useLocation();

  const handleLogout = useCallback(() => {
    if (!navigator.onLine) return; // Will be handled by portal-level offline logout
    logout();
  }, [logout]);

  if (loading) return <Spinner />;

  // ACHU-142: must be checked before the role/active gate below, not only
  // declared as a route inside it — an inactive or wrong-role account (the
  // exact case accepting an invitation exists to fix) would otherwise never
  // reach this page at all, stuck behind the very gate it needs to pass.
  if (location.pathname === '/accept-invite') {
    return <AcceptInvitePage />;
  }

  if (configError) {
    return <AccessDenied message={configError} onLogout={handleLogout} />;
  }

  if (!role || !active) {
    return (
      <AccessDenied
        message={!active && role ? 'Your account has been deactivated. Please contact an administrator.' : 'Your account is being set up. Please try again shortly.'}
        onLogout={handleLogout}
      />
    );
  }

  // Sesiunea 15: asked once, for any account regardless of how it was
  // created (auto-provisioned Customer or an accepted invitation) — neither
  // path ever collects a name. Placed after the role/active gate above, so
  // a genuinely deactivated/roleless account still sees AccessDenied, not
  // this form.
  if (!firstName || !lastName) {
    return <CompleteProfilePage />;
  }

  /**
   * ACHU-348 (Sesiunea 82). `ReadOnly` lands in the SAME place as an Admin, because
   * it is not a fourth portal — it is an Admin who cannot change anything. A
   * separate read-only area would mean a second copy of every screen, and the two
   * would drift.
   */
  /**
   * ACHU-357 (Sesiunea 83). `FinanceOnly` and `HROnly` land in the same area for the
   * same reason — they are Admins narrowed to one subject, not new portals.
   *
   * ⚠️ But their HOME is not `/admin`: that route is the Dashboard, which both roles
   * are refused. Sent there, the first thing a new finance account would ever see is
   * a permission error on its own home page, and the reasonable conclusion is that
   * the account was set up wrong. `narrowRoleHome` sends each one to its first real
   * screen instead.
   */
  /**
   * 🔴 Sesiunea 144 — `SuperAdmin` intră AICI, și e cel mai important rând al feliei pe frontend.
   *
   * ⛔ Lipsă, consecința nu ar fi fost un buton ascuns: `isAdminArea` decide **întreaga zonă de
   * birou**, deci owner-ul, în clipa în care își pune rolul nou pe cont, ar fi văzut *„You do not
   * have access to the Admin area"* și ar fi fost trimis pe portalul de client. ⚠️ Adică s-ar fi
   * încuiat singur pe dinafară exact cu schimbarea care trebuia să-i dea control complet.
   */
  const isAdminArea = role === 'SuperAdmin' || role === 'Admin' || role === 'ReadOnly' || isNarrowRole(role);
  const home = isNarrowRole(role)
    ? narrowRoleHome(role)
    : isAdminArea ? '/admin' : role === 'Cleaner' ? '/cleaner' : '/customer';

  /**
   * Sesiunea 35 (ACHU-235). Cold start from a phone notification: the service
   * worker had no window to focus, so it opened `/?notify=<role-relative-path>`.
   * The role is only known here, so this is the one place that can turn that into
   * a real destination — and it must happen at the root redirect, or the query
   * would be dropped by it and the tap would land on the Dashboard, which is the
   * bug ACHU-233 fixed for the in-app case.
   */
  const notifyTarget = (() => {
    const raw = new URLSearchParams(location.search).get('notify');
    /**
     * 🔴 ACHU-789 (Sesiunea 157) — **valoarea vine dintr-un LINK**, deci se citește ca text de-al
     * altcuiva: oricine poate trimite cuiva `.../?notify=…`. ⛔ Până azi ajungea să înceapă cu `/`,
     * iar `//gazdă-străină/x` începe cu `/` — primea prefixul de rol și devenea o adresă **moartă**
     * (`/admin//gazdă-străină/x`), adică omul apăsa și ajungea pe „adresă necunoscută". ⚠️ Nu era o
     * ieșire din aplicație (prefixul o ține pe același domeniu), dar nici un ecran pe care cineva
     * să-l poată înțelege.
     *
     * ✅ Se acceptă doar o **cale internă** — un singur `/` la început. Aceeași regulă ca la `?next=`
     * (`lib/authRedirectGuard.ts`, Sesiunea 155): nicio destinație de navigare nu se ia de-a gata
     * dintr-o adresă.
     */
    if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw === '/') return null;
    if (isAdminArea) return raw.startsWith('/admin') ? raw : `/admin${raw}`;
    if (role === 'Cleaner') {
      const chat = raw.match(/^\/chat(?:\?channel=(.+))?$/);
      // The cleaner's chat is a tab, not a route — same mapping as the bell's.
      return chat ? `/cleaner?tab=chat${chat[1] ? `&channel=${chat[1]}` : ''}` : null;
    }
    return null;
  })();

  // Sesiunea 28: send the user to their own portal whenever the current path
  // belongs to a different role's area.
  //
  // The previous mechanism (ACHU-FU-001, in App above) only recognised a
  // logout->login transition inside one continuous tab session, via
  // `loggedOutRef`. Both real login methods are magic-link and Google OAuth,
  // and both come back into the app through a full page load — so those refs
  // start fresh and the reset never fired. Switching accounts left the
  // browser on the previous role's path (e.g. /admin/jobs as a Cleaner),
  // which then rendered "You do not have access to the Admin area."
  //
  // Deciding from the path against the *current* role instead of trying to
  // detect the switch covers every way a new session can arrive: OAuth
  // redirect, magic link, a session picked up from another tab, or a plain
  // logout/login. The per-area gates in the routes below are kept as a
  // backstop for any area added later without updating this map.
  const AREA_ROLES: Record<string, string> = { '/admin': 'Admin', '/cleaner': 'Cleaner', '/customer': 'Customer' };
  const area = Object.keys(AREA_ROLES).find(p => location.pathname === p || location.pathname.startsWith(`${p}/`));
  /**
   * Two separate questions about the current address, deliberately not folded together:
   *
   * - WRONG PORTAL — a Cleaner on an admin path. Compared against the AREA, not against
   *   `AREA_ROLES[area] === role`, because four roles legitimately live in `/admin`:
   *   Admin, ReadOnly, and the two narrow ones. `isAdminArea` is already that set.
   * - WRONG SCREEN — a narrow role inside `/admin` but on a screen outside its list.
   *   ⚠️ NOT a security decision: `backend/src/middleware/authorise.ts` refuses the data
   *   either way. This only avoids handing somebody a page whose only possible answer is
   *   a permission error — the same reason `narrowRoleHome` exists at all.
   */
  const wrongPortal = area !== undefined && (isAdminArea ? area !== '/admin' : AREA_ROLES[area] !== role);
  const wrongScreen = area === '/admin' && isNarrowRole(role) && !narrowRoleMayOpen(role, location.pathname);

  /**
   * 🔴 ACHU-405 — `location.pathname !== home` IS THE FIX, and it guards a CLASS of bug
   * rather than the two roles that happened to trip it.
   *
   * This returns `<Navigate>` INSTEAD of `<Routes>`. So when the target equals the address
   * we are already on, the route tree never mounts and never gets a second chance: the
   * replace lands on the same path, the re-render reaches the same redirect, and `Navigate`
   * stays mounted in the same position so its effect does not re-fire. Not a loop that
   * eventually settles — a permanently blank page, `<body><div /></body>`.
   *
   * ⚠️ The previous condition compared `area !== home`, which asks the same question ONLY
   * when home is an area root. It is for Admin, ReadOnly, Cleaner and Customer — and it is
   * not for `FinanceOnly` and `HROnly`, whose home is one screen deeper (`narrowRoleHome`,
   * ACHU-357). Both therefore matched on EVERY `/admin` address including their own home,
   * and neither role could open a single page. It stayed invisible because ACHU-399 had the
   * frontend server 404 every deep admin path, so nobody ever reached one to see the blank
   * screen; fixing the server is what exposed it.
   *
   * Comparing the redirect TARGET against the current path — instead of reasoning about
   * which roles can collide — is what keeps a future role with a deep home safe.
   */
  if ((wrongPortal || wrongScreen) && location.pathname !== home) {
    return <Navigate to={home} replace />;
  }

  return (
    <Suspense fallback={<Spinner />}>
      {/* Sesiunea 29 (backlog 46): portal-level boundary. Keyed on the path so
          navigating away from a broken screen clears the error by itself —
          otherwise one bad page keeps showing the error card after the user has
          already clicked elsewhere, which reads as "the whole app is broken".
          Also covers a lazy-import failure (a chunk that 404s after a deploy). */}
      <ErrorBoundary label="routes" resetKey={location.pathname}>
      {/**
        * §48 (Sesiunea 148) — titlul tab-ului, dintr-un singur loc. ⚠️ ÎNĂUNTRU în Router (are
        * nevoie de `useLocation`) și înaintea rutelor, ca să se schimbe la fiecare navigare —
        * inclusiv pe cele care doar redirecționează.
        */}
      <DocumentTitle />
      <Routes>
        <Route path="/" element={<Navigate to={notifyTarget ?? home} replace />} />
        {/* ACHU-348: a read-only account uses the same layout and the same screens.
            The server is the boundary that refuses writes; the banner inside
            AdminLayout is what stops a viewer being surprised by a refusal. */}
        <Route path="/admin" element={isAdminArea ? <AdminLayout /> : <AccessDenied message="You do not have access to the Admin area." onLogout={handleLogout} />}>
          <Route index element={<Dashboard />} />
          <Route path="action-centre" element={<ActionCentrePage />} />
          {/* §43 (Sesiunea 144) — sarcinile de birou, lângă Action Centre în navigație. */}
          <Route path="tasks" element={<TasksPage />} />
          {/* §30 (Sesiunea 144) — re-curățeniile: cerere, hotărâre, vizită gratuită. */}
          <Route path="re-cleans" element={<ReCleansPage />} />
          <Route path="quality-checks" element={<QualityChecksPage />} />
          <Route path="quality-report" element={<QualityReportPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="cleaners" element={<CleanersPage />} />
          <Route path="users" element={<UserAccountsPage />} />
          <Route path="appearance" element={<AppearancePage />} />
          <Route path="financial-settings" element={<FinancialSettingsPage />} />
          <Route path="invoice-settings" element={<InvoiceSettingsPage />} />
          {/* §33 (Sesiunea 161) — hârtiile firmei. */}
          <Route path="company-documents" element={<CompanyDocumentsPage />} />
          <Route path="audit-history" element={<AuditHistoryPage />} />
          <Route path="quote-requests" element={<QuoteRequestPage />} />
          <Route path="price-calculator" element={<PriceCalculatorPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="invitations" element={<InvitationsPage />} />
        <Route path="customer-requests" element={<CustomerRequestsPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        {/* §34 (Sesiunea 160) — catalogul de stoc: substanțe, echipamente, consumabile. */}
        <Route path="inventory" element={<InventoryPage />} />
        {/* §35 (Sesiunea 160) — mașinile firmei. */}
        <Route path="vehicles" element={<VehiclesPage />} />
          <Route path="feedback" element={<CustomerFeedbackPage />} />
          <Route path="customer-report" element={<CustomerReportPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="backup" element={<BackupPage />} />
          <Route path="data-breach" element={<DataBreachPage />} />
          <Route path="data-breach-register" element={<DataBreachRegister />} />
          <Route path="data-sharing" element={<DataSharingRegister />} />
          <Route path="waiting" element={<WaitingPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="dispatch" element={<DispatchSheetPage />} />
          <Route path="recurring" element={<RecurringSeriesPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="payroll-simulator" element={<PayrollSimulatorPage />} />
          <Route path="payroll-people" element={<PayrollPeoplePage />} />
          <Route path="payroll-runs" element={<PayrollRunsPage />} />
          <Route path="payroll-reports" element={<PayrollReportPage />} />
          <Route path="timesheets" element={<TimesheetsPage />} />
          <Route path="leave" element={<LeavePage />} />
          <Route path="sickness" element={<SicknessPage />} />
          <Route path="family-leave" element={<FamilyLeavePage />} />
          <Route path="error-log" element={<ErrorLogPage />} />
          <Route path="time-variance" element={<TimeVariancePage />} />
          <Route path="schedule-accuracy" element={<ScheduleAccuracyPage />} />
          <Route path="quote-funnel" element={<QuoteFunnelPage />} />
          <Route path="expense-report" element={<ExpenseReportPage />} />
          <Route path="monthly-summary" element={<MonthlySummaryPage />} />
          <Route path="duplicates" element={<DuplicatesPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="payment-report" element={<PaymentReportPage />} />
          <Route path="problem-report" element={<ProblemReportPage />} />
          <Route path="jobs-report" element={<JobsReportPage />} />
          <Route path="profitability" element={<ProfitabilityPage />} />
          <Route path="aged-receivables" element={<AgedReceivablesPage />} />
          <Route path="notifications-setup" element={<PushSetupPage />} />
          {/* ACHU-266. Unknown Admin sub-path: render INSIDE the layout so the
              menu stays usable — a wrong address should cost a click, not a trip
              back through the front door. Without this, React Router matches
              nothing at all (a parent with children does not match a longer
              pathname on its own) and renders `null`: a blank white page, no
              error thrown, so ErrorBoundary never sees it and the error log
              never hears about it. */}
          <Route path="*" element={<NotFound variant="inline" />} />
        </Route>
        <Route path="/cleaner" element={role === 'Cleaner' ? <CleanerApp /> : <AccessDenied message="You do not have access to the Cleaner area." onLogout={handleLogout} />} />
        <Route path="/customer" element={role === 'Customer' ? <CustomerApp /> : <AccessDenied message="You do not have access to the Customer area." onLogout={handleLogout} />} />
        {/* ACHU-142: reachable by any authenticated + active role — accepting
            an invitation upgrades whatever account they already have. */}
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        {/* ACHU-266. Last resort for any address outside the portals above.
            NOT lazy-loaded, deliberately: the failure this screen exists to
            explain is often "an old client cannot fetch the chunk it wants", and
            a fallback that must itself be fetched can fail for the same reason.
            The last line of defence must not depend on what it is defending. */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </ErrorBoundary>
    </Suspense>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
}
