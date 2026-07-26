import { CalendarDays, Clock, History } from 'lucide-react';

type Tab = 'today' | 'upcoming' | 'history';

export default function CleanerTabs({
  active,
  onChange,
  counts,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  counts?: { today: number; upcoming: number; history: number };
}) {
  const tabs: { key: Tab; label: string; icon: typeof Clock }[] = [
    { key: 'today', label: 'Today', icon: Clock },
    { key: 'upcoming', label: 'Upcoming', icon: CalendarDays },
    { key: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="bg-card border-b border-border sticky top-[60px] z-10">
      <div className="max-w-lg mx-auto flex">
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = active === t.key;
          const count = counts?.[t.key];
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2 ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
              {count !== undefined && count > 0 && (
                <span className={`ml-0.5 text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                  isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
