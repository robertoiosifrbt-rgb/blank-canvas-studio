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
import { sealFormDrafts, resolveSealedDrafts } from './lib/draftSeal';
import AcceptInvitePage from './components/AcceptInvitePage';
import CompleteProfilePage from './components/CompleteProfilePage';
import PublicQuoteRequestPage from './components/public/PublicQuoteRequestPage';
const QUOTE_HOSTNAME = 'quote.achu.uk';
import ErrorBoundary from './components/shared/ErrorBoundary';
import NotFound from './components/shared/NotFound';
import DocumentTitle from './components/shared/DocumentTitle';
import { isNarrowRole, narrowRoleHome, narrowRoleMayOpen } from './lib/roleScope';

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
const AppearancePage = lazy(() => import('./components/admin/AppearancePage'));
const ActionCentrePage = lazy(() => import('./components/admin/ActionCentrePage'));
const TasksPage = lazy(() => import('./components/admin/TasksPage'));
const ReCleansPage = lazy(() => import('./components/admin/ReCleansPage'));
const QualityChecksPage = lazy(() => import('./components/admin/QualityChecksPage'));
const QualityReportPage = lazy(() => import('./components/admin/QualityReportPage'));
const AuditHistoryPage = lazy(() => import('./components/admin/AuditHistory').then(m => ({ default: m.AuditHistoryPage })));
const QuoteRequestPage = lazy(() => import('./components/admin/QuoteRequestPage'));
const PriceCalculatorPage = lazy(() => import('./components/admin/PriceCalculatorPage'));
const ServicesPage = lazy(() => import('./components/admin/ServicesPage'));
const InvitationsPage = lazy(() => import('./components/admin/InvitationsPage'));
const CompanyDocumentsPage = lazy(() => import('./components/admin/CompanyDocumentsPage'));
const CustomerRequestsPage = lazy(() => import('./components/admin/CustomerRequestsPage'));
const IncidentsPage = lazy(() => import('./components/admin/IncidentsPage'));
const InventoryPage = lazy(() => import('./components/admin/InventoryPage'));
const VehiclesPage = lazy(() => import('./components/admin/VehiclesPage'));
const CustomerFeedbackPage = lazy(() => import('./components/admin/CustomerFeedbackPage'));
const CustomerReportPage = lazy(() => import('./components/admin/CustomerReportPage'));
const ChatPage = lazy(() => import('./components/admin/ChatPage'));
const BackupPage = lazy(() => import('./components/admin/BackupPage'));
const DataBreachPage = lazy(() => import('./components/admin/DataBreachPage'));
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
const ScheduleAccuracyPage = lazy(() => import('./components/admin/ScheduleAccuracyPage'));
const QuoteFunnelPage = lazy(() => import('./components/admin/QuoteFunnelPage'));
const ExpenseReportPage = lazy(() => import('./components/admin/ExpenseReportPage'));
const MonthlySummaryPage = lazy(() => import('./components/admin/MonthlySummaryPage'));
const DuplicatesPage = lazy(() => import('./components/admin/DuplicatesPage'));
const TeamsPage = lazy(() => import('./components/admin/TeamsPage'));
const PaymentReportPage = lazy(() => import('./components/admin/PaymentReportPage'));
const ProblemReportPage = lazy(() => import('./components/admin/ProblemReportPage'));
const JobsReportPage = lazy(() => import('./components/admin/JobsReportPage'));
const ProfitabilityPage = lazy(() => import('./components/admin/ProfitabilityPage'));
const AgedReceivablesPage = lazy(() => import('./components/admin/AgedReceivablesPage'));
const PushSetupPage = lazy(() => import('./components/admin/PushSetupPage'));
const CleanerApp = lazy(() => import('./components/cleaner/CleanerApp'));
const CustomerApp = lazy(() => import('./components/customer/CustomerApp'));

