import { forCalendar } from '../../repository/items'
import type { Item } from '../../repository/items'
import { useScreen } from '../../items/context'
import { formatWeekday } from '../../ui/dates'
import { ItemRow } from '../../ui/ItemRow'
import './CalendarScreen.css'

/**
 * The days, with what you planned and what you did. No new table.
 *
 * A task due Monday and finished Wednesday appears in both. A task with no
 * date, finished, appears on Wednesday — so nothing finished disappears from
 * every screen.
 */
export function CalendarScreen() {
  const { data, openItem, today } = useScreen()
  const days = forCalendar(data.items)

  const unsavedFor = (item: Item) =>
    data.unsaved.find((u) => u.item.id === item.id)?.reason

  const rows = (items: Item[]) => (
    <ul className="day-list">
      {items.map((item) => (
        <li key={item.id}>
          <ItemRow
            item={item}
            today={today}
            unsaved={unsavedFor(item)}
            onOpen={openItem}
          />
        </li>
      ))}
    </ul>
  )

  return (
    <div className="calendar">
      {data.loading && <p className="calendar-note">Loading…</p>}

      {!data.loading && days.length === 0 && (
        <p className="calendar-note">
          No days yet. A date on a task, or a task ticked off, puts one here.
        </p>
      )}

      {days.map((day) => (
        <section
          className={`day${day.day === today ? ' day-today' : ''}`}
          key={day.day}
        >
          <h2 className="day-heading">{formatWeekday(day.day, today)}</h2>

          {day.planned.length > 0 && (
            <div className="day-part">
              <h3 className="day-part-heading">Planned</h3>
              {rows(day.planned)}
            </div>
          )}

          {day.done.length > 0 && (
            <div className="day-part">
              <h3 className="day-part-heading">Done</h3>
              {rows(day.done)}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
