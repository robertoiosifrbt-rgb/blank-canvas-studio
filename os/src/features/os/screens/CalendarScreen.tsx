import { Rows, Row, Section } from '../parts'
import { MONTHS_L, WEEK, dayLabel, money, today, ym } from '../format'
import { dayDots, dayItems, isToday, monthGrid } from '../calendar'
import type { OsData } from '../types'

export function CalendarScreen({ data, month, day, onMonth, onDay, onAddTask }: {
  data: OsData
  month: string
  day: string
  onMonth: (key: string) => void
  onDay: (date: string) => void
  onAddTask: () => void
}) {
  const currency = data.settings.currency
  const index = Number(month.slice(5, 7)) - 1
  const cells = monthGrid(month)
  const items = dayItems(data, day)

  const shift = (by: number) => {
    const d = new Date(`${month}-01T12:00:00`)
    d.setMonth(d.getMonth() + by)
    onMonth(d.toISOString().slice(0, 7))
  }

  return (
    <>
      <div className="os-head">
        <div>
          <h1>Calendar</h1>
          <p>Tot ce ai în aplicație, așezat pe zile.</p>
        </div>
        <button className="os-btn" onClick={onAddTask}>Task nou</button>
      </div>

      <div className="os-cal-bar">
        <button className="os-btn ghost sm" onClick={() => shift(-1)} aria-label="Luna anterioară">‹</button>
        <b>{MONTHS_L[index]} {month.slice(0, 4)}</b>
        <button className="os-btn ghost sm" onClick={() => shift(1)} aria-label="Luna următoare">›</button>
        {month !== ym() ? (
          <button className="os-btn ghost sm" onClick={() => { onMonth(ym()); onDay(today()) }}>Azi</button>
        ) : null}
      </div>

      <div className="os-cal os-card">
        <div className="os-cal-week">{WEEK.map(d => <span key={d}>{d}</span>)}</div>
        <div className="os-cal-grid">
          {cells.map(cell => (
            <button key={cell.date}
              className={`os-cal-day${cell.inMonth ? '' : ' out'}${cell.date === day ? ' sel' : ''}${isToday(cell.date) ? ' azi' : ''}`}
              onClick={() => { onDay(cell.date); if (cell.date.slice(0, 7) !== month) onMonth(cell.date.slice(0, 7)) }}>
              <em>{cell.day}</em>
              <span className="dots">
                {dayDots(data, cell.date).map(c => <i className={c} key={c} />)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Section title={dayLabel(day) === 'azi' ? 'Azi' : dayLabel(day)} />
      {items.length ? (
        <Rows>
          {items.map((item, i) => (
            <Row key={i} stripe={item.cls} title={item.title} sub={item.sub}
              amount={item.amount !== undefined
                ? `${item.inflow ? '+' : ''}${money(item.amount, currency).replace('−', '')}` : undefined}
              tone={item.inflow ? 'good' : undefined} />
          ))}
        </Rows>
      ) : (
        <div className="os-card pad os-muted">Nimic în ziua asta.</div>
      )}
    </>
  )
}
