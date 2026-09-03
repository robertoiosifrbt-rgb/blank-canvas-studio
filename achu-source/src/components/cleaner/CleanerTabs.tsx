import { CalendarDays, Clock, History, MessageSquare, Wallet } from 'lucide-react';

/**
 * Sesiunea 29 — a fourth tab, Chat, added so the field staff are part of the
 * internal chat (owner decision: participants are office + cleaners).
 *
 * The label is hidden on very narrow screens for this tab set: four labelled
 * tabs no longer fit side by side on a small phone, and a squashed row of
 * truncated words is worse than icons with the active one named.
 *
 * Sesiunea 80 — a fifth tab, Pay (ACHU-314, backlog payroll §22). The
 * label-hiding above is what makes a fifth tab fit at all: five icons in a row
 * are comfortable on a phone, five words are not.
 *
 * ⚠️ Pay is deliberately LAST. The first four are what someone opens the app
 * to do during a shift; Pay is checked occasionally, and putting it earlier
 * would push the day's work along the row every time.
 */
type Tab = 'today' | 'upcoming' | 'history' | 'chat' | 'pay';

export default function CleanerTabs({
  active,
  onChange,
  counts,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  /** Pay has no count — a badge on it would imply something is waiting, and nothing is. */
  counts?: { today: number; upcoming: number; history: number; chat?: number; pay?: undefined };
}) {
  const tabs: { key: Tab; label: string; icon: typeof Clock }[] = [
    { key: 'today', label: 'Today', icon: Clock },
    { key: 'upcoming', label: 'Upcoming', icon: CalendarDays },
    { key: 'history', label: 'History', icon: History },
    { key: 'chat', label: 'Chat', icon: MessageSquare },
    { key: 'pay', label: 'Pay', icon: Wallet },
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
              <Icon className="h-4 w-4 shrink-0" />
              <span className={isActive ? '' : 'hidden xs:inline sm:inline'}>{t.label}</span>
              {count !== undefined && count > 0 && (
                <span className={`ml-0.5 text-xs rounded-full px-1.5 py-0.5 font-semibold tabular-nums ${
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

