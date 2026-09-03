import { Lock } from 'lucide-react';

export function StatusBadge({ status, version }: { status: string; version: number }) {
  const tone =
    status === 'Locked' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
      : status === 'Approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100'
        : 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100';
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${tone}`}>
      {status === 'Locked' && <Lock className="h-3 w-3" />}
      {status}
      {/* Version is only interesting once it is not 1: it means the period was
          reopened after somebody had already agreed or paid it. */}
      {version > 1 && <span className="opacity-70">v{version}</span>}
    </span>
  );
}