export default function App() {
  const lifeOSCopy = new URLSearchParams(window.location.search).get('lifeos') === '1';
  const { user, isLoading, logout } = useAuth();
  const hadUserRef = useRef(false);
  const loggedOutRef = useRef(false);
  const emailRef = useRef<string | null>(null);

  useEffect(() => { emailRef.current = user?.email ?? null; }, [user]);
  useEffect(() => {
    if (lifeOSCopy) return;
    onSessionGone(() => { sealFormDrafts(emailRef.current); logout(); });
    return () => onSessionGone(null);
  }, [lifeOSCopy, logout]);
  useEffect(() => {
    if (lifeOSCopy) return;
    if (user) {
      resolveSealedDrafts(user.email);
      if (loggedOutRef.current) {
        loggedOutRef.current = false;
        if (window.location.pathname !== '/') { window.location.replace('/'); return; }
      }
      hadUserRef.current = true;
    } else if (hadUserRef.current) loggedOutRef.current = true;
  }, [lifeOSCopy, user]);

  const { stale } = useVersionCheck();
  useEffect(() => {
    if (lifeOSCopy || !stale) return;
    toast('A new version of ACHU is available.', { duration: Infinity, action: { label: 'Reload', onClick: () => window.location.reload() } });
  }, [lifeOSCopy, stale]);

  if (window.location.hostname === QUOTE_HOSTNAME || window.location.pathname.replace(/\/$/, '') === '/request-quote') {
    return <PublicQuoteRequestPage />;
  }

  if (!lifeOSCopy && isLoading) return <Spinner />;
  if (!lifeOSCopy && !user) return <LoginPage />;

  return (
    <BrowserRouter basename={lifeOSCopy ? '/achu-copy' : undefined}>
      <Toaster />
      <ErrorBoundary label="app-root">
        <RoleProvider><AppRoutes /></RoleProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

function AppRoutes() {
  const { role, active, loading, configError, firstName, lastName } = useRole();
  const { logout } = useAuth();
  const location = useLocation();
  const handleLogout = useCallback(() => { if (navigator.onLine) logout(); }, [logout]);
  if (loading) return <Spinner />;
  if (location.pathname === '/accept-invite') return <AcceptInvitePage />;
  if (configError) return <AccessDenied message={configError} onLogout={handleLogout} />;
  if (!role || !active) return <AccessDenied message={!active && role ? 'Your account has been deactivated. Please contact an administrator.' : 'Your account is being set up. Please try again shortly.'} onLogout={handleLogout} />;
  if (!firstName || !lastName) return <CompleteProfilePage />;

  const isAdminArea = role === 'SuperAdmin' || role === 'Admin' || role === 'ReadOnly' || isNarrowRole(role);
  const home = isNarrowRole(role) ? narrowRoleHome(role) : isAdminArea ? '/admin' : role === 'Cleaner' ? '/cleaner' : '/customer';
  const notifyTarget = (() => {
    const raw = new URLSearchParams(location.search).get('notify');
    if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw === '/') return null;
    if (isAdminArea) return raw.startsWith('/admin') ? raw : `/admin${raw}`;
    if (role === 'Cleaner') {
      const chat = raw.match(/^\/chat(?:\?channel=(.+))?$/);
      return chat ? `/cleaner?tab=chat${chat[1] ? `&channel=${chat[1]}` : ''}` : null;
    }
    return null;
  })();

  if (location.pathname === '/') return <Navigate to={notifyTarget || home} replace />;
  if (location.pathname.startsWith('/admin') && !isAdminArea) return <Navigate to={home} replace />;
  if (location.pathname.startsWith('/cleaner') && role !== 'Cleaner') return <Navigate to={home} replace />;
  if (location.pathname.startsWith('/customer') && role !== 'Customer') return <Navigate to={home} replace />;
  if (isNarrowRole(role) && location.pathname.startsWith('/admin') && !narrowRoleMayOpen(role, location.pathname)) return <Navigate to={home} replace />;

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="cleaners" element={<CleanersPage />} />
          <Route path="users" element={<UserAccountsPage />} />
          <Route path="financial-settings" element={<FinancialSettingsPage />} />
          <Route path="invoice-settings" element={<InvoiceSettingsPage />} />
          <Route path="appearance" element={<AppearancePage />} />
          <Route path="action-centre" element={<ActionCentrePage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="recleans" element={<ReCleansPage />} />
          <Route path="quality-checks" element={<QualityChecksPage />} />
          <Route path="quality-report" element={<QualityReportPage />} />
          <Route path="audit-history" element={<AuditHistoryPage />} />
          <Route path="quote-requests" element={<QuoteRequestPage />} />
          <Route path="price-calculator" element={<PriceCalculatorPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="invitations" element={<InvitationsPage />} />
          <Route path="company-documents" element={<CompanyDocumentsPage />} />
          <Route path="customer-requests" element={<CustomerRequestsPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="vehicles" element={<VehiclesPage />} />
          <Route path="customer-feedback" element={<CustomerFeedbackPage />} />
          <Route path="customer-report" element={<CustomerReportPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="backup" element={<BackupPage />} />
          <Route path="data-breach" element={<DataBreachPage />} />
          <Route path="data-breach-register" element={<DataBreachRegister />} />
          <Route path="data-sharing-register" element={<DataSharingRegister />} />
          <Route path="waiting" element={<WaitingPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="dispatch-sheet" element={<DispatchSheetPage />} />
          <Route path="recurring-series" element={<RecurringSeriesPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="payroll-simulator" element={<PayrollSimulatorPage />} />
          <Route path="payroll-people" element={<PayrollPeoplePage />} />
          <Route path="payroll-runs" element={<PayrollRunsPage />} />
          <Route path="payroll-report" element={<PayrollReportPage />} />
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
          <Route path="push-setup" element={<PushSetupPage />} />
        </Route>
        <Route path="/cleaner/*" element={<CleanerApp />} />
        <Route path="/customer/*" element={<CustomerApp />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <DocumentTitle />
    </Suspense>
  );
}

function Spinner() {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-700" /></div>;
}
