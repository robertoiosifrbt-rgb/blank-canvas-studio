import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Briefcase, CreditCard, Receipt, Menu, X, Sparkles, UserCog, Settings, LogOut, ClipboardList, History } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from 'zite-auth-sdk';
import GlobalSearch from './GlobalSearch';
import { BrandLogo } from '../shared/BrandLogo';


const links = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/action-centre', icon: ClipboardList, label: 'Action Centre' },
  { to: '/admin/customers', icon: Users, label: 'Customers' },
  { to: '/admin/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/admin/payments', icon: CreditCard, label: 'Payments' },
  { to: '/admin/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/admin/cleaners', icon: Sparkles, label: 'Cleaners' },
  { to: '/admin/users', icon: UserCog, label: 'User Accounts' },
  { to: '/admin/financial-settings', icon: Settings, label: 'Financial Settings' },
  { to: '/admin/audit-history', icon: History, label: 'Audit History' },
];

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

  const navContent = (onClick?: () => void) => (
    <nav className="flex-1 p-2 space-y-1">
      {links.map(l => (
        <NavLink key={l.to} to={l.to} end={'end' in l ? l.end : undefined} onClick={onClick} className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`
        }>
          <l.icon className="h-4 w-4" />{l.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden md:flex flex-col w-60 border-r border-border bg-card">
        <div className="p-4 border-b border-border">
          <BrandLogo subtitle="Admin" />
        </div>
        {navContent()}
        <div className="p-2 border-t border-border">
          <button onClick={() => logout()} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground w-full">
            <LogOut className="h-4 w-4" />Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <BrandLogo subtitle="Admin" compact />
          <button onClick={() => setOpen(!open)} className="p-2"><Menu className="h-5 w-5" /></button>
        </header>

        {open && (
          <div className="md:hidden fixed inset-0 z-50 bg-background/80" onClick={() => setOpen(false)}>
            <div className="w-64 h-full bg-card border-r border-border p-4 flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <BrandLogo compact />
                <button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
              </div>
              {navContent(() => setOpen(false))}
              <button onClick={() => logout()} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted mt-2">
                <LogOut className="h-4 w-4" />Sign Out
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 border-b border-border bg-card"><GlobalSearch /></div>
          <div className="p-4 md:p-6"><Outlet /></div>
        </div>
      </div>
    </div>

  );
}
