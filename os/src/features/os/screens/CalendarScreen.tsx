import { Section } from '../parts'
import { MONTHS_L, WEEK, dayLabel, money, today, ym } from '../format'
import { LAYERS, dayDots, dayItems, isToday, keepLayers, monthGrid } from '../calendar'
import type { DayKind } from '../calendar'
import type { OsData } from '../types'

export function CalendarScreen({ data, month, day, hidden, onMonth, onDay, onLayer, onAddTask, onGoto }: {
  data: OsData
  month: string
  day: string
  /** Straturile debifate. Goale înseamnă că se vede tot. */
  hidden: DayKind[]
  onMonth: (key: string) => void
  onDay: (date: string) => void
  onLayer: (kind: DayKind) => void
  onAddTask: () => void
  onGoto: (mod: string) => void
}) {
  const currency = data.settings.currency
  const index = Number(month.slice(5, 7)) - 1
  const cells = monthGrid(month)
  const items = keepLayers(dayItems(data, day), hidden)

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

      {/* Straturile: bifate se văd, debifate dispar și din puncte, și din listă. */}
      <div className="os-chips" style={{ marginBottom: 12 }}>
        {LAYERS.map(layer => (
          <button key={layer.kind}
            className={`os-chip${hidden.includes(layer.kind) ? '' : ' on'}`}
            onClick={() => onLayer(layer.kind)}>{layer.name}</button>
        ))}
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
                {dayDots(data, cell.date, hidden).map(c => <i className={c} key={c} />)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Section title={dayLabel(day) === 'azi' ? 'Azi' : dayLabel(day)} />
      {items.length ? (
        <div className="os-cal-list">
          {items.map((item, i) => (
            <div className="os-card pad os-cal-item" key={i}>
              <span className={`os-stripe ${item.cls}`} />
              <div className="main">
                <span className="ttl">{item.title}</span>
                <span className="sub">{item.sub}</span>
                {/* Ce-ți trebuie ca să acționezi, aici, nu în alt ecran. */}
                {item.lines?.map(line => <span className="os-muted" key={line}>{line}</span>)}
                {item.goto ? (
                  <button className="os-btn ghost sm" onClick={() => onGoto(item.goto as string)}>Deschide</button>
                ) : null}
              </div>
              {item.amount !== undefined ? (
                <span className={`amt${item.inflow ? ' good' : ''}`}>
                  {item.inflow ? '+' : ''}{money(item.amount, currency).replace('−', '')}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="os-card pad os-muted">
          {hidden.length ? 'Nimic în ziua asta din ce ai bifat.' : 'Nimic în ziua asta.'}
        </div>
      )}
    </>
  )
}
