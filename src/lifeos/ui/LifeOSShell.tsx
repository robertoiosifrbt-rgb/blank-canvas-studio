import { useMemo, useState, type ReactNode } from 'react';
import {
  CalendarDays,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { lifeOSGroups, lifeOSScreens } from './screenRegistry';

type LifeOSShellProps = {
  currentScreen: string;
  onNavigate: (id: string) => void;
  children: ReactNode;
};

const mobilePrimary = [
  { id: 'today', label: 'Today', icon: LayoutDashboard },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
];

const moreIds = new Set(['goals', 'habits', 'notes', 'people', 'finance', 'files', 'weeklyReview', 'monthlyReview', 'settings']);

export function LifeOSShell({ currentScreen, onNavigate, children }: LifeOSShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? lifeOSScreens.filter((screen) => `${screen.title} ${screen.description}`.toLowerCase().includes(term)) : lifeOSScreens;
  }, [query]);

  const go = (id: string) => {
    onNavigate(id);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 pb-20 lg:pb-0">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <button onClick={() => setMobileMenuOpen((value) => !value)} className="rounded-xl p-2 hover:bg-slate-100 lg:hidden" aria-label="Open navigation">
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <button onClick={() => go('today')} className="flex shrink-0 items-center gap-2 font-bold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white"><Sparkles size={18} /></span>
            <span className="hidden sm:inline">Life OS</span>
          </button>
          <button onClick={() => go('search')} className="ml-auto flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-500 sm:max-w-md">
            <Search size={17} />
            <span className="truncate">Search Life OS</span>
            <span className="ml-auto hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] sm:inline">⌘K</span>
          </button>
          <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">+ Create</button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4 lg:block">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter navigation" className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400" />
          </div>
          <nav className="space-y-5">
            {lifeOSGroups.map((group) => {
              const screens = filtered.filter((screen) => screen.group === group);
              if (!screens.length) return null;
              return (
                <div key={group}>
                  <p className="mb-1.5 px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{group}</p>
                  <div className="space-y-0.5">
                    {screens.map((screen) => (
                      <button key={screen.id} onClick={() => go(screen.id)} className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${currentScreen === screen.id ? 'bg-slate-950 font-semibold text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
                        {screen.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" onClick={() => setMobileMenuOpen(false)}>
            <aside className="h-full w-[86%] max-w-sm overflow-y-auto bg-white p-4 pt-20 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <nav className="space-y-5">
                {lifeOSGroups.map((group) => {
                  const screens = lifeOSScreens.filter((screen) => screen.group === group);
                  return (
                    <div key={group}>
                      <p className="mb-1.5 px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{group}</p>
                      <div className="space-y-0.5">
                        {screens.map((screen) => (
                          <button key={screen.id} onClick={() => go(screen.id)} className={`w-full rounded-lg px-3 py-2.5 text-left text-sm ${currentScreen === screen.id ? 'bg-slate-950 font-semibold text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
                            {screen.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 p-3 sm:p-6 lg:p-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-20 grid-cols-5 border-t border-slate-200 bg-white lg:hidden">
        {mobilePrimary.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => go(id)} className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${currentScreen === id ? 'text-slate-950' : 'text-slate-500'}`}>
            <Icon size={22} strokeWidth={currentScreen === id ? 2.5 : 2} />
            {label}
          </button>
        ))}
        <button onClick={() => setMobileMenuOpen(true)} className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${moreIds.has(currentScreen) ? 'text-slate-950' : 'text-slate-500'}`}>
          <MoreHorizontal size={22} />
          More
        </button>
      </nav>
    </div>
  );
}
