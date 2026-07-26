import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from 'zite-auth-sdk';
import { getUserRole } from 'zite-endpoints-sdk';

type RoleData = { role: string | null; active: boolean; customerId: string | null; cleanerId: string | null; loading: boolean; configError: string | null };

const RoleContext = createContext<RoleData>({ role: null, active: false, customerId: null, cleanerId: null, loading: true, configError: null });

export const useRole = () => useContext(RoleContext);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<RoleData>({ role: null, active: false, customerId: null, cleanerId: null, loading: true, configError: null });

  useEffect(() => {
    if (!user) return;

    // ACHU-024: Differentiate error types instead of treating all failures the same
    getUserRole({})
      .then(r => {
        if (r.auditWarning) console.warn('[RoleProvider] Automatic repair audit warning:', r.auditWarning);
        setData({ ...r, configError: r.configError ?? null, loading: false });
      })
      .catch((err: any) => {
        const message = err?.message ?? '';
        const status = err?.status ?? err?.code ?? 0;

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
        setData({ role: null, active: false, customerId: null, cleanerId: null, loading: false, configError });
      });
  }, [user]);

  return <RoleContext.Provider value={data}>{children}</RoleContext.Provider>;
}
