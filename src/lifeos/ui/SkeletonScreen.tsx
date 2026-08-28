import type { LifeOSScreen } from './screenRegistry';

type SkeletonScreenProps = {
  screen: LifeOSScreen;
  onNavigate: (id: string) => void;
};

const contextualLinks: Record<string, { label: string; target: string }[]> = {
  today: [
    { label: 'Open My Tasks', target: 'myTasks' },
    { label: 'Open Calendar', target: 'calendar' },
    { label: 'Process Inbox', target: 'inbox' },
  ],
  areas: [
    { label: 'Goals', target: 'goals' },
    { label: 'Projects', target: 'projects' },
    { label: 'Analytics', target: 'analytics' },
  ],
  goals: [
    { label: 'Projects', target: 'projects' },
    { label: 'Habits', target: 'habits' },
    { label: 'Tasks', target: 'tasks' },
  ],
  projects: [
    { label: 'Milestones', target: 'milestones' },
    { label: 'Tasks', target: 'tasks' },
    { label: 'Files', target: 'files' },
  ],
  finance: [
    { label: 'Calendar', target: 'calendar' },
    { label: 'Goals', target: 'goals' },
    { label: 'Analytics', target: 'analytics' },
  ],
  weeklyReview: [
    { label: 'Inbox', target: 'inbox' },
    { label: 'Projects', target: 'projects' },
    { label: 'Goals', target: 'goals' },
  ],
};

export function SkeletonScreen({ screen, onNavigate }: SkeletonScreenProps) {
  const links = contextualLinks[screen.id] ?? [];

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{screen.group}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{screen.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{screen.description}</p>
          </div>
          <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
            + Create
          </button>
        </div>
      </div>

      {screen.sections?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {screen.sections.map((section) => (
            <article key={section} className="min-h-36 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">{section}</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">Skeleton</span>
              </div>
              <div className="mt-5 space-y-2">
                <div className="h-2.5 w-4/5 rounded-full bg-slate-100" />
                <div className="h-2.5 w-3/5 rounded-full bg-slate-100" />
                <div className="h-2.5 w-2/5 rounded-full bg-slate-100" />
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {links.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Connected modules</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {links.map((link) => (
              <button
                key={link.target}
                onClick={() => onNavigate(link.target)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
