import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, Circle, Folder, FolderPlus, MessageSquare, MoreHorizontal, Plus, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACHU_BACKLOG_GROUPS, ACHU_BACKLOG_TASKS } from '../data/achuBacklog';
import { scheduleCloudBackup } from '../cloudState';
import { syncAllStoredAlarms } from '../push';

type Priority = 'high' | 'medium' | 'low';

interface Comment {
  id: string;
  text: string;
  createdAt: string;
}

interface Item {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  startAt: string;
  endAt: string;
  completed: boolean;
  priority: Priority;
  groupId: string | null;
  calendarId: string | null;
  reminderMinutes: number;
  children: Item[];
  comments: Comment[];
}

interface Group {
  id: string;
  name: string;
  parentId: string | null;
}

interface Selection {
  taskId: string;
  path: string[];
}

const normalizeComment = (value: unknown): Comment | null => {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.text !== 'string' || !row.text.trim()) return null;
  return {
    id: typeof row.id === 'string' ? row.id : crypto.randomUUID(),
    text: row.text,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
  };
};

const normalizeItem = (value: unknown): Item | null => {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (!name) return null;
  const rawChildren = Array.isArray(row.children)
    ? row.children
    : Array.isArray(row.subtasks)
      ? row.subtasks
      : [];
  return {
    id: typeof row.id === 'string' ? row.id : crypto.randomUUID(),
    name,
    description: typeof row.description === 'string' ? row.description : '',
    dueDate: typeof row.dueDate === 'string' ? row.dueDate : '',
    startAt: typeof row.startAt === 'string' ? row.startAt : (typeof row.dueDate === 'string' && row.dueDate ? `${row.dueDate}T09:00` : ''),
    endAt: typeof row.endAt === 'string' ? row.endAt : (typeof row.dueDate === 'string' && row.dueDate ? `${row.dueDate}T10:00` : ''),
    completed: Boolean(row.completed),
    priority: row.priority === 'high' || row.priority === 'low' ? row.priority : 'medium',
    groupId: typeof row.groupId === 'string' ? row.groupId : null,
    calendarId: typeof row.calendarId === 'string' ? row.calendarId : null,
    reminderMinutes: typeof row.reminderMinutes === 'number' ? row.reminderMinutes : 15,
    children: rawChildren.map(normalizeItem).filter((item): item is Item => item !== null),
    comments: Array.isArray(row.comments)
      ? row.comments.map(normalizeComment).filter((item): item is Comment => item !== null)
      : [],
  };
};

const loadItems = (): Item[] => {
  try {
    const raw = localStorage.getItem('tasks');
    const importDone = localStorage.getItem('achuTasksImportedV1') === '1';
    if (!raw) { localStorage.setItem('achuTasksImportedV1', '1'); return ACHU_BACKLOG_TASKS as unknown as Item[]; }
    const parsed: unknown = JSON.parse(raw);
    const existing = Array.isArray(parsed)
      ? parsed.map(normalizeItem).filter((item): item is Item => item !== null)
      : [];
    if (importDone) return existing;
    const ids = new Set(existing.map((item) => item.id));
    const imported = (ACHU_BACKLOG_TASKS as unknown as Item[]).filter((item) => !ids.has(item.id));
    localStorage.setItem('achuTasksImportedV1', '1');
    return [...existing, ...imported];
  } catch {
    return ACHU_BACKLOG_TASKS as unknown as Item[];
  }
};

