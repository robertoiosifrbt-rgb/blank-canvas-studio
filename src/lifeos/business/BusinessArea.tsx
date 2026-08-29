import { ArrowRight, Briefcase, Building2 } from 'lucide-react';

type BusinessAreaProps = { onOpenAchu: () => void };

export function BusinessArea({ onOpenAchu }: BusinessAreaProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-600 text-white"><Briefcase size={24} /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-500">Life Area</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Business</h1>
            <p className="mt-1 text-sm text-slate-500">Your companies and business systems.</p>
          </div>
        </div>
      </div>

      <button onClick={onOpenAchu} className="group w-full rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md sm:p-8">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white"><Building2 size={27} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-slate-900">ACHU</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Cleaning business operations, built directly inside Life OS.</p>
          </div>
          <ArrowRight className="shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-indigo-600" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {['Customers', 'Jobs', 'Workforce', 'Finance'].map((label) => (
            <span key={label} className="rounded-xl bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-600">{label}</span>
          ))}
        </div>
      </button>
    </section>
  );
}
