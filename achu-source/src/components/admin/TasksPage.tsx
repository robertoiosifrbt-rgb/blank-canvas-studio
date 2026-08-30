/**
 * §43 „Tasks și internal workflow" (Sesiunea 144) — LISTA DE SARCINI A BIROULUI.
 *
 * ─── 🔴 DE CE UN ECRAN NOU, ȘI NU UN BLOC ÎN ACTION CENTRE ──────────────────
 * Action Centre e în întregime **derivat**: arată ce spun DATELE că e în neregulă. Ăsta arată ce a
 * decis un **OM** că trebuie făcut. ⛔ Contopite, primul s-ar fi umplut de bilețele, iar al doilea
 * ar fi devenit o listă pe care nimeni nu o mai citește.
 *
 * ⚠️ **Trei file, un singur drum către server:** „ale mele", „ale echipei", „restante" sunt aceleași
 * rânduri privite altfel, deci filtrul e un parametru — nu trei rute care s-ar despărți la prima
 * corectură.
 *
 * ⚠️ **Restanța NU se calculează aici.** Vine ca `overdue` de pe server, fiindcă „azi" înseamnă azi
 * în Regatul Unit — un browser deschis în alt fus ar fi colorat altfel aceeași listă.
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ListTodo, AlertTriangle, RotateCcw, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getTasks, updateTask, type TaskRecord, type TaskListResponse } from '@/lib/taskEndpoints';
/**
 * ⚠️ **Hook-ul propriu al proiectului, nu o buclă scrisă de mână.** El aduce termen de expirare,
 * „ultima cerere câștigă", păstrarea datelor la eșec și reîncercarea — patru lucruri pe care
 * fiecare ecran le-a rescris până a existat el.
 */
import { useTrackedRequest } from '@/lib/useTrackedRequest';
import { errMsg } from '@/lib/errorMessage';
import TaskComposer from './TaskComposer';

const VIEWS = [
  { key: 'open', label: 'All open' },
  { key: 'mine', label: 'Mine' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'done', label: 'Done' },
] as const;

export default function TasksPage() {
  const [view, setView] = useState<string>('open');
  const req = useTrackedRequest<TaskListResponse>({ timeoutMs: 20000 });

  const { fire } = req;
  const load = useCallback(() => { fire(() => getTasks({ view })); }, [fire, view]);
  useEffect(() => { load(); }, [load]);

  const data = req.data;
  const loading = req.loading;
  const error = req.error;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ListTodo className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Tasks
        </h2>
        <TaskComposer onCreated={load} />
      </div>

      {/* 🔴 Propoziția care spune ce e ecranul ăsta ȘI ce nu e. ⚠️ Fără ea, cineva ar aștepta aici
          restanțele de plată — acelea sunt pe Action Centre, derivate din date. */}
      <p className="text-xs text-muted-foreground">
        What somebody decided needs doing. Things the data already tells us — unpaid jobs, unanswered
        requests — are on <strong>Action Centre</strong>, not here.
      </p>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Which tasks to show">
        {VIEWS.map(v => (
          <button
            key={v.key}
            type="button"
            aria-pressed={view === v.key}
            onClick={() => setView(v.key)}
            className={`min-h-[36px] rounded-full border px-3 text-xs ${
              view === v.key ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground'
            }`}
          >
            {v.label}
            {/* ⚠️ Cifra vine de pe server. `overdue` e cea care merită văzută fără să deschizi fila. */}
            {data && v.key === 'mine' && data.counts.mine > 0 && ` · ${data.counts.mine}`}
            {data && v.key === 'overdue' && data.counts.overdue > 0 && ` · ${data.counts.overdue}`}
            {data && v.key === 'open' && data.counts.open > 0 && ` · ${data.counts.open}`}
          </button>
        ))}
      </div>

      {loading && !data && <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3">
          <p className="flex-1 text-sm text-destructive">Could not load the tasks.</p>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </div>
      )}

      {/* ⛔ Lista goală SPUNE ceva, nu tace: un ecran gol arată ca unul care nu s-a încărcat. */}
      {data && data.records.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">
          {view === 'done' ? 'Nothing has been ticked off yet.' : 'Nothing on this list. Add one above when something comes up.'}
        </p>
      )}

      <div className="space-y-1.5">
        {data?.records.map(t => <TaskRow key={t.id} task={t} onChanged={load} />)}
      </div>
    </div>
  );
}

function TaskRow({ task, onChanged }: { task: TaskRecord; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  const done = task.status === 'Done';

  const flip = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateTask({ id: task.id, status: done ? 'Open' : 'Done' });
      onChanged();
    } catch (e) {
      toast.error(errMsg(e) || 'Could not change that task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`flex flex-wrap items-start gap-2 rounded-md border px-3 py-2 ${done ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${done ? 'line-through text-muted-foreground' : ''}`}>
          <span className="text-[10px] text-muted-foreground mr-1.5">#{task.taskId}</span>
          {task.title}
          {/* ⚠️ Se marchează ce e NEOBIȘNUIT: „Medium" pe fiecare rând ar fi tapet. */}
          {task.priority === 'High' && !done && (
            <span className="ml-1.5 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-700 align-middle">High</span>
          )}
          {task.overdue && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-destructive/15 px-1 py-0.5 text-[10px] text-destructive align-middle">
              <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />Overdue
            </span>
          )}
        </p>
        {task.notes && <p className="whitespace-pre-wrap break-words text-[11px] text-muted-foreground">{task.notes}</p>}
        <p className="text-[11px] text-muted-foreground">
          {/* ⚠️ „Nobody yet", nu un gol: o sarcină fără stăpân e chiar informația utilă. */}
          {task.assignedTo ?? 'Nobody yet'}
          {task.dueDate && ` · due ${task.dueDate}`}
          {task.customerName && ` · ${task.customerName}`}
          {task.jobRef && ` · job #${task.jobRef}`}
          {/* 🔴 §43 (Sesiunea 150) — DESPRE CE e sarcina. ⚠️ Numărul citit de om, ăla se spune la
              telefon. ⛔ Iar cererea își spune FELUL: tabelul e comun (§28), deci „request #12"
              singur ar fi putut fi o reclamație sau o mutare de vizită. */}
          {task.quoteRef && ` · quote ${task.quoteRef}`}
          {task.paymentRef && ` · payment #${task.paymentRef}`}
          {task.requestRef && ` · ${(task.requestKind ?? 'request').toLowerCase()} #${task.requestRef}`}
          {task.incidentRef && ` · incident #${task.incidentRef}`}
          {done && task.completedBy && ` · done by ${task.completedBy}`}
        </p>
      </div>
      <Button
        type="button" size="sm" variant={done ? 'ghost' : 'outline'}
        onClick={flip} disabled={saving}
        aria-label={done ? `Reopen task ${task.title}` : `Mark task ${task.title} as done`}
      >
        {saving
          ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          : done
            ? <><RotateCcw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Reopen</>
            : <><Check className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Done</>}
      </Button>
    </div>
  );
}