const loadGroups = (): Group[] => {
  try {
    const raw = localStorage.getItem('taskGroups');
    const importDone = localStorage.getItem('achuGroupsImportedV1') === '1';
    if (!raw) { localStorage.setItem('achuGroupsImportedV1', '1'); return [{ id: 'achu-root', name: 'ACHU', parentId: null }, ...(ACHU_BACKLOG_GROUPS as unknown as Group[]).map((group) => ({ ...group, parentId: 'achu-root' }))]; }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const existing = parsed
      .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object')
      .filter((value) => typeof value.id === 'string' && typeof value.name === 'string')
      .map((value) => ({
        id: value.id as string,
        name: (value.name as string).trim(),
        parentId: typeof value.parentId === 'string' ? value.parentId : null,
      }))
      .filter((group) => group.name);
    if (importDone) return existing;
    const achuRoot = existing.find((group) => group.name.trim().toLowerCase() === 'achu') || { id: 'achu-root', name: 'ACHU', parentId: null };
    const withoutDuplicateRoot = existing.filter((group) => group.id !== 'achu-root' || group.id === achuRoot.id);
    const ids = new Set(withoutDuplicateRoot.map((group) => group.id));
    const imported = (ACHU_BACKLOG_GROUPS as unknown as Group[]).map((group) => ({ ...group, parentId: achuRoot.id }));
    const result = [
      ...withoutDuplicateRoot.map((group) => group.id.startsWith('achu-group-') ? { ...group, parentId: achuRoot.id } : group),
      ...(!ids.has(achuRoot.id) && !importDone ? [achuRoot] : []),
      ...(!importDone ? imported.filter((group) => !ids.has(group.id)) : []),
    ];
    if (!importDone) localStorage.setItem('achuGroupsImportedV1', '1');
    return result;
  } catch {
    return [{ id: 'achu-root', name: 'ACHU', parentId: null }, ...(ACHU_BACKLOG_GROUPS as unknown as Group[]).map((group) => ({ ...group, parentId: 'achu-root' }))];
  }
};

const getAtPath = (task: Item, path: string[]): Item | null => {
  let current = task;
  for (const id of path) {
    const next = current.children.find((child) => child.id === id);
    if (!next) return null;
    current = next;
  }
  return current;
};

const updateAtPath = (item: Item, path: string[], updater: (item: Item) => Item): Item => {
  if (path.length === 0) return updater(item);
  const [head, ...rest] = path;
  return {
    ...item,
    children: item.children.map((child) =>
      child.id === head ? updateAtPath(child, rest, updater) : child
    ),
  };
};

const countProgress = (item: Item): { done: number; total: number; percent: number } => {
  if (!item.children.length) return { done: item.completed ? 1 : 0, total: 1, percent: item.completed ? 100 : 0 };
  const childProgress = item.children.map(countProgress);
  const done = childProgress.reduce((sum, progress) => sum + progress.done, 0);
  const total = childProgress.reduce((sum, progress) => sum + progress.total, 0);
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
};

const flattenItems = (items: Item[]): Item[] =>
  items.flatMap((item) => [item, ...flattenItems(item.children)]);

const moveItemsFromGroup = (items: Item[], groupId: string, replacement: string | null): Item[] =>
  items.map((item) => ({
    ...item,
    groupId: item.groupId === groupId ? replacement : item.groupId,
    children: moveItemsFromGroup(item.children, groupId, replacement),
  }));

