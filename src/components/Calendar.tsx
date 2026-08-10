import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Task {
  id: string;
  name: string;
  dueDate: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  category: string;
  startAt?: string;
  endAt?: string;
}

interface CalendarEvent {
  id: string;
  name: string;
  date: string;
  category: string;
  color: string;
  startTime: string;
  endTime: string;
}



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
  const [form, setForm] = useState({ name: '', startTime: '09:00', endTime: '10:00' });
  const [tasks, setTasks] = useState<Task[]>(() => {
    try { const raw = localStorage.getItem('tasks'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try { const raw = localStorage.getItem('calendarEvents'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });

  useEffect(() => { localStorage.setItem('tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('calendarEvents', JSON.stringify(events)); }, [events]);

  const dateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const itemsForDate = (date: Date) => {
    const key = dateKey(date);
    const taskItems = tasks.filter((task) => (task.startAt?.slice(0, 10) || task.dueDate) === key);
    const eventItems = events.filter((event) => event.date === key);
    return [
      ...taskItems.map((task) => ({ id: task.id, name: task.name, start: task.startAt?.slice(11, 16) || '09:00', end: task.endAt?.slice(11, 16) || '10:00', kind: 'task' as const })),
      ...eventItems.map((event) => ({ id: event.id, name: event.name, start: event.startTime || '09:00', end: event.endTime || '10:00', kind: 'event' as const })),
    ];
  };

  const openDay = (date: Date) => {
    setCurrentDate(date);
    setViewMode('day');
    setDayForm(null);
  };

  const addFromDay = () => {
    const name = form.name.trim();
    if (!name) return;
    const date = dateKey(currentDate);
    if (dayForm === 'event') {
      setEvents((current) => [...current, { id: crypto.randomUUID(), name, date, category: 'Personal', color: 'bg-blue-100', startTime: form.startTime, endTime: form.endTime }]);
    } else {
      setTasks((current) => [...current, {
        id: crypto.randomUUID(), name, dueDate: date, startAt: `${date}T${form.startTime}`, endAt: `${date}T${form.endTime}`, completed: false, priority: 'medium', category: 'Personal',
        description: '', groupId: null, children: [], comments: [],
      } as Task]);
    }
    setForm({ name: '', startTime: '09:00', endTime: '10:00' });
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

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-4 shadow-md">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">{currentDate.toLocaleDateString(ro ? 'ro-RO' : 'en-GB', { month: 'long', year: 'numeric', ...(viewMode === 'day' ? { day: 'numeric' } : {}) })}</h2>
          <div className="flex items-center gap-2">
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
        {viewMode === 'week' && <TimeGrid days={weekDays()} itemsForDate={itemsForDate} onDay={openDay} />}
        {viewMode === 'day' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDayForm('event')} className="rounded-lg bg-blue-600 px-4 py-3 text-white"><Plus className="mr-2 inline" size={18} />{ro ? 'Adaugă eveniment' : 'Add event'}</button>
              <button onClick={() => setDayForm('task')} className="rounded-lg bg-green-600 px-4 py-3 text-white"><Plus className="mr-2 inline" size={18} />{ro ? 'Adaugă sarcină' : 'Add task'}</button>
            </div>
            {dayForm && <div className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">{dayForm === 'event' ? (ro ? 'Eveniment nou' : 'New event') : (ro ? 'Sarcină nouă' : 'New task')}</h3><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={ro ? 'Nume' : 'Name'} className="w-full rounded-lg border px-3 py-2" /><div className="grid grid-cols-2 gap-3"><label className="text-sm">{ro ? 'De la' : 'From'}<input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm">{ro ? 'Până la' : 'To'}<input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div><div className="grid grid-cols-2 gap-2"><button onClick={addFromDay} className="rounded-lg bg-blue-600 py-2 text-white">{ro ? 'Salvare' : 'Save'}</button><button onClick={() => setDayForm(null)} className="rounded-lg bg-gray-200 py-2">{ro ? 'Anulare' : 'Cancel'}</button></div></div>}
            <TimeGrid days={[currentDate]} itemsForDate={itemsForDate} onDay={openDay} />
          </div>
        )}
      </section>
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

const TimeGrid = ({ days, itemsForDate, onDay }: { days: Date[]; itemsForDate: (date: Date) => Array<{ id: string; name: string; start: string; end: string; kind: 'task' | 'event' }>; onDay: (date: Date) => void }) => {
  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  return <div className="overflow-x-auto"><div style={{ minWidth: days.length > 1 ? 760 : 320 }}><div className="grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(96px, 1fr))` }}><div /><>{days.map((day) => <button key={day.toISOString()} onClick={() => onDay(day)} className="border-b p-2 text-center font-semibold text-blue-600">{day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</button>)}</></div>{hours.map((hour) => <div key={hour} className="grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(96px, 1fr))` }}><div className="border-r border-t pr-2 pt-1 text-right text-xs text-gray-400">{String(hour).padStart(2, '0')}:00</div>{days.map((day) => { const entries = itemsForDate(day).filter((item) => Number(item.start.slice(0,2)) === hour); return <div key={day.toISOString()} className="min-h-16 border-r border-t p-1">{entries.map((item) => <div key={item.id} className={`mb-1 rounded px-2 py-1 text-xs ${item.kind === 'event' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}><strong className="block truncate">{item.name}</strong><span>{item.start}–{item.end}</span></div>)}</div>; })}</div>)}</div></div>;
};

export const Events = () => {
  const { t, i18n } = useTranslation();
  const ro = i18n.language.startsWith('ro');
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
  const [form, setForm] = useState({ name: '', date: '', startTime: '09:00', endTime: '10:00', category: 'Personal' });

  useEffect(() => {
    localStorage.setItem('calendarEvents', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('eventCategories', JSON.stringify(categories));
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
    setEvents((current) => [...current, {
      id: crypto.randomUUID(),
      name,
      date: form.date,
      category: form.category,
      color: CATEGORY_COLORS[form.category as keyof typeof CATEGORY_COLORS] || 'bg-gray-100',
      startTime: form.startTime,
      endTime: form.endTime,
    }]);
    setForm({ name: '', date: '', startTime: '09:00', endTime: '10:00', category: form.category });
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
              <button onClick={() => deleteEvent(event.id)} className="flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-red-600"><Trash2 size={18} />{t('delete')}</button>
            </div>
          </div>
        ))}
        {!events.length && <p className="py-10 text-center text-gray-500">{ro ? 'Nu există evenimente.' : 'No events yet.'}</p>}
      </section>
    </div>
  );
};


