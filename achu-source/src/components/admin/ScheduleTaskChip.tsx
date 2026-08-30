/**
 * 🔴 §43 „Calendar display" (Sesiunea 150) — **CUM ARATĂ O SARCINĂ DE BIROU PE CALENDAR.**
 *
 * ⛔ **Fișier propriu, și nu din stil:** `SchedulePage.tsx` e la clichetul lui de mărime, iar regula
 * spune ce se face atunci — iese cod, cifra nu urcă (`AGENT_RULES` §7, ACHU-571).
 *
 * ⚠️ **Deliberat ALTFEL decât un card de vizită:** punctat, nu plin, cu o iconiță de bifă. ⛔ O sarcină
 * de birou nu e o vizită — cineva care le vede la fel ar căuta un curățător pentru „sună banca".
 *
 * ⚠️ **Nu e un buton**, spre deosebire de cardul vizitei: nu deschide nimic, fiindcă locul unde se
 * lucrează pe sarcini e ecranul lor. ⛔ Un card care arată apăsabil și nu face nimic e mai rău decât
 * unul care nu pare.
 */
import { CheckSquare } from 'lucide-react';
// ⚠️ Tipul și gruparea pe zile stau în `lib/scheduleGrouping.ts`: acolo nu e randare, deci se pot citi
// și verifica fără un ecran. Aici rămâne doar cum ARATĂ.
import type { ScheduleTask } from '@/lib/scheduleGrouping';

export default function ScheduleTaskChip({ task, compact = false }: { task: ScheduleTask; compact?: boolean }) {
  return (
    <div
      className={`rounded-md border border-dashed border-border bg-muted/30 px-2 ${compact ? 'py-0.5' : 'py-1'}`}
      title={task.assignedTo ? `Task for ${task.assignedTo}` : 'Task — nobody assigned yet'}
    >
      <p className={`flex items-center gap-1 truncate ${compact ? 'text-[10px]' : 'text-[11px]'} text-muted-foreground`}>
        <CheckSquare className={compact ? 'h-2.5 w-2.5 shrink-0' : 'h-3 w-3 shrink-0'} aria-hidden="true" />
        {/* ⚠️ „High" se marchează, restul nu: „Medium" pe fiecare rând ar fi tapet — aceeași regulă ca
            pe ecranul de sarcini. */}
        {task.priority === 'High' && <span className="text-amber-700 dark:text-amber-400">!</span>}
        <span className="truncate">{task.title}</span>
      </p>
    </div>
  );
}

/**
 * Sarcinile unei zile, cu plafonul lor.
 *
 * ⚠️ **Aici, nu în pagină, și motivul e măsurat:** cele trei grile (zi, săptămână, lună) ar fi scris
 * fiecare aceeași buclă plus același „+N", iar clichetul de mărime a oprit exact asta. ⛔ Trei copii
 * s-ar fi despărțit la primul plafon schimbat.
 *
 * ⚠️ `limit` există pentru grila lunii: o casetă de 76px cu șapte rânduri nu se citește. ⛔ Ce nu
 * încape se **numără**, nu se ascunde — o zi care arată două din nouă, fără să spună, e o minciună.
 */
export function ScheduleDayTasks({ tasks, limit, compact = false }: {
  tasks: ScheduleTask[];
  limit?: number;
  compact?: boolean;
}) {
  const shown = limit ? tasks.slice(0, limit) : tasks;
  const hidden = tasks.length - shown.length;
  return (
    <>
      {shown.map(t => <ScheduleTaskChip key={t.id} task={t} compact={compact} />)}
      {hidden > 0 && (
        <p className="text-[10px] text-muted-foreground">+{hidden} more task{hidden === 1 ? '' : 's'}</p>
      )}
    </>
  );
}

