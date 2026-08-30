import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, Eye } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRole } from '../RoleProvider';
import { useAuth } from '@/lib/useAuth';
import GlobalSearch from './GlobalSearch';
import ErrorBoundary from '../shared/ErrorBoundary';
import NotificationBell from '../shared/NotificationBell';
import HelpPanel from '../shared/HelpPanel';
import Breadcrumbs from './Breadcrumbs';
import ChatBadge from '../shared/ChatBadge';
import { BrandLogo } from '../shared/BrandLogo';
// §48 (Sesiunea 148) — meniul e o HARTĂ, într-un singur loc: și tab-ul browserului o citește.
import { navGroups } from '@/lib/adminNav';
import { isNarrowRole, narrowRoleMayOpen, NARROW_ROLE_LABELS, NARROW_ROLE_BANNERS } from '@/lib/roleScope';


export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  /**
   * 🔴 **§48 „Keyboard navigation / Focus management" (Sesiunea 148) — MENIUL DE TELEFON era
   * singurul panou din aplicație scris de mână.**
   *
   * ⚠️ Măsurat: cele 40 de dialoguri folosesc `components/ui/dialog` (Radix), care închide pe
   * Escape, ține focusul înăuntru și îl întoarce de unde a plecat. ⛔ Panoul de aici, nu: se
   * deschidea peste tot ecranul și se putea închide **doar cu mausul** — un `div` cu `onClick`, deci
   * pentru cine navighează din tastatură nu exista nicio ieșire.
   *
   * ✅ Escape îl închide. ⛔ Nu i-am pus capcană de focus scrisă de mână: aceea e a treia oară în
   * care s-ar rescrie ce face Radix, iar o capcană greșită e mai rea decât niciuna (te lasă blocat
   * în panou). 🔴 Mutarea lui pe `Dialog`/`Sheet` e o felie proprie, nu o rescriere pe furiș aici.
   */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const { logout } = useAuth();
  const location = useLocation();
  /** ACHU-348. `ReadOnly` shares this layout with Admin — see App.tsx for why. */
  const { role } = useRole();
  const isReadOnly = role === 'ReadOnly';

  /**
   * ACHU-357 (Sesiunea 83). The two narrow roles share the layout too, but not the
   * menu: a row they cannot open is a row that answers a click with a refusal.
   *
   * ⚠️ Groups that end up empty are dropped along with their heading. A "Money"
   * heading with nothing under it reads as a section that failed to load, which is
   * the impression this whole filter exists to avoid.
   */
  const visibleGroups = isNarrowRole(role)
    ? navGroups
      .map(group => ({ ...group, links: group.links.filter(l => narrowRoleMayOpen(role, l.to)) }))
      .filter(group => group.links.length > 0)
    : navGroups;

  const navContent = (onClick?: () => void) => (
    <nav className="flex-1 overflow-y-auto p-2 space-y-4">
      {isNarrowRole(role) && (
        /* Said out loud, because a five-row menu in an app that has forty rows looks
           broken rather than scoped. Names what the account IS for, not what it lacks. */
        <p className="px-3 py-2 text-[11px] leading-snug text-muted-foreground bg-muted/50 rounded-lg">
          <span className="font-semibold">{NARROW_ROLE_LABELS[role]}.</span>{' '}
          {NARROW_ROLE_BANNERS[role]}
        </p>
      )}
      {visibleGroups.map(group => (
        <div key={group.title} className="space-y-0.5">
          <p className={`px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider ${group.tint}`}>
            {group.title}
          </p>
          {group.links.map(l => (
            <NavLink key={l.to} to={l.to} end={'end' in l ? l.end : undefined} onClick={onClick} className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`
            }>
              {({ isActive }) => (
                <>
                  {/* The icon carries the group's colour while the row is idle,
                      and gives it up when the row is selected: a tinted icon on
                      the primary-coloured active row would fight with it, and
                      "where am I" has to win over "what section is this". */}
                  <l.icon className={`h-4 w-4 shrink-0 ${isActive ? '' : group.tint}`} />
                  {l.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
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
        {/*
          🆕 §22 (Sesiunea 158) — **butonul de meniu în STÂNGA**, cerut de Roberto pe 28/08/2026.
          ⚠️ Nu pentru ergonomie: pe un ecran de 6" ambele colțuri de sus sunt la fel de departe de
          police. 🔴 Pentru **consecvență** — pe desktop meniul e o bară în stânga, iar pe telefon
          butonul care o deschide stătea în partea opusă. ⛔ Iar `flex-row-reverse` ar fi făcut același
          lucru vizual **fără** să schimbe ordinea de tabulare, adică logoul ar fi primit focusul
          înaintea butonului pe care omul îl vede primul.
        */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <button
            onClick={() => setOpen(!open)}
            className="p-2 -ml-2"
            /**
             * ⚠️ **Numele rămâne „Menu", iar starea o spune `aria-expanded`** — tiparul standard
             * pentru un buton care deschide și închide același panou. ⛔ Prima variantă schimba
             * numele în „Close the menu" când era deschis, iar atunci **două** butoane din același
             * ecran (ăsta și X-ul din panou) se numeau identic — prins de propriul test, nu ghicit.
             */
            aria-label="Menu" title="Menu"
            aria-expanded={open}
          >
            <Menu className="h-5 w-5" />
          </button>
          <BrandLogo subtitle="Admin" compact />
          {/* ⚠️ Un al treilea element gol ține logoul CENTRAT între buton și marginea dreaptă —
              altfel `justify-between` cu două elemente l-ar fi lipit de dreapta. */}
          <span className="w-8" aria-hidden="true" />
        </header>

        {open && (
          <div className="md:hidden fixed inset-0 z-50 bg-background/80" onClick={() => setOpen(false)}>
            {/* ⚠️ `role="dialog"` + `aria-modal`: un cititor de ecran trebuie să afle că restul
                paginii e acoperit. ⛔ Fără ele anunța rândurile din spatele panoului. */}
            <div
              className="w-64 h-full bg-card border-r border-border p-4 flex flex-col"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Main menu"
            >
              <div className="flex justify-between items-center mb-4">
                <BrandLogo compact />
                <button onClick={() => setOpen(false)} aria-label="Close the menu" title="Close the menu"><X className="h-5 w-5" /></button>
              </div>
              {navContent(() => setOpen(false))}
              <button onClick={() => logout()} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted mt-2">
                <LogOut className="h-4 w-4" />Sign Out
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {/* Sesiunea 29 (backlog 46): GlobalSearch is boundaried separately so a
              failure in search does not take the page content with it, and
              vice versa. */}
          <div className="flex items-center gap-3 p-4 md:p-6 border-b border-border bg-card">
            <div className="min-w-0 flex-1">
              <ErrorBoundary label="global-search" variant="inline"><GlobalSearch /></ErrorBoundary>
            </div>
            {/* Sesiunea 29: boundaried on its own — a failure in the bell must
                not take out search or the page content beside it. */}
            {/* ACHU-252. Mounted once here rather than on each of the 24 screens:
                the panel looks its own topic up from the route, so adding help to
                a screen means editing one content file. Boundaried on its own for
                the same reason as the bell — help failing must not take out the
                page it is meant to explain. */}
            {/*
              🆕 §22 (Sesiunea 158) — **CHATUL a luat locul paletei**, cerut de Roberto pe 28/08.
              🔴 Numărul de iconițe rămâne același, dar una pe care omul o apasă o dată în viață
              (aspectul → mutat în Setup) e înlocuită cu una care îl **anunță**.
              ⚠️ Chatul era un rând de meniu, în grupul „Team" — deci pe telefon, ascuns sub hamburger,
              nu se vedea deloc că a scris cineva.
              ⛔ Mărginit separat, ca celelalte: o cădere în numărătoarea de mesaje nu are voie să ia
              cu ea căutarea sau clopoțelul.
            */}
            <ErrorBoundary label="chat-badge" variant="inline"><ChatBadge to="/admin/chat" /></ErrorBoundary>
            <ErrorBoundary label="help-panel" variant="inline"><HelpPanel /></ErrorBoundary>
            <ErrorBoundary label="notification-bell" variant="inline">
              {/* ACHU-233: the server sends role-relative targets like
                  `/chat?channel=…` because the Admin area and the cleaner portal
                  put the same screen in different places. Mapping it here means
                  the bell needs no knowledge of roles.

                  Every Admin screen lives under `/admin`, so the mapping is a
                  prefix — but guarded, because an older notification may already
                  carry an absolute `/admin/...` path and prefixing that would
                  produce `/admin/admin/...`, which routes nowhere. */}
              <NotificationBell
                homePath="/admin"
                resolvePath={p => (p.startsWith('/admin') ? p : `/admin${p}`)}
              />
            </ErrorBoundary>
          </div>
          {/* Innermost boundary: a crash in one admin page leaves the sidebar and
              search usable, so the user can simply click somewhere else instead
              of being shown a full-screen error over a working app. Keyed on the
              path so that click clears it. */}
          <div className="p-4 md:p-6">
            {/* §48 „Breadcrumbs / Back navigation" (Sesiunea 149) — 🔴 DEASUPRA conținutului, nu
                lângă meniu: pe telefon meniul nu se vede deloc, iar cele două ecrane fără rând de
                meniu (registrul breșelor, foaia de drum) n-aprind nimic în el nici pe desktop. ⚠️ Aici
                e și singurul drum înapoi al acelor două, ca link către părinte — nu `history.back()`,
                care duce de unde ai venit, adică poate dintr-un email sau dintr-un tab nou. */}
            <Breadcrumbs pathname={location.pathname} />
            {/* ─── Read-only banner (ACHU-348, Sesiunea 82) ─────────────────
                ⚠️ PERMANENT, on every admin page, and that is the point. The
                server is what refuses a write; this is what stops the refusal
                being a surprise. A viewer who sees a Save button, presses it and
                gets an error would reasonably report the app as broken — so the
                limit is stated BEFORE they try, not only after.

                ⚠️ It is NOT a substitute for the server guard and must never
                become one: hiding buttons is cosmetic, and anybody can call the
                API directly. This tells the truth about an account; the guard
                enforces it. */}
            {isReadOnly && (
              <div
                role="status"
                className="mb-4 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950"
              >
                <Eye className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <strong>Read-only access.</strong> You can open every screen here and download reports, but
                  nothing you change will save — including the payroll simulator, which is blocked as well because
                  the rule is about the kind of action rather than a list of exceptions. Ask an Admin to make a change.
                </span>
              </div>
            )}
            <ErrorBoundary label="admin-content" variant="inline" resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}

