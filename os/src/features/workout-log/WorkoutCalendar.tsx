import {
  WEEKDAY_LABELS,
  dayLabel,
  monthGrid,
  monthLabel,
  shiftMonth,
} from './calendarMonth'

interface WorkoutCalendarProps {
  /** `YYYY-MM`. */
  month: string
  /** Days with at least one session, as `YYYY-MM-DD`. */
  trainedDays: Set<string>
  /** The day being filtered on, or `''` for the whole month. */
  selected: string
  today: string
  onMonthChange: (month: string) => void
  /** Called with the day tapped, or `''` when tapping the selected day again. */
  onSelect: (date: string) => void
}

/**
 * The month at a glance: which days you trained, and a way to pick one.
 *
 * Only days inside the month are tappable. The days either side are there to
 * keep the weeks square and are shown faint — tapping one would jump the month
 * out from under your finger.
 */
export function WorkoutCalendar({
  month,
  trainedDays,
  selected,
  today,
  onMonthChange,
  onSelect,
}: WorkoutCalendarProps) {
  const days = monthGrid(month)
  const label = monthLabel(month)

  return (
    <section className="workout-calendar" aria-label="Workout calendar">
      <header className="workout-calendar-head">
        <button
          type="button"
          className="workout-calendar-step"
          aria-label="Previous month"
          onClick={() => onMonthChange(shiftMonth(month, -1))}
        >
          ‹
        </button>
        <strong aria-live="polite">{label}</strong>
        <button
          type="button"
          className="workout-calendar-step"
          aria-label="Next month"
          onClick={() => onMonthChange(shiftMonth(month, 1))}
        >
          ›
        </button>
      </header>

      <div className="workout-calendar-weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="workout-calendar-grid">
        {days.map((day) => {
          if (!day.inMonth) {
            return (
              <span className="workout-calendar-day is-outside" key={day.date} aria-hidden="true">
                {day.dayOfMonth}
              </span>
            )
          }

          const trained = trainedDays.has(day.date)
          const isSelected = day.date === selected
          const classes = [
            'workout-calendar-day',
            trained ? 'is-trained' : '',
            day.date === today ? 'is-today' : '',
            isSelected ? 'is-selected' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              type="button"
              key={day.date}
              className={classes}
              aria-pressed={isSelected}
              aria-label={`${dayLabel(day.date)}${trained ? ', trained' : ''}`}
              onClick={() => onSelect(isSelected ? '' : day.date)}
            >
              {day.dayOfMonth}
            </button>
          )
        })}
      </div>
    </section>
  )
}
