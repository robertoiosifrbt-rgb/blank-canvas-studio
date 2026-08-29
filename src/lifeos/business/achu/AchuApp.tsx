import { useMemo, useState } from 'react';
import { ArrowLeft, Bell, CalendarClock, ChevronRight, Menu, Plus, Search, X } from 'lucide-react';
import { achuGroups, achuSections } from './achuNavigation';

type AchuAppProps = { onBack: () => void };

export function AchuApp({ onBack }: AchuAppProps) {
  const [current, setCurrent] = useState('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const section = achuSections.find((item) => item.id === current) ?? achuSections[0];
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? achuSections.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(term)) : achuSections;
  }, [query]);

  const open = (id: string) => { setCurrent(id); setMenuOpen(false); };

  return (
    <div className="-m-3 min-h-[calc(100vh-9rem)] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:-m-6 lg:-m-8 lg:rounded-none lg:border-0">
      <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
        <button onClick={() => setMenuOpen((value) => !value)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 xl:hidden" aria-label="ACHU navigation">
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
          <ArrowLeft size={18} /><span className="hidden sm:inline">Business</span>
        </button>
        <span className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">A</span>
          <div><p className="text-sm font-bold leading-tight text-slate-900">ACHU</p><p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Business OS</p></div>
        </div>
        <button className="ml-auto rounded-xl p-2 text-slate-500 hover:bg-slate-100"><Bell size={19} /></button>
      </header>

      <div className="flex min-h-[calc(100vh-13rem)]">
        <aside className={`${menuOpen ? 'fixed inset-y-0 left-0 z-[70] block pt-16 shadow-2xl' : 'hidden'} w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4 xl:block`}>
          <div className="relative mb-5">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ACHU" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
          </div>
          <nav className="space-y-5">
            {achuGroups.map((group) => {
              const items = filtered.filter((item) => item.group === group);
              if (!items.length) return null;
              return <div key={group}>
                <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.17em] text-slate-400">{group}</p>
                <div className="space-y-0.5">{items.map((item) => {
                  const Icon = item.icon;
                  return <button key={item.id} onClick={() => open(item.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${current === item.id ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>
                    <Icon size={17} /><span className="flex-1">{item.label}</span>{current === item.id && <ChevronRight size={14} />}
                  </button>;
                })}</div>
              </div>;
            })}
          </nav>
        </aside>

        {menuOpen && <button className="fixed inset-0 z-[60] bg-slate-950/20 xl:hidden" onClick={() => setMenuOpen(false)} aria-label="Close ACHU navigation" />}

        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {current === 'overview' ? <AchuOverview onOpen={open} /> : <EmptyModule section={section} />}
        </main>
      </div>
    </div>
  );
}

function AchuOverview({ onOpen }: { onOpen: (id: string) => void }) {
  const cards = [
    ['Customers', '0', 'customers'], ['Jobs today', '0', 'jobs'], ['Cleaners active', '0', 'cleaners'], ['Outstanding', '£0.00', 'invoices'],
  ];
  const shortcuts = achuSections.filter((item) => ['quotes', 'jobs', 'schedule', 'invoices', 'expenses', 'quality'].includes(item.id));
  return <section className="space-y-6">
    <div><p className="text-sm font-semibold text-emerald-600">ACHU LTD</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Business overview</h1><p className="mt-2 text-sm text-slate-500">Your ACHU workspace is ready. No business data has been added.</p></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, value, target]) => <button key={label} onClick={() => onOpen(target)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></button>)}</div>
    <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Today</h2><div className="grid min-h-52 place-items-center text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400"><CalendarClock size={21} /></span><p className="mt-3 font-semibold text-slate-700">No visits scheduled</p><p className="mt-1 text-sm text-slate-500">Scheduled jobs will appear here.</p></div></div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Quick actions</h2><div className="mt-4 grid gap-2">{shortcuts.map((item) => <button key={item.id} onClick={() => onOpen(item.id)} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"><Plus size={16} className="text-emerald-600" />{item.actions?.[0] ?? item.label}</button>)}</div></div>
    </div>
  </section>;
}

function EmptyModule({ section }: { section: (typeof achuSections)[number] }) {
  const Icon = section.icon;
  return <section className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-600">{section.group}</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{section.label}</h1><p className="mt-2 text-sm text-slate-500">{section.description}</p></div>{section.actions?.[0] && <button className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"><Plus size={17} />{section.actions[0]}</button>}</div>
    <div className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><div className="max-w-sm"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Icon size={28} /></span><h2 className="mt-5 text-lg font-bold text-slate-900">No {section.label.toLowerCase()} yet</h2><p className="mt-2 text-sm leading-6 text-slate-500">This ACHU module is ready. Data you create here will belong to the independent Life OS version.</p>{section.actions?.[0] && <button className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-emerald-300 hover:bg-emerald-50">{section.actions[0]}</button>}</div></div>
  </section>;
}
