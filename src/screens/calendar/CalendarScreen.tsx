import { useState } from 'react'

import { forCalendar } from '../../repository/items'
import type { CalendarDay, Item } from '../../repository/items'
import { useScreen } from '../../items/context'
import { formatMonth, formatWeekday, monthOf, shiftMonth } from '../../ui/dates'
import { ItemRow } from '../../ui/ItemRow'
import { monthGrid, openingDay } from './month'
import './CalendarScreen.css'

/** Monday first, the way the week is read here. */
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/**
 * The month, and the day you picked out of it.
 *
 * The grid answers "where am I" at a glance and opens on the month you are in,
 * so today never sinks below a pile of past days. The day below answers "what
 * then": what you planned for it, and what you did on it.
 *
 * A task due Monday and finished Wednesday appears on both. A task with no
 * date, finished, appears on Wednesday — that is why done_at exists, so that
 * nothing finished disappears from every screen. Nothing is dropped here
 * either: every past day stays one tap back through the month.
 */
export function CalendarScreen() {
  const { data, openItem, today } = useScreen()
  const days = forCalendar(data.items)

  const [month, setMonth] = useState(() => monthOf(today))
  const [selected, setSelected] = useState(today)

  const step = (by: number) => {
    const next = shiftMonth(month, by)
    setMonth(next)
    setSelected(openingDay(next, today))
  }

  const chosen: CalendarDay | undefined = days.find((day) => day.day === selected)

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

      <div className="month-head">
        <button
          className="month-step"
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous month"
        >
          ‹
        </button>
        <h2 className="month-title">{formatMonth(month)}</h2>
        <button
          className="month-step"
          type="button"
          onClick={() => step(1)}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="month-grid">
        {WEEKDAYS.map((name) => (
          <span className="month-weekday" key={name}>
            {name}
          </span>
        ))}

        {monthGrid(month, days).flat().map((cell) => (
          <button
            className={[
              'month-cell',
              cell.inMonth ? '' : 'month-cell-outside',
              cell.day === today ? 'month-cell-today' : '',
              cell.day === selected ? 'month-cell-picked' : '',
            ]
              .filter((part) => part !== '')
              .join(' ')}
            type="button"
            key={cell.day}
            onClick={() => setSelected(cell.day)}
            aria-pressed={cell.day === selected}
          >
            <span className="month-date">{Number(cell.day.slice(8))}</span>
            <span className="month-marks">
              {cell.planned > 0 && <span className="month-mark" />}
              {cell.done > 0 && <span className="month-mark month-mark-done" />}
            </span>
          </button>
        ))}
      </div>

      <section className={`day${selected === today ? ' day-today' : ''}`}>
        <h2 className="day-heading">{formatWeekday(selected, today)}</h2>

        {chosen !== undefined && chosen.planned.length > 0 && (
          <div className="day-part">
            <h3 className="day-part-heading">Planned</h3>
            {rows(chosen.planned)}
          </div>
        )}

        {chosen !== undefined && chosen.done.length > 0 && (
          <div className="day-part">
            <h3 className="day-part-heading">Done</h3>
            {rows(chosen.done)}
          </div>
        )}

        {chosen === undefined && (
          <p className="calendar-note">
            Nothing on this day. A date on a task, or a task ticked off, puts it
            here.
          </p>
        )}
      </section>
    </div>
  )
}
