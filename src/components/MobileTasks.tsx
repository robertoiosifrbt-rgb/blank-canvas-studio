import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  ListFilter,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { scheduleCloudBackup } from '../cloudState';
import { syncAllStoredAlarms } from '../push';

type Priority = 'high' | 'medium' | 'low';

interface Task {
  id: string;
  name: string;
  description?: string;
  dueDate?: string;
  startAt?: string;
  endAt?: string;
  completed: boolean;
  priority?: Priority;
  groupId?: string | null;
  calendarId?: string | null;
  reminderMinutes?: number;
  children?: Task[];
  comments?: Array<{ id: string; text: string; createdAt: string }>;
}

interface Section {
  id: string;
  name: string;
  kind: 'recent' | 'today' | 'week' | 'later' | 'custom';
}

const starterSections: Section[] = [
  { id: 'recent', name: 'Recently assigned', kind: 'recent' },
  { id: 'today', name: 'Do today', kind: 'today' },
  { id: 'week', name: 'Do next week', kind: 'week' },
  { id: 'later', name: 'Do later', kind: 'later' },
];

const loadTasks = (): Task[] => {
  try {
    const value = JSON.parse(localStorage.getItem('tasks') || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const loadSections = (): Section[] => {
  try {
    const value = JSON.parse(localStorage.getItem('taskSections') || '[]');
    return [...starterSections, ...(Array.isArray(value) ? value : [])];
  } catch {
    return starterSections;
  }
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const taskDate = (task: Task) => task.startAt?.slice(0, 10) || task.dueDate || '';

const sectionFor = (task: Task, sections: Section[]) => {
  if (task.groupId && sections.some((section) => section.id === task.groupId && section.kind === 'custom')) return task.groupId;
  const due = taskDate(task);
  if (!due) return 'later';
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  if (due <= dateKey(today)) return 'today';
  if (due <= dateKey(nextWeek)) return 'week';
  return 'later';
};

const totalProgress = (task: Task) => {
  const children = task.children || [];
  if (!children.length) return task.completed ? 100 : 0;
  return Math.round((children.filter((child) => child.completed).length / children.length) * 100);
};

export const MobileTasks = ({ onOpenCalendar }: { onOpenCalendar: () => void }) => {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [sections, setSections] = useState<Section[]>(loadSections);
  const [open, setOpen] = useState<Record<string, boolean>>({ recent: false, today: true, week: true, later: true });
  const [editing, setEditing] = useState<Task | null>(null);
  const [newSection, setNewSection] = useState(false);
  const [sectionName, setSectionName] = useState('');

  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
    scheduleCloudBackup();
    void syncAllStoredAlarms().catch(() => undefined);
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('taskSections', JSON.stringify(sections.filter((section) => section.kind === 'custom')));
    scheduleCloudBackup();
  }, [sections]);

  const recent = useMemo(() => tasks.slice(0, 10), [tasks]);
  const items = (section: Section) => section.kind === 'recent'
    ? recent
    : tasks.filter((task) => sectionFor(task, sections) === section.id);

  const updateTask = (id: string, patch: Partial<Task>) => {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, ...patch } : task));
    setEditing((current) => current?.id === id ? { ...current, ...patch } : current);
  };

  const addTask = () => {
    const now = new Date();
    const startAt = `${dateKey(now)}T09:00`;
    setEditing({
      id: crypto.randomUUID(),
      name: '',
      description: '',
      dueDate: dateKey(now),
      startAt,
      endAt: `${dateKey(now)}T10:00`,
      completed: false,
      priority: 'medium',
      groupId: null,
      calendarId: 'personal',
      reminderMinutes: 15,
      children: [],
      comments: [],
    });
  };

  const saveTask = () => {
    if (!editing?.name.trim()) return;
    setTasks((current) => current.some((task) => task.id === editing.id)
      ? current.map((task) => task.id === editing.id ? editing : task)
      : [editing, ...current]);
    setEditing(null);
  };

  const addSection = () => {
    const name = sectionName.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    setSections((current) => [...current, { id, name, kind: 'custom' }]);
    setOpen((current) => ({ ...current, [id]: true }));
    setSectionName('');
    setNewSection(false);
  };

  return (
    <div className="mx-auto min-h-[100dvh] max-w-3xl bg-white pb-36 text-[#202124]">
      <header className="flex items-center justify-between border-b border-[#e8e8e8] px-5 pb-5 pt-7 sm:px-8">
        <h1 className="text-[34px] font-bold tracking-tight sm:text-4xl">My tasks</h1>
        <button className="rounded-full p-2 text-[#707174] hover:bg-[#f4f4f4]" aria-label="More options"><MoreHorizontal size={28} /></button>
      </header>

      <main>
        {sections.map((section) => {
          const sectionItems = items(section);
          const expanded = Boolean(open[section.id]);
          const complete = sectionItems.filter((task) => task.completed).length;
          const percent = sectionItems.length ? Math.round((complete / sectionItems.length) * 100) : 0;
          return (
            <section key={section.id} className="border-b-[6px] border-[#faf8f8]">
              <div className="flex min-h-[76px] items-center gap-3 px-5 sm:px-8">
                <button onClick={() => setOpen((current) => ({ ...current, [section.id]: !expanded }))} className="text-[#707174]" aria-label={expanded ? 'Collapse section' : 'Expand section'}>
                  {expanded ? <ChevronDown size={26} fill="currentColor" /> : <ChevronRight size={26} fill="currentColor" />}
                </button>
                <button onClick={() => setOpen((current) => ({ ...current, [section.id]: !expanded }))} className="min-w-0 flex-1 text-left text-[22px] font-semibold">
                  {section.name}
                </button>
                <span className="text-xl text-[#77787b]">{sectionItems.length > 10 ? '10+' : sectionItems.length}</span>
                <button className="text-[#77787b]" aria-label="Section options"><MoreHorizontal size={26} /></button>
              </div>

              {expanded && (
                <div className="border-t border-[#eeeeee]">
                  {sectionItems.map((task) => (
                    <div key={`${section.id}-${task.id}`} className="flex items-center gap-3 border-b border-[#eeeeee] px-5 py-3.5 sm:px-8">
                      <button onClick={() => updateTask(task.id, { completed: !task.completed })} className={`grid h-6 w-6 place-items-center rounded-full border-2 ${task.completed ? 'border-[#4c6fff] bg-[#4c6fff] text-white' : 'border-[#a9aaad] text-transparent'}`}>
                        <Check size={15} strokeWidth={3} />
                      </button>
                      <button onClick={() => setEditing(task)} className="min-w-0 flex-1 text-left">
                        <div className={`truncate text-base font-medium ${task.completed ? 'text-[#929397] line-through' : ''}`}>{task.name}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-[#77787b]">
                          {taskDate(task) && <><CalendarDays size={13} />{new Date(`${taskDate(task)}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</>}
                          {(task.children?.length || 0) > 0 && <span>{totalProgress(task)}%</span>}
                        </div>
                        {(task.children?.length || 0) > 0 && <div className="mt-2 h-1 overflow-hidden rounded bg-[#e5e7eb]"><div className="h-full bg-[#4c6fff]" style={{ width: `${totalProgress(task)}%` }} /></div>}
                      </button>
                      <ChevronRight size={20} className="text-[#a1a2a5]" />
                    </div>
                  ))}
                  {!sectionItems.length && <div className="px-8 py-5 text-sm text-[#929397]">No tasks in this section</div>}
                  <button onClick={addTask} className="flex w-full items-center gap-3 px-8 py-4 text-left font-medium text-[#4c6fff]"><Plus size={20} /> Add task</button>
                  {sectionItems.length > 0 && <div className="px-8 pb-4"><div className="h-1.5 overflow-hidden rounded-full bg-[#ececef]"><div className="h-full bg-[#4c6fff]" style={{ width: `${percent}%` }} /></div><div className="mt-1 text-right text-xs text-[#77787b]">{percent}%</div></div>}
                </div>
              )}
            </section>
          );
        })}

        <div className="p-5 sm:px-8">
          {!newSection ? (
            <button onClick={() => setNewSection(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#dedede] py-3.5 text-lg font-medium"><ListFilter size={22} />Add a custom section</button>
          ) : (
            <div className="flex gap-2 rounded-2xl border border-[#dedede] p-2">
              <input autoFocus value={sectionName} onChange={(event) => setSectionName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addSection()} placeholder="Section name" className="min-w-0 flex-1 rounded-xl px-3 outline-none" />
              <button onClick={addSection} className="rounded-xl bg-[#4c6fff] px-4 py-2 text-white">Add</button>
              <button onClick={() => setNewSection(false)} className="p-2 text-[#77787b]"><X /></button>
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-[72px] left-1/2 z-30 flex -translate-x-1/2 items-center rounded-[24px] border border-[#e6e3e3] bg-[#f8f7f7] p-1.5 shadow-sm">
        <button className="grid h-14 w-14 place-items-center rounded-[18px] border-2 border-[#4c6fff] bg-[#eef1ff] text-[#4c6fff]"><ListFilter /></button>
        <button className="mx-2 min-w-36 rounded-[18px] bg-white px-7 py-4 text-lg font-semibold shadow-sm">List</button>
        <button onClick={addTask} className="grid h-14 w-14 place-items-center rounded-[18px] bg-[#ff5b50] text-white"><Plus size={30} /></button>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex h-[76px] max-w-3xl items-center justify-around border-t border-[#e5e5e5] bg-[#fbf9f9] px-3">
        <button className="flex flex-col items-center gap-1 font-semibold text-[#202124]"><Circle size={22} fill="currentColor" /><span className="text-xs">My tasks</span></button>
        <button onClick={onOpenCalendar} className="flex flex-col items-center gap-1 text-[#707174]"><CalendarDays size={24} /><span className="text-xs">Calendar</span></button>
      </nav>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center">
          <div className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
            <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">{tasks.some((task) => task.id === editing.id) ? 'Edit task' : 'New task'}</h2><button onClick={() => setEditing(null)} className="p-2"><X /></button></div>
            <div className="space-y-4">
              <input autoFocus value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} placeholder="Task name" className="w-full rounded-xl border px-4 py-3 text-lg" />
              <textarea value={editing.description || ''} onChange={(event) => setEditing({ ...editing, description: event.target.value })} placeholder="Description" className="min-h-24 w-full rounded-xl border px-4 py-3" />
              <label className="block text-sm text-[#707174]">Date<input type="date" value={taskDate(editing)} onChange={(event) => setEditing({ ...editing, dueDate: event.target.value, startAt: `${event.target.value}T09:00`, endAt: `${event.target.value}T10:00` })} className="mt-1 w-full rounded-xl border px-4 py-3 text-[#202124]" /></label>
              <label className="block text-sm text-[#707174]">Section<select value={editing.groupId || sectionFor(editing, sections)} onChange={(event) => setEditing({ ...editing, groupId: event.target.value })} className="mt-1 w-full rounded-xl border px-4 py-3 text-[#202124]">{sections.filter((section) => section.kind !== 'recent').map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label>
              <div className="flex gap-3">
                {tasks.some((task) => task.id === editing.id) && <button onClick={() => { setTasks((current) => current.filter((task) => task.id !== editing.id)); setEditing(null); }} className="rounded-xl border border-red-200 px-4 py-3 text-red-600"><Trash2 /></button>}
                <button onClick={saveTask} className="flex-1 rounded-xl bg-[#4c6fff] py-3 font-semibold text-white">Save task</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
