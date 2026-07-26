import { useEffect, useState, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from 'zite-auth-sdk';
import { Toaster } from '@/components/ui/sonner';
import { RoleProvider, useRole } from './components/RoleProvider';
import AccessDenied from './components/AccessDenied';
import AdminLayout from './components/admin/AdminLayout';
import Dashboard from './components/admin/Dashboard';
import CustomersPage from './components/admin/CustomersPage';
import JobsPage from './components/admin/JobsPage';
import PaymentsPage from './components/admin/PaymentsPage';
import ExpensesPage from './components/admin/ExpensesPage';
import CleanersPage from './components/admin/CleanersPage';
import UserAccountsPage from './components/admin/UserAccountsPage';
import FinancialSettingsPage from './components/admin/FinancialSettingsPage';
import ActionCentrePage from './components/admin/ActionCentrePage';
import { AuditHistoryPage } from './components/admin/AuditHistory';
import QuoteRequestPage from './components/admin/QuoteRequestPage';
import CleanerApp from './components/cleaner/CleanerApp';
import CustomerApp from './components/customer/CustomerApp';
import { Button } from '@/components/ui/button';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

const AUTH_TIMEOUT_MS = 9000;

function useOnlineStatus() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export default function App() {
  const { user, isLoading, loginWithRedirect } = useAuth();
  const online = useOnlineStatus();
  const redirectAttempted = useRef(false);
  const [authTimedOut, setAuthTimedOut] = useState(false);

  // Bounded auth-loading timeout
  useEffect(() => {
    if (!isLoading) { setAuthTimedOut(false); return; }
    const timer = setTimeout(() => setAuthTimedOut(true), AUTH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Reset redirect guard on meaningful state changes
  useEffect(() => {
    if (user) redirectAttempted.current = false;
  }, [user]);

  // Redirect to login only when: not loading, no user, online, not already attempted
  useEffect(() => {
    if (isLoading && !authTimedOut) return;
    if (user) return;
    if (!online) return;
    if (redirectAttempted.current) return;
    redirectAttempted.current = true;
    loginWithRedirect({ redirectUrl: window.location.href });
  }, [isLoading, user, online, authTimedOut, loginWithRedirect]);

  // Auth timed out or finished loading with no user
  if ((authTimedOut || !isLoading) && !user) {
    if (!online) {
      return <OfflineAuthScreen onRetry={() => { redirectAttempted.current = false; window.location.reload(); }} />;
    }
    // Online but no user and redirect was attempted — show error after timeout
    if (authTimedOut) {
      return <AuthErrorScreen onRetry={() => { redirectAttempted.current = false; window.location.reload(); }} />;
    }
    // Redirect in progress — show spinner briefly (redirect will navigate away)
    return <Spinner />;
  }

  if (isLoading || !user) return <Spinner />;

  return (
    <BrowserRouter>
      <Toaster />
      <RoleProvider>
        <AppRoutes />
      </RoleProvider>
    </BrowserRouter>
  );
}

function AppRoutes() {
  const { role, active, loading, configError } = useRole();
  const { logout } = useAuth();
  const online = useOnlineStatus();

  const handleLogout = useCallback(() => {
    if (!navigator.onLine) return; // Will be handled by portal-level offline logout
    logout();
  }, [logout]);

  if (loading) return <Spinner />;

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

  const home = role === 'Admin' ? '/admin' : role === 'Cleaner' ? '/cleaner' : '/customer';

  return (
    <Routes>
      <Route path="/" element={<Navigate to={home} replace />} />
      <Route path="/admin" element={role === 'Admin' ? <AdminLayout /> : <AccessDenied message="You do not have access to the Admin area." onLogout={handleLogout} />}>
        <Route index element={<Dashboard />} />
        <Route path="action-centre" element={<ActionCentrePage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="cleaners" element={<CleanersPage />} />
        <Route path="users" element={<UserAccountsPage />} />
        <Route path="financial-settings" element={<FinancialSettingsPage />} />
        <Route path="audit-history" element={<AuditHistoryPage />} />
        <Route path="quote-requests" element={<QuoteRequestPage />} />
      </Route>
      <Route path="/cleaner" element={role === 'Cleaner' ? <CleanerApp /> : <AccessDenied message="You do not have access to the Cleaner area." onLogout={handleLogout} />} />
      <Route path="/customer" element={role === 'Customer' ? <CustomerApp /> : <AccessDenied message="You do not have access to the Customer area." onLogout={handleLogout} />} />
    </Routes>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
}

function OfflineAuthScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-background">
      <WifiOff className="h-14 w-14 text-muted-foreground mb-4" />
      <h1 className="text-xl font-semibold">You are offline</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-xs">Sign-in and sign-out require an internet connection. Please reconnect and try again.</p>
      <Button className="mt-6" onClick={onRetry}><RefreshCw className="h-4 w-4 mr-2" />Retry</Button>
    </div>
  );
}

function AuthErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-background">
      <AlertCircle className="h-14 w-14 text-destructive/70 mb-4" />
      <h1 className="text-xl font-semibold">Authentication timed out</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-xs">We could not complete sign-in. Please check your connection and try again.</p>
      <Button className="mt-6" onClick={onRetry}><RefreshCw className="h-4 w-4 mr-2" />Retry</Button>
    </div>
  );
}
