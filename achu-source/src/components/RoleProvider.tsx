import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/useAuth';
import { getUserRole } from '@/lib/endpoints';
import { ApiError } from '@/lib/apiClient';

type RoleData = {
  role: string | null; active: boolean; customerId: string | null; cleanerId: string | null;
  loading: boolean; configError: string | null; firstName: string | null; lastName: string | null;
};

const EMPTY_ROLE_DATA: RoleData = { role: null, active: false, customerId: null, cleanerId: null, loading: true, configError: null, firstName: null, lastName: null };

const RoleContext = createContext<RoleData>(EMPTY_ROLE_DATA);

export const useRole = () => useContext(RoleContext);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const lifeOSCopy = new URLSearchParams(window.location.search).get('lifeos') === '1';
  const [data, setData] = useState<RoleData>(EMPTY_ROLE_DATA);
  const lastEmailRef = useRef<string | null>(null);

  useEffect(() => {
    if (lifeOSCopy) {
      setData({ role: 'SuperAdmin', active: true, customerId: null, cleanerId: null, loading: false, configError: null, firstName: 'ACHU', lastName: 'Admin' });
      return;
    }
    // ACHU-FU-001: explicitly clear the previous role's state on logout, rather
    // than relying only on this provider happening to unmount — the next
    // authenticated user must never briefly see (or be gated by) a stale role.
    if (!user) {
      lastEmailRef.current = null;
      setData(EMPTY_ROLE_DATA);
      return;
    }

    // Sesiunea 28: when the session swaps straight from one account to another
    // with no signed-out step in between (a session picked up from another
    // tab, for instance), this effect re-runs but `data` would keep serving
    // the PREVIOUS account's role until the request below resolves — long
    // enough to render the wrong portal and fire its requests. Drop back to
    // the loading state first so the gate in AppRoutes shows a spinner
    // instead of someone else's portal. Deliberately keyed on the email, not
    // on `user` identity: Supabase mints a fresh session object on every
    // token refresh, and resetting then would flash a spinner periodically.
    const switchedAccount = lastEmailRef.current !== null && lastEmailRef.current !== user.email;
    lastEmailRef.current = user.email;
    if (switchedAccount) setData(EMPTY_ROLE_DATA);

    // Guards against out-of-order responses: if the account changes again
    // while this request is still in flight, its late result must not
    // overwrite the newer account's role.
    const requestedFor = user.email;
    const isStale = () => lastEmailRef.current !== requestedFor;

    // ACHU-024: Differentiate error types instead of treating all failures the same
    getUserRole({})
      .then(r => {
        if (isStale()) return;
        if (r.auditWarning) console.warn('[RoleProvider] Automatic repair audit warning:', r.auditWarning);
        setData({ ...r, configError: r.configError ?? null, firstName: r.firstName ?? null, lastName: r.lastName ?? null, loading: false });
      })
      /**
       * ⚠️ ACHU-401 (felia 15) — `unknown`, plus îngustare la `ApiError`, care e chiar ce aruncă
       * `apiClient`. ⛔ Nu se pierde nimic: ramurile de mai jos citeau `status` și `code`, iar
       * acum tipul le garantează în loc să le presupună. O eroare care NU e de la client (o
       * excepție de randare, de pildă) cade pe ramura generică, unde îi e locul.
       */
      .catch((err: unknown) => {
        if (isStale()) return;
        const apiErr = err instanceof ApiError ? err : null;
        const message = err instanceof Error ? err.message : '';
        const status = apiErr?.status ?? apiErr?.code ?? 0;

        let configError: string;

        if (!navigator.onLine || message.includes('NetworkError') || message.includes('Failed to fetch') || message.includes('net::')) {
          // Network error — not an account issue
          configError = 'Network error: Unable to reach the server. Please check your internet connection and try again.';
        } else if (status === 401 || status === 403 || message.includes('FORBIDDEN') || message.includes('UNAUTHORIZED')) {
          // Auth/access error
          configError = 'Access denied: Your session may have expired. Please log out and log back in.';
        } else if (status === 500 || message.includes('INTERNAL_ERROR') || message.includes('Internal Server Error')) {
          // Backend failure
          configError = 'Server error: Something went wrong on our end. Please try again in a moment. If this persists, contact support.';
        } else if (message.includes('configuration') || message.includes('config') || message.includes('linked')) {
          // Configuration issue (from the backend configError responses)
          configError = `Account configuration issue: ${message}`;
        } else if (message) {
          // Other known error with a message
          configError = `Unable to load your account: ${message}`;
        } else {
          // Unknown error with no message
          configError = 'An unexpected error occurred while loading your account. Please try refreshing the page.';
        }

        console.error('[RoleProvider] getUserRole error:', { message, status, raw: err });
        setData({ role: null, active: false, customerId: null, cleanerId: null, loading: false, configError, firstName: null, lastName: null });
      });
  }, [lifeOSCopy, user]);

  return <RoleContext.Provider value={data}>{children}</RoleContext.Provider>;
}
