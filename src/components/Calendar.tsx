import { useState, useEffect } from 'react';
import { Bell, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { enablePush, syncAllStoredAlarms, syncPushAlarms, type PushAlarm } from '../push';
import { scheduleCloudBackup } from '../cloudState';

interface Task {
  id: string;
  name: string;
  dueDate: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  category: string;
  startAt?: string;
  endAt?: string;
  calendarId?: string;
  reminderMinutes?: number;
  children?: Task[];
}

interface CalendarEvent {
  id: string;
  name: string;
  date: string;
  category: string;
  color: string;
  startTime: string;
  endTime: string;
  calendarId?: string;
  reminderMinutes?: number;
}

interface UserCalendar {
  id: string;
  name: string;
  color: string;
}

const flattenTaskTree = (tasks: Task[]): Task[] => tasks.flatMap((task) => [task, ...flattenTaskTree(task.children || [])]);
const updateTaskTree = (tasks: Task[], id: string, patch: Partial<Task>): Task[] => tasks.map((task) => ({ ...task, ...(task.id === id ? patch : {}), children: updateTaskTree(task.children || [], id, patch) }));
const deleteTaskTree = (tasks: Task[], id: string): Task[] => tasks.filter((task) => task.id !== id).map((task) => ({ ...task, children: deleteTaskTree(task.children || [], id) }));
const moveCalendarInTree = (tasks: Task[], from: string, to: string): Task[] => tasks.map((task) => ({ ...task, calendarId: task.calendarId === from ? to : task.calendarId, children: moveCalendarInTree(task.children || [], from, to) }));



const CATEGORY_COLORS = {
  Work: 'bg-blue-100 border-blue-300 text-blue-700',
  Personal: 'bg-purple-100 border-purple-300 text-purple-700',
  Shopping: 'bg-pink-100 border-pink-300 text-pink-700',
  Health: 'bg-green-100 border-green-300 text-green-700',
  Travel: 'bg-orange-100 border-orange-300 text-orange-700',
};

type ViewMode = 'month' | 'week' | 'day';

export const Calendar = () => {
  const { i18n } = useTranslation();
  const ro = i18n.language.startsWith('ro');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [dayForm, setDayForm] = useState<'event' | 'task' | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<{ kind: 'task' | 'event'; id: string } | null>(null);
  const [calendars, setCalendars] = useState<UserCalendar[]>(() => {
    try {
      const raw = localStorage.getItem('userCalendars');
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) && parsed.length ? parsed : [{ id: 'personal', name: 'Personal', color: '#2563eb' }, { id: 'work', name: 'Work', color: '#16a34a' }];
    } catch {
      return [{ id: 'personal', name: 'Personal', color: '#2563eb' }, { id: 'work', name: 'Work', color: '#16a34a' }];
    }
  });
  const [newCalendar, setNewCalendar] = useState('');
  const [calendarFilter, setCalendarFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState<'all' | 'task' | 'event'>('all');
  const [form, setForm] = useState({ name: '', startTime: '09:00', endTime: '10:00', calendarId: 'personal' });
  const [tasks, setTasks] = useState<Task[]>(() => {
    try { const raw = localStorage.getItem('tasks'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try { const raw = localStorage.getItem('calendarEvents'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });

  useEffect(() => { localStorage.setItem('tasks', JSON.stringify(tasks)); scheduleCloudBackup(); }, [tasks]);
  useEffect(() => { localStorage.setItem('calendarEvents', JSON.stringify(events)); scheduleCloudBackup(); void syncAllStoredAlarms().catch(() => undefined); }, [events]);
  useEffect(() => { localStorage.setItem('userCalendars', JSON.stringify(calendars)); scheduleCloudBackup(); }, [calendars]);

  useEffect(() => {
    const checkAlarms = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const now = Date.now();
      const candidates = [
        ...flattenTaskTree(tasks).map((task) => ({ id: task.id, name: task.name, start: task.startAt || (task.dueDate ? `${task.dueDate}T09:00` : ''), reminder: task.reminderMinutes ?? 15 })),
        ...events.map((event) => ({ id: event.id, name: event.name, start: `${event.date}T${event.startTime || '09:00'}`, reminder: event.reminderMinutes ?? 15 })),
      ];
      candidates.forEach((item) => {
        if (!item.start || item.reminder < 0) return;
        const alarmAt = new Date(item.start).getTime() - item.reminder * 60000;
        const key = `calendarAlarm:${item.id}:${item.start}:${item.reminder}`;
        if (alarmAt <= now && now - alarmAt < 60000 && !localStorage.getItem(key)) {
          new Notification(item.name, { body: ro ? `Începe la ${new Date(item.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `Starts at ${new Date(item.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` });
          localStorage.setItem(key, '1');
        }
      });
    };
    checkAlarms();
    const timer = window.setInterval(checkAlarms, 30000);
    return () => window.clearInterval(timer);
  }, [events, tasks, ro]);

  useEffect(() => {
    const alarms: PushAlarm[] = [
      ...flattenTaskTree(tasks).flatMap((task) => {
        const reminder = task.reminderMinutes ?? 15;
        const start = task.startAt || (task.dueDate ? `${task.dueDate}T09:00` : '');
        if (!start || reminder < 0) return [];
        return [{ id: `task:${task.id}`, title: task.name, body: ro ? 'Taskul începe acum.' : 'Task starts now.', url: '/', scheduledAt: new Date(new Date(start).getTime() - reminder * 60000).toISOString() }];
      }),
      ...events.flatMap((event) => {
        const reminder = event.reminderMinutes ?? 15;
        if (!event.date || reminder < 0) return [];
        const start = `${event.date}T${event.startTime || '09:00'}`;
        return [{ id: `event:${event.id}`, title: event.name, body: ro ? 'Evenimentul începe acum.' : 'Event starts now.', url: '/', scheduledAt: new Date(new Date(start).getTime() - reminder * 60000).toISOString() }];
      }),
    ].filter((alarm) => new Date(alarm.scheduledAt).getTime() > Date.now() - 60000);
    void syncPushAlarms(alarms).catch(() => undefined);
  }, [events, tasks, ro]);

  const dateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const itemsForDate = (date: Date) => {
    const key = dateKey(date);
    const taskItems = flattenTaskTree(tasks).filter((task) => (task.startAt?.slice(0, 10) || task.dueDate) === key);
    const eventItems = events.filter((event) => event.date === key);
    return [
      ...taskItems.map((task) => ({ id: task.id, name: task.name, start: task.startAt?.slice(11, 16) || '09:00', end: task.endAt?.slice(11, 16) || '10:00', kind: 'task' as const, calendarId: task.calendarId || 'personal', color: calendars.find((calendar) => calendar.id === (task.calendarId || 'personal'))?.color || '#16a34a' })),
      ...eventItems.map((event) => ({ id: event.id, name: event.name, start: event.startTime || '09:00', end: event.endTime || '10:00', kind: 'event' as const, calendarId: event.calendarId || 'personal', color: calendars.find((calendar) => calendar.id === (event.calendarId || 'personal'))?.color || '#2563eb' })),
    ].filter((item) => (kindFilter === 'all' || item.kind === kindFilter) && (calendarFilter === 'all' || item.calendarId === calendarFilter));
  };

  const openDay = (date: Date) => {
    setCurrentDate(date);
    setViewMode('day');
    setDayForm(null);
  };

  const addFromDay = () => {
    const name = form.name.trim();
    if (!name) return;
    if (form.endTime <= form.startTime) return window.alert(ro ? 'Ora de final trebuie să fie după ora de început.' : 'End time must be after start time.');
    const date = dateKey(currentDate);
    if (dayForm === 'event') {
      setEvents((current) => [...current, { id: crypto.randomUUID(), name, date, category: 'Personal', color: 'bg-blue-100', startTime: form.startTime, endTime: form.endTime, calendarId: form.calendarId, reminderMinutes: 15 }]);
    } else {
      setTasks((current) => [...current, {
        id: crypto.randomUUID(), name, dueDate: date, startAt: `${date}T${form.startTime}`, endAt: `${date}T${form.endTime}`, completed: false, priority: 'medium', category: 'Personal',
        description: '', groupId: null, calendarId: form.calendarId, reminderMinutes: 15, children: [], comments: [],
      } as Task]);
    }
    setForm({ name: '', startTime: '09:00', endTime: '10:00', calendarId: form.calendarId });
    setDayForm(null);
  };

  const changePeriod = (amount: number) => {
    const next = new Date(currentDate);
    if (viewMode === 'month') next.setMonth(next.getMonth() + amount);
    else if (viewMode === 'week') next.setDate(next.getDate() + amount * 7);
    else next.setDate(next.getDate() + amount);
    setCurrentDate(next);
  };

  const weekDays = () => {
    const monday = new Date(currentDate);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return date;
    });
  };

  const addCalendar = () => {
    const name = newCalendar.trim();
    if (!name) return;
    const calendar = { id: crypto.randomUUID(), name, color: ['#7c3aed', '#ea580c', '#0891b2', '#db2777'][calendars.length % 4] };
    setCalendars((current) => [...current, calendar]);
    setForm((current) => ({ ...current, calendarId: calendar.id }));
    setNewCalendar('');
  };

  const updateCalendar = (id: string, patch: Partial<UserCalendar>) =>
    setCalendars((current) => current.map((calendar) => calendar.id === id ? { ...calendar, ...patch } : calendar));

  const deleteCalendar = (id: string) => {
    if (calendars.length === 1) return window.alert(ro ? 'Trebuie să rămână cel puțin un calendar.' : 'At least one calendar must remain.');
    if (!window.confirm(ro ? 'Ștergi calendarul? Taskurile și evenimentele vor fi mutate.' : 'Delete calendar? Its tasks and events will be moved.')) return;
    const replacement = calendars.find((calendar) => calendar.id !== id)!;
    setTasks((current) => moveCalendarInTree(current, id, replacement.id));
    setEvents((current) => current.map((event) => event.calendarId === id ? { ...event, calendarId: replacement.id } : event));
    setCalendars((current) => current.filter((calendar) => calendar.id !== id));
    if (calendarFilter === id) setCalendarFilter('all');
    if (form.calendarId === id) setForm((current) => ({ ...current, calendarId: replacement.id }));
  };

  const requestAlarms = async () => {
    try {
      await enablePush();
      const alarms: PushAlarm[] = [
        ...flattenTaskTree(tasks).flatMap((task) => {
          const reminder = task.reminderMinutes ?? 15;
          const start = task.startAt || (task.dueDate ? `${task.dueDate}T09:00` : '');
          return start && reminder >= 0 ? [{ id: `task:${task.id}`, title: task.name, body: ro ? 'Taskul începe acum.' : 'Task starts now.', url: '/', scheduledAt: new Date(new Date(start).getTime() - reminder * 60000).toISOString() }] : [];
        }),
        ...events.flatMap((event) => {
          const reminder = event.reminderMinutes ?? 15;
          const start = event.date ? `${event.date}T${event.startTime || '09:00'}` : '';
          return start && reminder >= 0 ? [{ id: `event:${event.id}`, title: event.name, body: ro ? 'Evenimentul începe acum.' : 'Event starts now.', url: '/', scheduledAt: new Date(new Date(start).getTime() - reminder * 60000).toISOString() }] : [];
        }),
      ];
      await syncPushAlarms(alarms);
      window.alert(ro ? 'Alarmele push sunt active.' : 'Push reminders are enabled.');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : (ro ? 'Alarmele nu au putut fi activate.' : 'Could not enable reminders.'));
    }
  };

  const selectedTask = selectedEntry?.kind === 'task' ? flattenTaskTree(tasks).find((task) => task.id === selectedEntry.id) : null;
  const selectedEvent = selectedEntry?.kind === 'event' ? events.find((event) => event.id === selectedEntry.id) : null;

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-4 shadow-md">
        <div className="mb-4 space-y-3 border-b pb-4">
          <div className="grid grid-cols-3 gap-2">
            {(['all', 'task', 'event'] as const).map((kind) => <button key={kind} onClick={() => setKindFilter(kind)} className={`rounded-lg px-3 py-2 font-medium ${kindFilter === kind ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>{kind === 'all' ? (ro ? 'Toate' : 'All') : kind === 'task' ? (ro ? 'Taskuri' : 'Tasks') : (ro ? 'Evenimente' : 'Events')}</button>)}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setCalendarFilter('all')} className={`whitespace-nowrap rounded-full px-3 py-2 ${calendarFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}>{ro ? 'Toate calendarele' : 'All calendars'}</button>
            {calendars.map((calendar) => <button key={calendar.id} onClick={() => setCalendarFilter(calendar.id)} className={`whitespace-nowrap rounded-full border px-3 py-2 ${calendarFilter === calendar.id ? 'text-white' : 'bg-white'}`} style={calendarFilter === calendar.id ? { backgroundColor: calendar.color } : { borderColor: calendar.color }}>{calendar.name}</button>)}
          </div>
          <div className="flex gap-2"><input value={newCalendar} onChange={(e) => setNewCalendar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCalendar()} placeholder={ro ? 'Calendar nou' : 'New calendar'} className="min-w-0 flex-1 rounded-lg border px-3 py-2" /><button onClick={addCalendar} className="rounded-lg bg-blue-600 px-4 text-white"><Plus size={18} /></button></div>
          <div className="space-y-2">{calendars.map((calendar) => <div key={calendar.id} className="flex items-center gap-2 rounded-lg bg-gray-50 p-2"><input type="color" value={calendar.color} onChange={(e) => updateCalendar(calendar.id, { color: e.target.value })} className="h-10 w-12 rounded border" /><input value={calendar.name} onChange={(e) => updateCalendar(calendar.id, { name: e.target.value })} className="min-w-0 flex-1 rounded-lg border px-3 py-2" /><button onClick={() => deleteCalendar(calendar.id)} className="rounded-lg p-2 text-red-600"><Trash2 size={18} /></button></div>)}</div>
        </div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">{currentDate.toLocaleDateString(ro ? 'ro-RO' : 'en-GB', { month: 'long', year: 'numeric', ...(viewMode === 'day' ? { day: 'numeric' } : {}) })}</h2>
          <div className="flex items-center gap-2">
            <button onClick={requestAlarms} className="rounded-lg p-2 hover:bg-gray-100" title={ro ? 'Activează alarmele' : 'Enable alarms'}><Bell /></button>
            <select value={viewMode} onChange={(event) => setViewMode(event.target.value as ViewMode)} className="rounded-lg border px-3 py-2">
              <option value="month">{ro ? 'Lună' : 'Month'}</option>
              <option value="week">{ro ? 'Săptămână' : 'Week'}</option>
              <option value="day">{ro ? 'Zi' : 'Day'}</option>
            </select>
            <button onClick={() => changePeriod(-1)} className="rounded-lg p-2 hover:bg-gray-100"><ChevronLeft /></button>
            <button onClick={() => changePeriod(1)} className="rounded-lg p-2 hover:bg-gray-100"><ChevronRight /></button>
          </div>
        </div>

        {viewMode === 'month' && <MonthCalendar date={currentDate} onDay={openDay} getCount={(date) => itemsForDate(date).length} />}
        {viewMode === 'week' && <TimeGrid days={weekDays()} itemsForDate={itemsForDate} onDay={openDay} onItem={setSelectedEntry} />}
        {viewMode === 'day' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDayForm('event')} className="rounded-lg bg-blue-600 px-4 py-3 text-white"><Plus className="mr-2 inline" size={18} />{ro ? 'Adaugă eveniment' : 'Add event'}</button>
              <button onClick={() => setDayForm('task')} className="rounded-lg bg-green-600 px-4 py-3 text-white"><Plus className="mr-2 inline" size={18} />{ro ? 'Adaugă sarcină' : 'Add task'}</button>
            </div>
            {dayForm && <div className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">{dayForm === 'event' ? (ro ? 'Eveniment nou' : 'New event') : (ro ? 'Sarcină nouă' : 'New task')}</h3><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={ro ? 'Nume' : 'Name'} className="w-full rounded-lg border px-3 py-2" /><div className="grid grid-cols-2 gap-3"><label className="text-sm">{ro ? 'De la' : 'From'}<input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm">{ro ? 'Până la' : 'To'}<input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div><select value={form.calendarId} onChange={(e) => setForm({ ...form, calendarId: e.target.value })} className="w-full rounded-lg border px-3 py-2">{calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}</select><div className="grid grid-cols-2 gap-2"><button onClick={addFromDay} className="rounded-lg bg-blue-600 py-2 text-white">{ro ? 'Salvare' : 'Save'}</button><button onClick={() => setDayForm(null)} className="rounded-lg bg-gray-200 py-2">{ro ? 'Anulare' : 'Cancel'}</button></div></div>}
            <TimeGrid days={[currentDate]} itemsForDate={itemsForDate} onDay={openDay} onItem={setSelectedEntry} />
          </div>
        )}
      </section>
      {(selectedTask || selectedEvent) && (
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/30 p-3">
          <div className="mx-auto mt-10 max-w-lg space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between"><h3 className="text-xl font-bold">{selectedTask ? (ro ? 'Task' : 'Task') : (ro ? 'Eveniment' : 'Event')}</h3><button onClick={() => setSelectedEntry(null)}><X /></button></div>
            {selectedTask ? (
              <>
                <input value={selectedTask.name} onChange={(e) => setTasks((current) => updateTaskTree(current, selectedTask.id, { name: e.target.value }))} className="w-full rounded-lg border px-3 py-3 font-semibold" />
                <label className="block text-sm">{ro ? 'De la' : 'From'}<input type="datetime-local" value={selectedTask.startAt || ''} onChange={(e) => setTasks((current) => updateTaskTree(current, selectedTask.id, { startAt: e.target.value, dueDate: e.target.value.slice(0, 10) }))} className="mt-1 w-full rounded-lg border px-3 py-3" /></label>
                <label className="block text-sm">{ro ? 'Până la' : 'To'}<input type="datetime-local" value={selectedTask.endAt || ''} onChange={(e) => setTasks((current) => updateTaskTree(current, selectedTask.id, { endAt: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-3" /></label>
                <label className="block text-sm">Calendar<select value={selectedTask.calendarId || calendars[0]?.id || ''} onChange={(e) => setTasks((current) => updateTaskTree(current, selectedTask.id, { calendarId: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-3">{calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}</select></label>
                <ReminderSelect value={selectedTask.reminderMinutes ?? 15} ro={ro} onChange={(value) => setTasks((current) => updateTaskTree(current, selectedTask.id, { reminderMinutes: value }))} />
                <button onClick={() => { if (window.confirm(ro ? 'Ștergi taskul?' : 'Delete task?')) { setTasks((current) => deleteTaskTree(current, selectedTask.id)); setSelectedEntry(null); } }} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 py-3 text-red-600"><Trash2 size={18} />{ro ? 'Șterge' : 'Delete'}</button>
              </>
            ) : selectedEvent && (
              <>
                <input value={selectedEvent.name} onChange={(e) => setEvents((current) => current.map((event) => event.id === selectedEvent.id ? { ...event, name: e.target.value } : event))} className="w-full rounded-lg border px-3 py-3 font-semibold" />
                <label className="block text-sm">{ro ? 'Data' : 'Date'}<input type="date" value={selectedEvent.date} onChange={(e) => setEvents((current) => current.map((event) => event.id === selectedEvent.id ? { ...event, date: e.target.value } : event))} className="mt-1 w-full rounded-lg border px-3 py-3" /></label>
                <div className="grid grid-cols-2 gap-3"><label className="text-sm">{ro ? 'De la' : 'From'}<input type="time" value={selectedEvent.startTime || '09:00'} onChange={(e) => setEvents((current) => current.map((event) => event.id === selectedEvent.id ? { ...event, startTime: e.target.value } : event))} className="mt-1 w-full rounded-lg border px-3 py-3" /></label><label className="text-sm">{ro ? 'Până la' : 'To'}<input type="time" value={selectedEvent.endTime || '10:00'} onChange={(e) => setEvents((current) => current.map((event) => event.id === selectedEvent.id ? { ...event, endTime: e.target.value } : event))} className="mt-1 w-full rounded-lg border px-3 py-3" /></label></div>
                <label className="block text-sm">Calendar<select value={selectedEvent.calendarId || calendars[0]?.id || ''} onChange={(e) => setEvents((current) => current.map((event) => event.id === selectedEvent.id ? { ...event, calendarId: e.target.value } : event))} className="mt-1 w-full rounded-lg border px-3 py-3">{calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}</select></label>
                <ReminderSelect value={selectedEvent.reminderMinutes ?? 15} ro={ro} onChange={(value) => setEvents((current) => current.map((event) => event.id === selectedEvent.id ? { ...event, reminderMinutes: value } : event))} />
                <button onClick={() => { if (window.confirm(ro ? 'Ștergi evenimentul?' : 'Delete event?')) { setEvents((current) => current.filter((event) => event.id !== selectedEvent.id)); setSelectedEntry(null); } }} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 py-3 text-red-600"><Trash2 size={18} />{ro ? 'Șterge' : 'Delete'}</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MonthCalendar = ({ date, onDay, getCount }: { date: Date; onDay: (date: Date) => void; getCount: (date: Date) => number }) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
  return <div><div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((name) => <div key={name}>{name}</div>)}</div><div className="grid grid-cols-7 gap-1">{days.map((day) => { const count = getCount(day); return <button key={day.toISOString()} onClick={() => onDay(day)} className={`aspect-square rounded-lg p-1 text-sm ${day.getMonth() === month ? 'bg-gray-50' : 'bg-gray-100 text-gray-400'} hover:ring-2 hover:ring-blue-500`}><span>{day.getDate()}</span>{count > 0 && <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-blue-600" />}</button>; })}</div></div>;
};

const TimeGrid = ({ days, itemsForDate, onDay, onItem }: { days: Date[]; itemsForDate: (date: Date) => Array<{ id: string; name: string; start: string; end: string; kind: 'task' | 'event'; calendarId: string; color: string }>; onDay: (date: Date) => void; onItem: (item: { kind: 'task' | 'event'; id: string }) => void }) => {
  const hourHeight = 72;
  const totalHeight = hourHeight * 24;
  const minutes = (value: string) => {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  };
  return <div className="overflow-x-auto"><div style={{ minWidth: days.length > 1 ? 820 : 320 }}><div className="grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(100px, 1fr))` }}><div />{days.map((day) => <button key={day.toISOString()} onClick={() => onDay(day)} className="border-b p-2 text-center font-semibold text-blue-600">{day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</button>)}</div><div className="grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(100px, 1fr))` }}><div className="relative border-r" style={{ height: totalHeight }}>{Array.from({ length: 24 }, (_, hour) => <span key={hour} className="absolute right-2 text-xs text-gray-400" style={{ top: hour * hourHeight - 7 }}>{String(hour).padStart(2, '0')}:00</span>)}</div>{days.map((day) => <div key={day.toISOString()} className="relative border-r" style={{ height: totalHeight, backgroundImage: 'repeating-linear-gradient(to bottom, #e5e7eb 0, #e5e7eb 1px, transparent 1px, transparent 72px)' }}>{itemsForDate(day).map((item) => { const startMinute = minutes(item.start); const endMinute = Math.max(minutes(item.end), startMinute + 15); const top = startMinute / 60 * hourHeight; const height = Math.max((endMinute - startMinute) / 60 * hourHeight, 20); return <button onClick={() => onItem({ kind: item.kind, id: item.id })} key={item.id} className="absolute left-1 right-1 z-10 overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-xs shadow-sm" style={{ top, height, borderColor: item.color, backgroundColor: `${item.color}22`, color: item.color }}><strong className="block truncate">{item.name}</strong><span>{item.start}–{item.end}</span></button>; })}</div>)}</div></div></div>;
};

const ReminderSelect = ({ value, ro, onChange }: { value: number; ro: boolean; onChange: (value: number) => void }) => (
  <label className="block text-sm"><span className="flex items-center gap-2"><Bell size={18} />{ro ? 'Alarmă' : 'Reminder'}</span><select value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full rounded-lg border px-3 py-3"><option value={-1}>{ro ? 'Fără alarmă' : 'No reminder'}</option><option value={0}>{ro ? 'La ora începerii' : 'At start time'}</option><option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1 h</option><option value={1440}>1 zi</option></select></label>
);

export const Events = () => {
  const { t, i18n } = useTranslation();
  const ro = i18n.language.startsWith('ro');
  const [calendars] = useState<UserCalendar[]>(() => { try { const raw = localStorage.getItem('userCalendars'); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) && parsed.length ? parsed : [{ id: 'personal', name: 'Personal', color: '#2563eb' }]; } catch { return [{ id: 'personal', name: 'Personal', color: '#2563eb' }]; } });
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem('calendarEvents');
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('eventCategories');
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed)
        ? [...new Set([...Object.keys(CATEGORY_COLORS), ...parsed.filter((value): value is string => typeof value === 'string')])]
        : Object.keys(CATEGORY_COLORS);
    } catch {
      return Object.keys(CATEGORY_COLORS);
    }
  });
  const [newCategory, setNewCategory] = useState('');
  const [form, setForm] = useState({ name: '', date: '', startTime: '09:00', endTime: '10:00', category: 'Personal', calendarId: calendars[0]?.id || 'personal', reminderMinutes: 15 });

  useEffect(() => {
    localStorage.setItem('calendarEvents', JSON.stringify(events));
    scheduleCloudBackup();
    void syncAllStoredAlarms().catch(() => undefined);
  }, [events]);

  useEffect(() => {
    localStorage.setItem('eventCategories', JSON.stringify(categories));
    scheduleCloudBackup();
  }, [categories]);

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name || categories.some((category) => category.toLowerCase() === name.toLowerCase())) return;
    setCategories((current) => [...current, name]);
    setForm((current) => ({ ...current, category: name }));
    setNewCategory('');
  };

  const addEvent = () => {
    const name = form.name.trim();
    if (!name || !form.date) return;
    if (form.endTime <= form.startTime) return window.alert(ro ? 'Ora de final trebuie să fie după ora de început.' : 'End time must be after start time.');
    setEvents((current) => [...current, {
      id: crypto.randomUUID(),
      name,
      date: form.date,
      category: form.category,
      color: CATEGORY_COLORS[form.category as keyof typeof CATEGORY_COLORS] || 'bg-gray-100',
      startTime: form.startTime,
      endTime: form.endTime,
      calendarId: form.calendarId,
      reminderMinutes: form.reminderMinutes,
    }]);
    setForm({ name: '', date: '', startTime: '09:00', endTime: '10:00', category: form.category, calendarId: form.calendarId, reminderMinutes: form.reminderMinutes });
  };

  const updateEvent = (id: string, patch: Partial<CalendarEvent>) =>
    setEvents((current) => current.map((event) => event.id === id ? { ...event, ...patch } : event));

  const deleteEvent = (id: string) => {
    if (!window.confirm(ro ? 'Ștergi evenimentul?' : 'Delete this event?')) return;
    setEvents((current) => current.filter((event) => event.id !== id));
  };

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold">{ro ? 'Evenimente' : 'Events'}</h2>
      <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <h3 className="font-semibold">{ro ? 'Eveniment nou' : 'New event'}</h3>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={ro ? 'Nume eveniment' : 'Event name'} className="w-full rounded-lg border px-3 py-3" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-lg border px-3 py-3" />
          <div className="grid grid-cols-2 gap-2"><input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="rounded-lg border px-3 py-3" /><input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="rounded-lg border px-3 py-3" /></div>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-lg border px-3 py-3">{categories.map((category) => <option key={category}>{category}</option>)}</select>
          <select value={form.calendarId} onChange={(e) => setForm({ ...form, calendarId: e.target.value })} className="rounded-lg border px-3 py-3">{calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}</select>
          <ReminderSelect value={form.reminderMinutes} ro={ro} onChange={(value) => setForm({ ...form, reminderMinutes: value })} />
        </div>
        <button onClick={addEvent} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white">{ro ? 'Adaugă eveniment' : 'Add event'}</button>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold">{ro ? 'Categorii' : 'Categories'}</h3>
        <div className="flex gap-2"><input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCategory()} placeholder={ro ? 'Categorie nouă' : 'New category'} className="min-w-0 flex-1 rounded-lg border px-3 py-2" /><button onClick={addCategory} className="rounded-lg bg-blue-600 px-4 text-white"><Plus size={18} /></button></div>
      </section>

      <section className="space-y-3">
        {[...events].sort((a, b) => a.date.localeCompare(b.date)).map((event) => (
          <div key={event.id} className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
            <input value={event.name} onChange={(e) => updateEvent(event.id, { name: e.target.value })} className="w-full rounded border px-3 py-2 font-medium" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input type="date" value={event.date} onChange={(e) => updateEvent(event.id, { date: e.target.value })} className="rounded border px-3 py-2" />
              <div className="grid grid-cols-2 gap-2"><input type="time" value={event.startTime || '09:00'} onChange={(e) => updateEvent(event.id, { startTime: e.target.value })} className="rounded border px-3 py-2" /><input type="time" value={event.endTime || '10:00'} onChange={(e) => updateEvent(event.id, { endTime: e.target.value })} className="rounded border px-3 py-2" /></div>
              <select value={event.category} onChange={(e) => updateEvent(event.id, { category: e.target.value })} className="rounded border px-3 py-2">{categories.map((category) => <option key={category}>{category}</option>)}</select>
              <select value={event.calendarId || calendars[0]?.id || ''} onChange={(e) => updateEvent(event.id, { calendarId: e.target.value })} className="rounded border px-3 py-2">{calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}</select>
              <ReminderSelect value={event.reminderMinutes ?? 15} ro={ro} onChange={(value) => updateEvent(event.id, { reminderMinutes: value })} />
              <button onClick={() => deleteEvent(event.id)} className="flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-red-600"><Trash2 size={18} />{t('delete')}</button>
            </div>
          </div>
        ))}
        {!events.length && <p className="py-10 text-center text-gray-500">{ro ? 'Nu există evenimente.' : 'No events yet.'}</p>}
      </section>
    </div>
  );
};
