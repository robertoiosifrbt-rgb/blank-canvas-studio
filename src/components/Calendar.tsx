import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Task {
  id: string;
  name: string;
  dueDate: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  category: string;
}

interface CalendarEvent {
  id: string;
  name: string;
  date: string;
  category: string;
  color: string;
}

interface Day {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: (Task | CalendarEvent)[];
}

const ROMANIAN_HOLIDAYS = [
  { date: '01-01', name: 'New Year' },
  { date: '01-24', name: 'Unity Day' },
  { date: '05-01', name: 'Labor Day' },
  { date: '12-01', name: 'National Day' },
  { date: '12-25', name: 'Christmas' },
  { date: '12-26', name: 'Christmas' },
];

const CATEGORY_COLORS = {
  Work: 'bg-blue-100 border-blue-300 text-blue-700',
  Personal: 'bg-purple-100 border-purple-300 text-purple-700',
  Shopping: 'bg-pink-100 border-pink-300 text-pink-700',
  Health: 'bg-green-100 border-green-300 text-green-700',
  Travel: 'bg-orange-100 border-orange-300 text-orange-700',
};

type ViewMode = 'month' | 'week' | 'day';

export const Calendar = () => {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem('calendarEvents');
    return saved ? JSON.parse(saved) : [];
  });
  const [eventForm, setEventForm] = useState({
    name: '',
    category: 'Personal',
  });

  useEffect(() => {
    localStorage.setItem('calendarEvents', JSON.stringify(events));
  }, [events]);

  const isHoliday = (date: Date) => {
    const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return ROMANIAN_HOLIDAYS.find((h) => h.date === monthDay);
  };

  const getEventsForDate = (date: Date): (Task | CalendarEvent)[] => {
    const dateStr = date.toISOString().split('T')[0];
    const taskEvents = tasks.filter((t) => t.dueDate === dateStr && !t.completed);
    const calendarEvents = events.filter((e) => e.date === dateStr);
    return [...taskEvents, ...calendarEvents];
  };

  const addEvent = () => {
    if (eventForm.name.trim() && selectedDate) {
      const newEvent: CalendarEvent = {
        id: Date.now().toString(),
        name: eventForm.name,
        date: selectedDate.toISOString().split('T')[0],
        category: eventForm.category,
        color: CATEGORY_COLORS[eventForm.category as keyof typeof CATEGORY_COLORS] || 'bg-gray-100',
      };
      setEvents([...events, newEvent]);
      setEventForm({ name: '', category: 'Personal' });
      setShowEventForm(false);
    }
  };

  const deleteEvent = (id: string) => {
    setEvents(events.filter((e) => e.id !== id));
  };

  const getDaysInMonth = (date: Date): Day[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Day[] = [];
    const today = new Date();

    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dateObj = new Date(year, month, -i);
      days.push({
        date: dateObj,
        isCurrentMonth: false,
        isToday: false,
        events: getEventsForDate(dateObj),
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateObj = new Date(year, month, i);
      const isToday =
        dateObj.getDate() === today.getDate() &&
        dateObj.getMonth() === today.getMonth() &&
        dateObj.getFullYear() === today.getFullYear();
      days.push({
        date: dateObj,
        isCurrentMonth: true,
        isToday,
        events: getEventsForDate(dateObj),
      });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const dateObj = new Date(year, month + 1, i);
      days.push({
        date: dateObj,
        isCurrentMonth: false,
        isToday: false,
        events: getEventsForDate(dateObj),
      });
    }

    return days;
  };

  const getWeekDays = (date: Date): Day[] => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay() + 1);

    const days: Day[] = [];
    for (let i = 0; i < 7; i++) {
      const dateObj = new Date(startOfWeek);
      dateObj.setDate(startOfWeek.getDate() + i);
      days.push({
        date: dateObj,
        isCurrentMonth: true,
        isToday: dateObj.toDateString() === new Date().toDateString(),
        events: getEventsForDate(dateObj),
      });
    }
    return days;
  };

  const getDayDetails = (date: Date): Day => {
    return {
      date,
      isCurrentMonth: true,
      isToday: date.toDateString() === new Date().toDateString(),
      events: getEventsForDate(date),
    };
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handlePrevDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{monthName}</h2>
          <div className="flex gap-2">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="month">📅 Month</option>
              <option value="week">📊 Week</option>
              <option value="day">📄 Day</option>
            </select>
            <button
              onClick={viewMode === 'month' ? handlePrevMonth : viewMode === 'week' ? handlePrevWeek : handlePrevDay}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={viewMode === 'month' ? handleNextMonth : viewMode === 'week' ? handleNextWeek : handleNextDay}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {viewMode === 'month' && <MonthView days={getDaysInMonth(currentDate)} dayNames={dayNames} onDateClick={setSelectedDate} />}

        {viewMode === 'week' && (
          <WeekView
            days={getWeekDays(currentDate)}
            onDateClick={setSelectedDate}
            onShowForm={(date) => {
              setSelectedDate(date);
              setShowEventForm(true);
            }}
          />
        )}

        {viewMode === 'day' && (
          <DayView
            day={getDayDetails(currentDate)}
            onShowForm={() => {
              setSelectedDate(currentDate);
              setShowEventForm(true);
            }}
            onDeleteEvent={deleteEvent}
          />
        )}
      </div>

      {selectedDate && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          {isHoliday(selectedDate) && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 font-medium">
              🎉 {isHoliday(selectedDate)?.name}
            </div>
          )}

          <div className="space-y-3 mb-4">
            {getEventsForDate(selectedDate).map((event) => (
              <div
                key={event.id}
                className={`p-3 rounded-lg border ${
                  CATEGORY_COLORS[event.category as keyof typeof CATEGORY_COLORS] ||
                  'bg-gray-100 border-gray-300 text-gray-700'
                } flex justify-between items-center`}
              >
                <div>
                  <p className="font-medium">{event.name}</p>
                  <p className="text-sm opacity-75">{event.category}</p>
                </div>
                {'dueDate' in event && !event.dueDate ? null : (
                  <button
                    onClick={() => deleteEvent(event.id)}
                    className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {!showEventForm ? (
            <button
              onClick={() => setShowEventForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
            >
              <Plus size={20} />
              {t('add_task')}
            </button>
          ) : (
            <div className="space-y-3 border-t pt-4">
              <input
                type="text"
                placeholder="Event name..."
                value={eventForm.name}
                onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={eventForm.category}
                onChange={(e) => setEventForm({ ...eventForm, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.keys(CATEGORY_COLORS).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={addEvent}
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
                >
                  {t('save')}
                </button>
                <button
                  onClick={() => setShowEventForm(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MonthView = ({
  days,
  dayNames,
  onDateClick,
}: {
  days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean; events: any[] }>;
  dayNames: string[];
  onDateClick: (date: Date) => void;
}) => {
  return (
    <>
      <div className="grid grid-cols-7 gap-2 mb-2">
        {dayNames.map((day) => (
          <div key={day} className="text-center font-semibold text-gray-600 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => (
          <button
            key={index}
            onClick={() => onDateClick(day.date)}
            className={`aspect-square flex flex-col items-center justify-start p-2 rounded-lg text-sm font-medium transition cursor-pointer ${
              day.isToday
                ? 'bg-blue-500 text-white'
                : day.isCurrentMonth
                  ? 'bg-gray-50 hover:bg-gray-100'
                  : 'bg-gray-100 text-gray-400'
            }`}
          >
            <span>{day.date.getDate()}</span>
            {day.events.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap justify-center">
                {day.events.slice(0, 2).map((event, i) => (
                  <div key={i} className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                ))}
                {day.events.length > 2 && <span className="text-xs">+{day.events.length - 2}</span>}
              </div>
            )}
          </button>
        ))}
      </div>
    </>
  );
};

const WeekView = ({
  days,
  onDateClick,
  onShowForm,
}: {
  days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean; events: any[] }>;
  onDateClick: (date: Date) => void;
  onShowForm: (date: Date) => void;
}) => {
  return (
    <div className="space-y-3">
      {days.map((day, i) => (
        <div key={i} className="flex gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer">
          <div className="w-24 flex-shrink-0">
            <p className="font-semibold text-blue-600">{day.date.toLocaleDateString('en-US', { weekday: 'short' })}</p>
            <p className="text-2xl font-bold">{day.date.getDate()}</p>
          </div>
          <div className="flex-1 space-y-2">
            {day.events.map((event) => (
              <div key={event.id} className="text-sm bg-white p-2 rounded border-l-4 border-blue-500">
                {event.name}
              </div>
            ))}
            {day.events.length === 0 && <p className="text-gray-400 text-sm">No events</p>}
            <button
              onClick={() => onShowForm(day.date)}
              className="text-blue-500 hover:text-blue-700 text-sm font-medium"
            >
              + Add event
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const DayView = ({
  day,
  onShowForm,
  onDeleteEvent,
}: {
  day: { date: Date; isCurrentMonth: boolean; isToday: boolean; events: any[] };
  onShowForm: () => void;
  onDeleteEvent: (id: string) => void;
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold">
        {day.date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </h3>

      <div className="space-y-2">
        {day.events.map((event) => (
          <div key={event.id} className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-lg">{event.name}</p>
                <p className="text-sm text-gray-600">{event.category}</p>
              </div>
              <button
                onClick={() => onDeleteEvent(event.id)}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {day.events.length === 0 && <p className="text-gray-500 text-center py-8">No events scheduled</p>}

      <button
        onClick={onShowForm}
        className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
      >
        <Plus size={20} />
        Add event
      </button>
    </div>
  );
};
