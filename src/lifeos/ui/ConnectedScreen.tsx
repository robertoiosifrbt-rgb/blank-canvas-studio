import { useEffect, useMemo, useState } from 'react';
import { Archive, Bell, CheckCircle2, Download, Pause, Play, Plus, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import { scheduleCloudBackup } from '../../cloudState';
import { LifeOSRepository, LocalStorageAdapter } from '../core/repository';
import type { LifeEntity, LifeEntityType } from '../core/types';
import type { LifeOSScreen } from './screenRegistry';

type ConnectedScreenProps = {
  screen: LifeOSScreen;
  onNavigate: (id: string) => void;
};

type LegacyTask = {
  id: string;
  name: string;
  description?: string;
  dueDate?: string;
  startAt?: string;
  endAt?: string;
  completed?: boolean;
  priority?: string;
  children?: LegacyTask[];
  groupId?: string | null;
  calendarId?: string | null;
  reminderMinutes?: number;
  comments?: unknown[];
};

type LegacyEvent = {
  id: string;
  name: string;
  date: string;
  startTime?: string;
  endTime?: string;
};

const repo = new LifeOSRepository(new LocalStorageAdapter());
let repoReady: Promise<unknown> | null = null;
const ensureRepo = () => (repoReady ??= repo.init());

const entityTypeByScreen: Record<string, LifeEntityType> = {
  areas: 'area',
  goals: 'goal',
  projects: 'project',
  milestones: 'milestone',
  templates: 'template',
  habits: 'habit',
  routines: 'routine',
  notes: 'note',
  files: 'file',
  people: 'person',
  finance: 'transaction',
  assets: 'asset',
  home: 'asset',
  travel: 'project',
  health: 'habit',
  learning: 'project',
  journal: 'journal',
  weeklyReview: 'review',
  monthlyReview: 'review',
  automations: 'automation',
  tagsContexts: 'tag',
};

const utilityScreens = new Set([
  'today', 'dashboard', 'inbox', 'search', 'focus', 'time', 'analytics', 'activity',
  'archive', 'trash', 'backup', 'importExport', 'notifications', 'sync', 'integrations',
  'ai', 'aiSearch', 'aiPlanning', 'account', 'settings', 'customFields', 'views',
  'rules', 'family',
]);

const loadJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const flattenTasks = (items: LegacyTask[]): LegacyTask[] =>
  items.flatMap((item) => [item, ...flattenTasks(item.children || [])]);

const dateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const todayForTask = (task: LegacyTask) => (task.startAt?.slice(0, 10) || task.dueDate || '') === dateKey();

const makeEntity = (
  type: LifeEntityType,
  title: string,
  screenId: string,
  details: string,
  date: string,
  amount: string,
): LifeEntity => {
  const now = new Date().toISOString();
  const base = { id: crypto.randomUUID(), type, title, createdAt: now, updatedAt: now, metadata: { screenId, details } };
  switch (type) {
    case 'goal': return { ...base, type, targetDate: date || undefined, progress: 0 };
    case 'project': return { ...base, type, status: 'planned' };
    case 'milestone': return { ...base, type, projectId: '', dueAt: date || undefined };
    case 'task': return { ...base, type, status: 'inbox', priority: 'medium' };
    case 'event': return { ...base, type, time: { startAt: date || undefined } };
    case 'habit': return { ...base, type, schedule: details || undefined, target: 1, unit: 'times' };
    case 'routine': return { ...base, type, itemIds: [], schedule: details || undefined };
    case 'note': return { ...base, type, body: details };
    case 'person': return { ...base, type, name: title };
    case 'transaction': return { ...base, type, amount: Number(amount) || 0, currency: 'GBP', direction: 'expense', occurredAt: date || now };
    case 'journal': return { ...base, type, body: details, occurredAt: date || now };
    case 'review': return { ...base, type, period: screenId === 'monthlyReview' ? 'monthly' : 'weekly', from: now, to: now, body: details };
    case 'automation': return { ...base, type, trigger: {}, actions: [], enabled: true };
    case 'template': return { ...base, type, targetType: 'task', payload: {} };
    default: return base as LifeEntity;
  }
};

const entityDetails = (entity: LifeEntity) => {
  if (entity.type === 'note' || entity.type === 'journal') return entity.body;
  if (entity.type === 'transaction') return `${entity.direction === 'income' ? '+' : '-'}${entity.currency} ${Math.abs(entity.amount).toFixed(2)}`;
  if (entity.type === 'goal') return `${Math.round(entity.progress || 0)}%${entity.targetDate ? ` · ${entity.targetDate.slice(0, 10)}` : ''}`;
  if (entity.type === 'project') return entity.status || 'planned';
  if (entity.type === 'person') return [entity.email, entity.phone].filter(Boolean).join(' · ');
  return String(entity.metadata?.details || '');
};

const downloadJson = (name: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function ConnectedScreen({ screen, onNavigate }: ConnectedScreenProps) {
  const [entities, setEntities] = useState<LifeEntity[]>([]);
  const [legacyTasks, setLegacyTasks] = useState<LegacyTask[]>([]);
  const [legacyEvents, setLegacyEvents] = useState<LegacyEvent[]>([]);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedSection, setSelectedSection] = useState(screen.sections?.[0] || 'All');
  const [query, setQuery] = useState('');
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(() => loadJson<number | null>('lifeosTimerStartedAt', null));
  const [elapsed, setElapsed] = useState(() => loadJson<number>('lifeosTimerElapsed', 0));
  const [preference, setPreference] = useState(() => loadJson<Record<string, boolean>>('lifeosPreferences', {}));
  const [message, setMessage] = useState('');

  const refresh = async () => {
    await ensureRepo();
    setEntities(repo.list());
    setLegacyTasks(loadJson<LegacyTask[]>('tasks', []));
    setLegacyEvents(loadJson<LegacyEvent[]>('calendarEvents', []));
  };

  useEffect(() => {
    setSelectedSection(screen.sections?.[0] || 'All');
    setMessage('');
    void refresh();
  }, [screen.id]);

  useEffect(() => {
    if (!timerStartedAt) return;
    const update = () => setElapsed(loadJson<number>('lifeosTimerElapsed', 0) + Date.now() - timerStartedAt);
    update();
    const handle = window.setInterval(update, 1000);
    return () => window.clearInterval(handle);
  }, [timerStartedAt]);

  const allTasks = useMemo(() => flattenTasks(legacyTasks), [legacyTasks]);
  const openTasks = allTasks.filter((task) => !task.completed);
  const todayTasks = openTasks.filter(todayForTask);
  const todayEvents = legacyEvents.filter((event) => event.date === dateKey());
  const overdueTasks = openTasks.filter((task) => {
    const due = task.startAt?.slice(0, 10) || task.dueDate;
    return Boolean(due && due < dateKey());
  });

  const mappedType = entityTypeByScreen[screen.id];
  const workspaceEntities = useMemo(() => {
    if (mappedType) return entities.filter((entity) => entity.type === mappedType && !entity.deletedAt && !entity.archivedAt);
    return entities.filter((entity) => entity.type === 'note' && entity.metadata?.screenId === screen.id && !entity.deletedAt && !entity.archivedAt);
  }, [entities, mappedType, screen.id]);

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    const taskRows = allTasks.filter((task) => `${task.name} ${task.description || ''}`.toLowerCase().includes(term)).map((task) => ({ id: task.id, title: task.name, kind: 'Task' }));
    const eventRows = legacyEvents.filter((event) => event.name.toLowerCase().includes(term)).map((event) => ({ id: event.id, title: event.name, kind: 'Event' }));
    const entityRows = entities.filter((entity) => `${entity.title} ${entityDetails(entity)}`.toLowerCase().includes(term)).map((entity) => ({ id: entity.id, title: entity.title, kind: entity.type }));
    return [...taskRows, ...eventRows, ...entityRows].slice(0, 50);
  }, [query, allTasks, legacyEvents, entities]);

  const addLegacyInboxTask = () => {
    const name = title.trim();
    if (!name) return;
    const task: LegacyTask = {
      id: crypto.randomUUID(), name, description: details.trim(), dueDate: '', startAt: '', endAt: '',
      completed: false, priority: 'medium', groupId: null, calendarId: null, reminderMinutes: 15, children: [], comments: [],
    };
    const next = [task, ...legacyTasks];
    localStorage.setItem('tasks', JSON.stringify(next));
    scheduleCloudBackup();
    setLegacyTasks(next);
    setTitle('');
    setDetails('');
  };

  const addEntity = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    await ensureRepo();
    const type = mappedType || 'note';
    await repo.upsert(makeEntity(type, cleanTitle, screen.id, details.trim(), date, amount));
    setTitle('');
    setDetails('');
    setDate('');
    setAmount('');
    await refresh();
    scheduleCloudBackup();
  };

  const archiveEntity = async (entity: LifeEntity) => {
    await ensureRepo();
    await repo.upsert({ ...entity, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as LifeEntity);
    await refresh();
  };

  const trashEntity = async (entity: LifeEntity) => {
    await ensureRepo();
    await repo.remove(entity.id);
    await refresh();
  };

  const restoreEntity = async (entity: LifeEntity) => {
    await ensureRepo();
    await repo.upsert({ ...entity, archivedAt: null, deletedAt: null, updatedAt: new Date().toISOString() } as LifeEntity);
    await refresh();
  };

  const startTimer = () => {
    const now = Date.now();
    localStorage.setItem('lifeosTimerStartedAt', JSON.stringify(now));
    setTimerStartedAt(now);
  };

  const pauseTimer = () => {
    if (!timerStartedAt) return;
    const total = loadJson<number>('lifeosTimerElapsed', 0) + Date.now() - timerStartedAt;
    localStorage.setItem('lifeosTimerElapsed', JSON.stringify(total));
    localStorage.removeItem('lifeosTimerStartedAt');
    setElapsed(total);
    setTimerStartedAt(null);
  };

  const resetTimer = () => {
    localStorage.setItem('lifeosTimerElapsed', '0');
    localStorage.removeItem('lifeosTimerStartedAt');
    setElapsed(0);
    setTimerStartedAt(null);
  };

  const togglePreference = (key: string) => {
    const next = { ...preference, [key]: !preference[key] };
    localStorage.setItem('lifeosPreferences', JSON.stringify(next));
    setPreference(next);
    scheduleCloudBackup();
  };

  const exportBackup = async () => {
    await ensureRepo();
    downloadJson(`life-os-backup-${dateKey()}.json`, {
      lifeOS: repo.snapshot(),
      tasks: legacyTasks,
      calendarEvents: legacyEvents,
      calendars: loadJson('userCalendars', []),
      taskGroups: loadJson('taskGroups', []),
      preferences: preference,
    });
    setMessage('Backup exported.');
  };

  const importBackup = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      if (parsed.lifeOS) localStorage.setItem('life-os-state-v1', JSON.stringify(parsed.lifeOS));
      if (parsed.tasks) localStorage.setItem('tasks', JSON.stringify(parsed.tasks));
      if (parsed.calendarEvents) localStorage.setItem('calendarEvents', JSON.stringify(parsed.calendarEvents));
      if (parsed.calendars) localStorage.setItem('userCalendars', JSON.stringify(parsed.calendars));
      if (parsed.taskGroups) localStorage.setItem('taskGroups', JSON.stringify(parsed.taskGroups));
      if (parsed.preferences) localStorage.setItem('lifeosPreferences', JSON.stringify(parsed.preferences));
      repoReady = null;
      await refresh();
      scheduleCloudBackup();
      setMessage('Backup imported.');
    } catch {
      setMessage('Invalid backup file.');
    }
  };

  const requestNotifications = async () => {
    if (!('Notification' in window)) return setMessage('Notifications are not supported on this device.');
    const result = await Notification.requestPermission();
    setMessage(`Notification permission: ${result}.`);
  };

  const isSearch = screen.id === 'search' || screen.id === 'aiSearch';
  const isArchive = screen.id === 'archive';
  const isTrash = screen.id === 'trash';
  const isTimer = screen.id === 'focus' || screen.id === 'time';
  const isBackup = screen.id === 'backup' || screen.id === 'importExport';
  const isSettingsLike = ['settings', 'account', 'integrations', 'sync', 'customFields', 'views', 'rules', 'ai', 'aiPlanning', 'family'].includes(screen.id);
  const sectionRows = isArchive ? entities.filter((entity) => entity.archivedAt && !entity.deletedAt)
    : isTrash ? entities.filter((entity) => entity.deletedAt)
      : workspaceEntities;

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">{screen.group}</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">{screen.title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{screen.description}</p>
          </div>
          <button onClick={() => onNavigate('inbox')} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">+ Quick capture</button>
        </div>
      </div>

      {(screen.id === 'today' || screen.id === 'dashboard') && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Today', todayTasks.length + todayEvents.length, 'calendar'],
            ['Overdue', overdueTasks.length, 'myTasks'],
            ['Open tasks', openTasks.length, 'tasks'],
            ['Life OS records', entities.filter((e) => !e.deletedAt).length, 'areas'],
          ].map(([label, value, target]) => (
            <button key={String(label)} onClick={() => onNavigate(String(target))} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
            </button>
          ))}
        </div>
      )}

      {screen.id === 'inbox' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold">Quick capture</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLegacyInboxTask()} placeholder="What needs your attention?" className="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-400" />
            <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Optional note" className="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-400" />
            <button onClick={addLegacyInboxTask} className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white">Add</button>
          </div>
          <div className="mt-4 space-y-2">
            {openTasks.filter((task) => !task.dueDate && !task.startAt).slice(0, 20).map((task) => <div key={task.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">{task.name}</div>)}
          </div>
        </div>
      )}

      {isSearch && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
            <Search size={18} className="text-slate-400" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks, events and Life OS…" className="w-full py-3 outline-none" />
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {searchResults.map((row) => <div key={`${row.kind}-${row.id}`} className="flex items-center justify-between py-3"><span>{row.title}</span><span className="text-xs uppercase text-slate-400">{row.kind}</span></div>)}
            {query && !searchResults.length && <p className="py-6 text-center text-sm text-slate-400">No results.</p>}
          </div>
        </div>
      )}

      {isTimer && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-500">{screen.id === 'focus' ? (openTasks[0]?.name || 'Choose a task from Tasks') : 'Current tracked session'}</p>
          <p className="my-5 font-mono text-5xl font-bold">{new Date(elapsed).toISOString().slice(11, 19)}</p>
          <div className="flex justify-center gap-2">
            {!timerStartedAt ? <button onClick={startTimer} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white"><Play size={17} />Start</button> : <button onClick={pauseTimer} className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-white"><Pause size={17} />Pause</button>}
            <button onClick={resetTimer} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2"><RefreshCw size={17} />Reset</button>
          </div>
        </div>
      )}

      {screen.id === 'analytics' && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[["Completion", allTasks.length ? `${Math.round((allTasks.filter(t => t.completed).length / allTasks.length) * 100)}%` : '0%'], ['Overdue', overdueTasks.length], ['Events', legacyEvents.length], ['Projects', entities.filter(e => e.type === 'project' && !e.deletedAt).length]].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>
          ))}
        </div>
      )}

      {screen.id === 'activity' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-2">{[...entities].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 40).map((entity) => <div key={entity.id} className="flex justify-between gap-3 rounded-xl bg-slate-50 p-3"><span>{entity.title}</span><span className="text-xs text-slate-400">{new Date(entity.updatedAt).toLocaleString()}</span></div>)}</div>
        </div>
      )}

      {isBackup && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <button onClick={exportBackup} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-white"><Download size={17} />Export full backup</button>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2"><Upload size={17} />Import backup<input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && void importBackup(e.target.files[0])} /></label>
          </div>
        </div>
      )}

      {screen.id === 'notifications' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <button onClick={() => void requestNotifications()} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white"><Bell size={17} />Enable notifications</button>
        </div>
      )}

      {isSettingsLike && (
        <div className="grid gap-3 md:grid-cols-2">
          {(screen.sections || ['Enabled']).map((section) => (
            <button key={section} onClick={() => togglePreference(`${screen.id}:${section}`)} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
              <span className="font-medium">{section}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs ${preference[`${screen.id}:${section}`] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{preference[`${screen.id}:${section}`] ? 'On' : 'Off'}</span>
            </button>
          ))}
        </div>
      )}

      {!utilityScreens.has(screen.id) && !isArchive && !isTrash && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(screen.sections || ['All']).map((section) => <button key={section} onClick={() => setSelectedSection(section)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${selectedSection === section ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{section}</button>)}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold">Create {screen.title.toLowerCase()} item</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-400" />
              <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Details / notes" className="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-400" />
              {['goal', 'milestone', 'transaction', 'journal'].includes(mappedType) && <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" />}
              {mappedType === 'transaction' && <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount GBP" className="rounded-xl border border-slate-200 px-3 py-2.5" />}
            </div>
            <button onClick={() => void addEntity()} className="mt-3 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white"><Plus size={17} />Create</button>
          </div>
        </>
      )}

      {(isArchive || isTrash || !utilityScreens.has(screen.id)) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{isArchive ? 'Archived' : isTrash ? 'Trash' : selectedSection}</h3><span className="text-sm text-slate-400">{sectionRows.length}</span></div>
          <div className="space-y-2">
            {sectionRows.map((entity) => (
              <div key={entity.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-blue-500" />
                <div className="min-w-0 flex-1"><p className="font-medium">{entity.title}</p>{entityDetails(entity) && <p className="mt-1 truncate text-sm text-slate-500">{entityDetails(entity)}</p>}<p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{entity.type}</p></div>
                {(isArchive || isTrash) ? <button onClick={() => void restoreEntity(entity)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs">Restore</button> : <>
                  <button onClick={() => void archiveEntity(entity)} title="Archive" className="rounded-lg p-1.5 text-slate-400 hover:bg-white"><Archive size={16} /></button>
                  <button onClick={() => void trashEntity(entity)} title="Trash" className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-red-600"><Trash2 size={16} /></button>
                </>}
              </div>
            ))}
            {!sectionRows.length && <p className="py-8 text-center text-sm text-slate-400">No items yet.</p>}
          </div>
        </div>
      )}

      {message && <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700"><span>{message}</span><button onClick={() => setMessage('')}><X size={16} /></button></div>}
    </section>
  );
}
