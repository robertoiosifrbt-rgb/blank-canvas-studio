import { Button } from '@/components/ui/button';
import { LogOut, Loader2, RefreshCw } from 'lucide-react';
import NotificationBell from '../shared/NotificationBell';

export default function PortalHeader({ userName, onLogout, loggingOut, onRefresh, refreshing }: { userName: string; onLogout: () => void; loggingOut?: boolean; onRefresh?: () => void; refreshing?: boolean }) {
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
          {/* ACHU-428 (Sesiunea 94). The customer portal was the only one of the
              three without a bell, and the consequence was not "no new feature":
              notifications addressed to customers were ALREADY being written and
              had never been seen by anyone. `customerRequests.ts` has told the
              customer their request was answered since Sesiunea 43, into a
              surface that did not exist. Adding the bell is what makes that
              notice — and the new quote one — reach a person. */}
          <NotificationBell
            homePath="/customer"
            // The only portal this account can open. Anything addressed
            // elsewhere (there should be nothing) falls back to home rather than
            // navigating to a route that renders Access Denied.
            resolvePath={(p) => (p.startsWith('/customer') ? p : null)}
          />
          {onRefresh && (
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={refreshing} className="h-8 w-8" aria-label="Refresh" title="Refresh">
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