const ProgressBar = ({ value, compact = false }: { value: number; compact?: boolean }) => (
  <div className={`${compact ? 'h-1.5' : 'h-2.5'} w-full overflow-hidden rounded-full bg-gray-200`}>
    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${value}%` }} />
  </div>
);

export const MyTasks = () => {
  const { t, i18n } = useTranslation();
  const ro = i18n.language.startsWith('ro');
  const [tasks, setTasks] = useState<Item[]>(loadItems);
  const [groups, setGroups] = useState<Group[]>(loadGroups);
  const [calendars] = useState<Array<{ id: string; name: string }>>(() => { try { const raw = localStorage.getItem('userCalendars'); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) && parsed.length ? parsed : [{ id: 'personal', name: 'Personal' }]; } catch { return [{ id: 'personal', name: 'Personal' }]; } });
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ recent: false, today: true, week: true, later: true });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ name: '', description: '', startAt: '', endAt: '', priority: 'medium' as Priority, groupId: '', calendarId: calendars[0]?.id || 'personal' });
  const [groupForm, setGroupForm] = useState({ name: '', parentId: '' });

  useEffect(() => {
    try { localStorage.setItem('tasks', JSON.stringify(tasks)); scheduleCloudBackup(); void syncAllStoredAlarms().catch(() => undefined); } catch { /* browser storage unavailable */ }
  }, [tasks]);

  useEffect(() => {
    try { localStorage.setItem('taskGroups', JSON.stringify(groups)); scheduleCloudBackup(); } catch { /* browser storage unavailable */ }
  }, [groups]);

  const allItems = useMemo(() => flattenItems(tasks).filter((item) => !item.children.length), [tasks]);
  const completed = allItems.filter((item) => item.completed).length;
  const overall = allItems.length ? Math.round((completed / allItems.length) * 100) : 0;

  const groupDescendants = (groupId: string) => {
    const ids = new Set([groupId]);
    let changed = true;
    while (changed) {
      changed = false;
      groups.forEach((group) => {
        if (group.parentId && ids.has(group.parentId) && !ids.has(group.id)) {
          ids.add(group.id);
          changed = true;
        }
      });
    }
    return ids;
  };

  const selectedGroupData = groups.find((group) => group.id === selectedGroup);
  const selectedHasChildren = groups.some((group) => group.parentId === selectedGroup);
  const visibleTasks = selectedGroup === 'all'
    ? tasks
    : tasks.filter((task) => task.groupId && groupDescendants(selectedGroup).has(task.groupId));

  const taskSections = useMemo(() => {
    const toKey = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const todayKey = toKey(today);
    const nextWeekKey = toKey(nextWeek);
    const due = (task: Item) => task.startAt?.slice(0, 10) || task.dueDate || '';
    return [
      { id: 'recent', name: ro ? 'Alocate recent' : 'Recently assigned', tasks: visibleTasks.filter((task) => !due(task)) },
      { id: 'today', name: ro ? 'De făcut astăzi' : 'Do today', tasks: visibleTasks.filter((task) => due(task) && due(task) <= todayKey) },
      { id: 'week', name: ro ? 'De făcut săptămâna viitoare' : 'Do next week', tasks: visibleTasks.filter((task) => due(task) > todayKey && due(task) <= nextWeekKey) },
      { id: 'later', name: ro ? 'De făcut mai târziu' : 'Do later', tasks: visibleTasks.filter((task) => due(task) > nextWeekKey) },
    ];
  }, [visibleTasks, ro]);

  const addTask = () => {
    const name = taskForm.name.trim();
    if (!name) return;
    if (!taskForm.startAt || !taskForm.endAt) return window.alert(ro ? 'Alege data și orele De la – Până la.' : 'Choose the start and end date/time.');
    if (new Date(taskForm.endAt) <= new Date(taskForm.startAt)) return window.alert(ro ? 'Data finală trebuie să fie după început.' : 'End must be after start.');
    setTasks((current) => [{
      id: crypto.randomUUID(),
      name,
      description: taskForm.description.trim(),
      dueDate: taskForm.startAt.slice(0, 10),
      startAt: taskForm.startAt,
      endAt: taskForm.endAt,
      completed: false,
      priority: taskForm.priority,
      groupId: taskForm.groupId || null,
      calendarId: taskForm.calendarId,
      reminderMinutes: 15,
      children: [],
      comments: [],
    }, ...current]);
    setTaskForm({ name: '', description: '', startAt: '', endAt: '', priority: 'medium', groupId: '', calendarId: taskForm.calendarId });
    setShowTaskForm(false);
  };

  const addGroup = () => {
    const name = groupForm.name.trim();
    if (!name) return;
    const group = { id: crypto.randomUUID(), name, parentId: groupForm.parentId || null };
    setGroups((current) => [...current, group]);
    setSelectedGroup(group.id);
    setGroupForm({ name: '', parentId: '' });
    setShowGroupForm(false);
  };

  const renameGroup = (id: string, name: string) => {
    setGroups((current) => current.map((group) => group.id === id ? { ...group, name } : group));
  };

  const deleteGroup = (id: string) => {
    const group = groups.find((candidate) => candidate.id === id);
    if (!group || !window.confirm(ro ? 'Ștergi grupul? Taskurile și subgrupurile vor urca un nivel.' : 'Delete this group? Tasks and subgroups will move up one level.')) return;
    setGroups((current) => current
      .filter((candidate) => candidate.id !== id)
      .map((candidate) => candidate.parentId === id ? { ...candidate, parentId: group.parentId } : candidate)
    );
    setTasks((current) => moveItemsFromGroup(current, id, group.parentId));
    if (selectedGroup === id) setSelectedGroup(group.parentId || 'all');
  };

  const updateSelection = (updater: (item: Item) => Item) => {
    if (!selection) return;
    setTasks((current) => current.map((task) =>
      task.id === selection.taskId ? updateAtPath(task, selection.path, updater) : task
    ));
  };

  const deleteSelection = () => {
    if (!selection) return;
    if (!window.confirm(ro ? 'Ștergi acest element și toate subsarcinile lui?' : 'Delete this item and all its subtasks?')) return;
    if (selection.path.length === 0) {
      setTasks((current) => current.filter((task) => task.id !== selection.taskId));
    } else {
      const parentPath = selection.path.slice(0, -1);
      const targetId = selection.path[selection.path.length - 1];
      setTasks((current) => current.map((task) =>
        task.id === selection.taskId
          ? updateAtPath(task, parentPath, (parent) => ({
              ...parent,
              children: parent.children.filter((child) => child.id !== targetId),
            }))
          : task
      ));
    }
    setSelection(null);
  };

  const selectedTask = selection ? tasks.find((task) => task.id === selection.taskId) : null;
  const selectedItem = selectedTask && selection ? getAtPath(selectedTask, selection.path) : null;

  return (
    <div className="space-y-0 bg-white sm:space-y-5">
      <div className="flex min-h-24 items-center justify-between gap-3 border-b border-gray-200 px-5 sm:min-h-0 sm:border-0 sm:px-0">
        <h2 className="text-4xl font-bold tracking-tight">{ro ? 'Sarcinile mele' : 'My tasks'}</h2>
        <button onClick={() => setShowTaskForm((value) => !value)} className="fixed bottom-24 right-5 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-red-500 text-white shadow-lg sm:static sm:flex sm:h-auto sm:w-auto sm:gap-2 sm:rounded-lg sm:bg-blue-600 sm:px-4 sm:py-2 sm:shadow-none">
          <Plus size={26} /> <span className="hidden sm:inline">{t('add_task')}</span>
        </button>
      </div>

      <section className="border-b border-gray-200 bg-white p-5 sm:rounded-xl sm:shadow-sm">
        <div className="mb-2 flex justify-between font-medium">
          <span>{completed} / {allItems.length} {t('completed').toLowerCase()}</span>
          <strong className="text-blue-600">{overall}%</strong>
        </div>
        <ProgressBar value={overall} />
      </section>

      {showTaskForm && (
        <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <input value={taskForm.name} onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })} placeholder={t('task_name')} className="w-full rounded-lg border px-3 py-3" />
          <textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder={t('description')} className="min-h-24 w-full rounded-lg border px-3 py-3" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm text-gray-600">{ro ? 'De la' : 'From'}<input type="datetime-local" value={taskForm.startAt} onChange={(e) => setTaskForm({ ...taskForm, startAt: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-3" /></label>
            <label className="text-sm text-gray-600">{ro ? 'Până la' : 'To'}<input type="datetime-local" value={taskForm.endAt} onChange={(e) => setTaskForm({ ...taskForm, endAt: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-3" /></label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm text-gray-600">{t('priority')}<select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as Priority })} className="mt-1 w-full rounded-lg border px-3 py-3"><option value="low">{t('low')}</option><option value="medium">{t('medium')}</option><option value="high">{t('high')}</option></select></label>
          </div>
          <label className="block text-sm text-gray-600">{ro ? 'Grup' : 'Group'}<select value={taskForm.groupId} onChange={(e) => setTaskForm({ ...taskForm, groupId: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-3"><option value="">{ro ? 'Fără grup' : 'No group'}</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
          <label className="block text-sm text-gray-600">Calendar<select value={taskForm.calendarId} onChange={(e) => setTaskForm({ ...taskForm, calendarId: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-3">{calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3"><button onClick={addTask} className="rounded-lg bg-blue-600 py-3 text-white">{t('save')}</button><button onClick={() => setShowTaskForm(false)} className="rounded-lg bg-gray-200 py-3">{t('cancel')}</button></div>
        </section>
      )}

      <section className="border-y border-gray-200 bg-white sm:rounded-xl sm:border sm:shadow-sm">
        {taskSections.map((section) => {
          const expanded = expandedSections[section.id];
          const done = section.tasks.filter((task) => task.completed).length;
          const percent = section.tasks.length ? Math.round((done / section.tasks.length) * 100) : 0;
          return (
            <div key={section.id} className="border-b-[6px] border-gray-50 last:border-b-0">
              <div className="flex min-h-20 items-center gap-3 px-5">
                <button onClick={() => setExpandedSections((current) => ({ ...current, [section.id]: !expanded }))} className="text-gray-500">
                  {expanded ? <ChevronDown size={24} /> : <ChevronRight size={24} />}
                </button>
                <button onClick={() => setExpandedSections((current) => ({ ...current, [section.id]: !expanded }))} className="min-w-0 flex-1 text-left text-xl font-semibold">
                  {section.name}
                </button>
                <span className="text-lg text-gray-500">{section.tasks.length > 10 ? '10+' : section.tasks.length}</span>
                <MoreHorizontal size={24} className="text-gray-500" />
              </div>
              {expanded && (
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {section.tasks.map((task) => (
                    <TaskRow key={task.id} item={task} depth={0} onOpen={(path) => setSelection({ taskId: task.id, path })} onToggle={(path) => setTasks((current) => current.map((row) => row.id === task.id ? updateAtPath(row, path, (item) => ({ ...item, completed: !item.completed })) : row))} />
                  ))}
                  {!section.tasks.length && <div className="px-5 py-5 text-sm text-gray-400">{t('no_tasks')}</div>}
                  {!!section.tasks.length && <div className="px-5 py-3"><div className="mb-1 flex justify-between text-xs text-gray-500"><span>{done}/{section.tasks.length}</span><span>{percent}%</span></div><ProgressBar value={percent} compact /></div>}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="space-y-0 border-b-[6px] border-gray-50 bg-white sm:space-y-3 sm:rounded-xl sm:border-0 sm:p-4 sm:shadow-sm">
        <div className="flex min-h-20 items-center justify-between border-b border-gray-100 px-5 sm:min-h-0 sm:border-0 sm:px-0"><h3 className="flex items-center gap-3 text-xl font-semibold"><Folder size={21} />{ro ? 'Secțiuni personalizate' : 'Custom sections'}</h3><button onClick={() => setShowGroupForm((value) => !value)} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 font-medium text-gray-800"><FolderPlus size={18} />{ro ? 'Adaugă' : 'Add'}</button></div>
        {showGroupForm && <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-3 sm:p-0"><input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} placeholder={ro ? 'Nume grup' : 'Group name'} className="rounded-lg border px-3 py-2" /><select value={groupForm.parentId} onChange={(e) => setGroupForm({ ...groupForm, parentId: e.target.value })} className="rounded-lg border px-3 py-2"><option value="">{ro ? 'Nivel principal' : 'Top level'}</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><button onClick={addGroup} className="rounded-lg bg-blue-600 px-3 py-2 text-white">{t('save')}</button></div>}
        {selectedGroup !== 'all' && <button onClick={() => setSelectedGroup(selectedGroupData?.parentId || 'all')} className="mx-5 my-3 rounded-lg bg-gray-100 px-3 py-2 text-left font-medium sm:mx-0">← {ro ? 'Înapoi' : 'Back'}</button>}
        <div className="p-3 sm:p-0">
          {selectedGroup === 'all' && <GroupRows groups={groups} items={allItems} parentId={null} depth={0} selected={selectedGroup} onSelect={setSelectedGroup} onRename={renameGroup} onDelete={deleteGroup} />}
          {selectedGroup !== 'all' && selectedHasChildren && <GroupRows groups={groups} items={allItems} parentId={selectedGroup} depth={0} selected={selectedGroup} onSelect={setSelectedGroup} onRename={renameGroup} onDelete={deleteGroup} />}
        </div>
      </section>

      {selection && selectedItem && (
        <ItemDetail
          item={selectedItem}
          groups={groups}
          calendars={calendars}
          ro={ro}
          onClose={() => setSelection(null)}
          onDelete={deleteSelection}
          onBack={() => selection.path.length ? setSelection({ ...selection, path: selection.path.slice(0, -1) }) : setSelection(null)}
          onOpenChild={(id) => setSelection({ ...selection, path: [...selection.path, id] })}
          onChange={(patch) => updateSelection((item) => ({ ...item, ...patch }))}
          onAddChild={(name) => updateSelection((item) => ({ ...item, children: [...item.children, { id: crypto.randomUUID(), name, description: '', dueDate: '', startAt: '', endAt: '', completed: false, priority: 'medium', groupId: item.groupId, calendarId: item.calendarId, reminderMinutes: 15, children: [], comments: [] }] }))}
          onToggleChild={(id) => updateSelection((item) => ({ ...item, children: item.children.map((child) => child.id === id ? { ...child, completed: !child.completed } : child) }))}
          onDeleteChild={(id) => updateSelection((item) => ({ ...item, children: item.children.filter((child) => child.id !== id) }))}
          onAddComment={(text) => updateSelection((item) => ({ ...item, comments: [...item.comments, { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }] }))}
          onEditComment={(id, text) => updateSelection((item) => ({ ...item, comments: item.comments.map((entry) => entry.id === id ? { ...entry, text } : entry) }))}
          onDeleteComment={(id) => updateSelection((item) => ({ ...item, comments: item.comments.filter((entry) => entry.id !== id) }))}
        />
      )}
    </div>
  );
};

const TaskRow = ({ item, depth, onOpen, onToggle, path = [] }: { item: Item; depth: number; onOpen: (path: string[]) => void; onToggle: (path: string[]) => void; path?: string[] }) => {
  const progress = countProgress(item);
  return <div>
    <div className="bg-white px-5 py-4 sm:rounded-xl sm:p-3 sm:shadow-sm" style={{ marginLeft: Math.min(depth * 14, 42) }}>
      <div className="flex items-center gap-3">
        <button onClick={() => onToggle(path)} className={item.completed ? 'text-green-600' : 'text-gray-400'}>{item.completed ? <CheckCircle2 /> : <Circle />}</button>
        <button onClick={() => onOpen(path)} className="min-w-0 flex-1 text-left"><div className={`truncate font-medium ${item.completed ? 'line-through text-gray-400' : ''}`}>{item.name}</div><div className="mt-2 flex items-center gap-2"><div className="flex-1"><ProgressBar value={progress.percent} compact /></div><span className="text-xs font-semibold text-gray-500">{progress.percent}%</span></div></button>
        <button onClick={() => onOpen(path)} className="text-gray-400"><ChevronRight /></button>
      </div>
    </div>
    {item.children.map((child) => <TaskRow key={child.id} item={child} depth={depth + 1} path={[...path, child.id]} onOpen={onOpen} onToggle={onToggle} />)}
  </div>;
};

const GroupRows = ({ groups, items, parentId, depth, selected, onSelect, onRename, onDelete }: { groups: Group[]; items: Item[]; parentId: string | null; depth: number; selected: string; onSelect: (id: string) => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void }) => (
  <>
    {groups.filter((group) => group.parentId === parentId).map((group) => {
      const descendantIds = new Set([group.id]);
      let changed = true;
      while (changed) { changed = false; groups.forEach((candidate) => { if (candidate.parentId && descendantIds.has(candidate.parentId) && !descendantIds.has(candidate.id)) { descendantIds.add(candidate.id); changed = true; } }); }
      const relevant = items.filter((item) => item.groupId && descendantIds.has(item.groupId));
      const done = relevant.filter((item) => item.completed).length;
      const percent = relevant.length ? Math.round((done / relevant.length) * 100) : 0;
      return <div key={group.id}><div className={`w-full rounded-lg py-2 pr-3 ${selected === group.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`} style={{ paddingLeft: 12 + depth * 20 }}><div className="flex items-center gap-2"><button onClick={() => onSelect(group.id)} className="text-gray-500"><Folder size={17} /></button><input value={group.name} onChange={(event) => onRename(group.id, event.target.value)} onFocus={() => onSelect(group.id)} className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 font-medium focus:border-blue-300 focus:bg-white" /><span className="text-xs font-semibold">{percent}%</span><button onClick={() => onDelete(group.id)} className="text-red-500"><Trash2 size={17} /></button></div><ProgressBar value={percent} compact /></div><GroupRows groups={groups} items={items} parentId={group.id} depth={depth + 1} selected={selected} onSelect={onSelect} onRename={onRename} onDelete={onDelete} /></div>;
    })}
  </>
);

const ItemDetail = ({ item, groups, calendars, ro, onClose, onDelete, onBack, onOpenChild, onChange, onAddChild, onToggleChild, onDeleteChild, onAddComment, onEditComment, onDeleteComment }: {
  item: Item; groups: Group[]; calendars: Array<{ id: string; name: string }>; ro: boolean; onClose: () => void; onDelete: () => void; onBack: () => void; onOpenChild: (id: string) => void; onChange: (patch: Partial<Item>) => void; onAddChild: (name: string) => void; onToggleChild: (id: string) => void; onDeleteChild: (id: string) => void; onAddComment: (text: string) => void; onEditComment: (id: string, text: string) => void; onDeleteComment: (id: string) => void;
}) => {
  const [childName, setChildName] = useState('');
  const [comment, setComment] = useState('');
  const progress = countProgress(item);
  const submitChild = () => { const name = childName.trim(); if (name) { onAddChild(name); setChildName(''); } };
  const submitComment = () => { const text = comment.trim(); if (text) { onAddComment(text); setComment(''); } };
  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-white">
    <div className="mx-auto min-h-screen max-w-2xl">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
        <button onClick={onBack} className="p-2 text-gray-600"><ArrowLeft /></button>
        <button onClick={() => onChange({ completed: !item.completed })} className={`flex items-center gap-2 rounded-full border px-4 py-2 font-medium ${item.completed ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300'}`}>{item.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}{item.completed ? (ro ? 'Finalizat' : 'Completed') : (ro ? 'Marchează finalizat' : 'Mark complete')}</button>
        <div className="flex items-center gap-3"><button onClick={onDelete} className="text-red-500" title={ro ? 'Șterge' : 'Delete'}><Trash2 /></button><MoreHorizontal className="text-gray-500" /><button onClick={onClose}><X /></button></div>
      </header>
      <main className="space-y-0">
        <section className="border-b p-5"><input value={item.name} onChange={(e) => onChange({ name: e.target.value })} className="w-full border-0 text-2xl font-bold outline-none" /></section>
        <section className="grid grid-cols-1 gap-4 border-b p-5 sm:grid-cols-2">
          <label className="text-sm text-gray-500"><span className="flex items-center gap-2"><CalendarDays size={19} />{ro ? 'De la' : 'From'}</span><input type="datetime-local" value={item.startAt} onChange={(e) => onChange({ startAt: e.target.value, dueDate: e.target.value.slice(0, 10) })} className="mt-2 w-full rounded-lg border px-3 py-3 text-gray-900" /></label>
          <label className="text-sm text-gray-500"><span className="flex items-center gap-2"><CalendarDays size={19} />{ro ? 'Până la' : 'To'}</span><input type="datetime-local" value={item.endAt} onChange={(e) => onChange({ endAt: e.target.value })} className="mt-2 w-full rounded-lg border px-3 py-3 text-gray-900" /></label>
          <label className="text-sm text-gray-500"><span className="flex items-center gap-2"><Folder size={19} />{ro ? 'Grup' : 'Group'}</span><select value={item.groupId || ''} onChange={(e) => onChange({ groupId: e.target.value || null })} className="mt-2 w-full rounded-lg border px-3 py-3 text-gray-900"><option value="">{ro ? 'Fără grup' : 'No group'}</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
          <label className="text-sm text-gray-500">Calendar<select value={item.calendarId || calendars[0]?.id || ''} onChange={(e) => onChange({ calendarId: e.target.value })} className="mt-2 w-full rounded-lg border px-3 py-3 text-gray-900">{calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}</select></label>
          <label className="text-sm text-gray-500">{ro ? 'Alarmă' : 'Reminder'}<select value={item.reminderMinutes} onChange={(e) => onChange({ reminderMinutes: Number(e.target.value) })} className="mt-2 w-full rounded-lg border px-3 py-3 text-gray-900"><option value={-1}>{ro ? 'Fără alarmă' : 'No reminder'}</option><option value={0}>{ro ? 'La început' : 'At start'}</option><option value={5}>5 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1 h</option><option value={1440}>1 zi</option></select></label>
          <label className="text-sm text-gray-500">{ro ? 'Prioritate' : 'Priority'}<select value={item.priority} onChange={(e) => onChange({ priority: e.target.value as Priority })} className="mt-2 w-full rounded-lg border px-3 py-3 text-gray-900"><option value="low">{ro ? 'Joasă' : 'Low'}</option><option value="medium">{ro ? 'Medie' : 'Medium'}</option><option value="high">{ro ? 'Înaltă' : 'High'}</option></select></label>
        </section>
        <section className="border-b p-5"><h3 className="mb-3 text-xl font-semibold">{ro ? 'Descriere' : 'Description'}</h3><textarea value={item.description} onChange={(e) => onChange({ description: e.target.value })} placeholder={ro ? 'Adaugă o descriere…' : 'Add a description…'} className="min-h-28 w-full rounded-lg border p-3" /></section>
        <section className="border-b p-5"><div className="mb-2 flex justify-between"><h3 className="text-xl font-semibold">{ro ? 'Progres' : 'Progress'}</h3><strong>{progress.percent}%</strong></div><ProgressBar value={progress.percent} /></section>
        <section className="border-b p-5">
          <h3 className="mb-4 text-xl font-semibold">{ro ? 'Subsarcini' : 'Subtasks'}</h3>
          <div className="space-y-2">{item.children.map((child) => { const childProgress = countProgress(child); return <div key={child.id} className="rounded-lg border p-3"><div className="flex items-center gap-2"><button onClick={() => onToggleChild(child.id)} className={child.completed ? 'text-green-600' : 'text-gray-400'}>{child.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}</button><button onClick={() => onOpenChild(child.id)} className="min-w-0 flex-1 text-left font-medium">{child.name}</button><span className="text-xs font-semibold">{childProgress.percent}%</span><button onClick={() => onDeleteChild(child.id)} className="text-gray-400"><Trash2 size={17} /></button><button onClick={() => onOpenChild(child.id)}><ChevronRight size={20} /></button></div><div className="mt-2"><ProgressBar value={childProgress.percent} compact /></div></div> })}</div>
          <div className="mt-3 flex gap-2"><input value={childName} onChange={(e) => setChildName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitChild()} placeholder={ro ? 'Nume subsarcină' : 'Subtask name'} className="min-w-0 flex-1 rounded-lg border px-3 py-3" /><button onClick={submitChild} className="rounded-lg bg-blue-600 px-4 text-white"><Plus /></button></div>
        </section>
        <section className="p-5"><h3 className="mb-4 flex items-center gap-2 text-xl font-semibold"><MessageSquare size={21} />{ro ? 'Comentarii' : 'Comments'}</h3><div className="space-y-3">{item.comments.map((entry) => <div key={entry.id} className="rounded-lg bg-gray-50 p-3"><div className="flex gap-2"><textarea value={entry.text} onChange={(e) => onEditComment(entry.id, e.target.value)} className="min-h-16 min-w-0 flex-1 rounded border bg-white p-2" /><button onClick={() => onDeleteComment(entry.id)} className="text-red-500"><Trash2 size={18} /></button></div><p className="mt-1 text-xs text-gray-400">{new Date(entry.createdAt).toLocaleString()}</p></div>)}</div><div className="mt-4 flex gap-2"><textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={ro ? 'Scrie un comentariu…' : 'Write a comment…'} className="min-h-20 min-w-0 flex-1 rounded-lg border p-3" /><button onClick={submitComment} className="self-end rounded-lg bg-blue-600 px-4 py-3 text-white">{ro ? 'Trimite' : 'Send'}</button></div></section>
      </main>
    </div>
  </div>;
};
