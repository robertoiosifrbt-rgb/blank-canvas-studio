import { Row, Rows, Section, Tile } from '../parts'
import { MONTHS, MONTHS_L, dayLabel, money, num, ym } from '../format'
import { monthTotals } from '../goals'
import type { OsData } from '../types'

export function Finance({ data, month, onMonth, onAdd, onDelete }: {
  data: OsData
  month: string
  onMonth: (key: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  const currency = data.settings.currency
  const totals = monthTotals(data, month)
  const items = [...(data.finance[month]?.items ?? [])].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  const index = Number(month.slice(5, 7)) - 1

  const shift = (by: number) => {
    const d = new Date(`${month}-01T12:00:00`)
    d.setMonth(d.getMonth() + by)
    onMonth(d.toISOString().slice(0, 7))
  }

  const keys: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(`${month}-01T12:00:00`)
    d.setMonth(d.getMonth() - i)
    keys.push(d.toISOString().slice(0, 7))
  }
  const series = keys.map(k => monthTotals(data, k))
  const max = Math.max(1, ...series.map(s => Math.max(s.inc, s.out)))

  const byCat: Record<string, number> = {}
  for (const item of items) if (item.type === 'out') byCat[item.cat ?? 'Altele'] = (byCat[item.cat ?? 'Altele'] ?? 0) + num(item.amount)
  const cats = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a])

  return (
    <>
      <div className="os-head">
        <div>
          <h1>Finanțe</h1>
          <p>Cheltuielile stau grupate pe luni — o fișă pe lună, oricâte mișcări.</p>
        </div>
        <button className="os-btn" onClick={onAdd}>Mișcare nouă</button>
      </div>

      <div className="os-cal-bar">
        <button className="os-btn ghost sm" onClick={() => shift(-1)}>‹</button>
        <b>{MONTHS_L[index]} {month.slice(0, 4)}</b>
        <button className="os-btn ghost sm" onClick={() => shift(1)}>›</button>
        {month !== ym() ? <button className="os-btn ghost sm" onClick={() => onMonth(ym())}>Luna curentă</button> : null}
      </div>

      <div className="os-tiles">
        <Tile label="Venituri" value={money(totals.inc, currency)} tone="good" />
        <Tile label="Cheltuieli" value={money(totals.out, currency)} tone="bad" />
        <Tile label="Balanță" value={money(totals.bal, currency)} lead
          sub={totals.bal >= 0 ? 'ai rămas pe plus' : 'ai ieșit pe minus'}
          tone={totals.bal < 0 ? 'bad' : 'good'} />
      </div>

      {series.some(s => s.inc || s.out) ? (
        <>
          <Section title="Ultimele 6 luni" />
          <div className="os-card pad">
            <div className="os-bars">
              {keys.map((k, i) => (
                <div className="b" key={k}>
                  <div className="pair">
                    <i className="in" style={{ height: `${(series[i].inc / max) * 100}%` }} />
                    <i className="out" style={{ height: `${(series[i].out / max) * 100}%` }} />
                  </div>
                  <em>{MONTHS[Number(k.slice(5, 7)) - 1]}</em>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {cats.length ? (
        <>
          <Section title="Pe categorii" />
          <Rows>
            {cats.map(cat => {
              const pct = totals.out ? (byCat[cat] / totals.out) * 100 : 0
              return (
                <div className="os-row" key={cat}>
                  <div className="main">
                    <span className="ttl">{cat}</span>
                    <span className="os-prog" style={{ marginTop: 5, maxWidth: 260 }}>
                      <i style={{ width: `${pct}%` }} />
                    </span>
                  </div>
                  <span className="sub">{pct.toFixed(0)}%</span>
                  <span className="amt">{money(byCat[cat], currency)}</span>
                </div>
              )
            })}
          </Rows>
        </>
      ) : null}

      <Section title={`Mișcări în ${MONTHS_L[index]}`} />
      {items.length ? (
        <Rows>
          {items.map(item => (
            <Row key={item.id} stripe={item.type === 'in' ? 'good' : 'bad'}
              title={item.note || (item.type === 'in' ? 'Venit' : 'Cheltuială')}
              sub={`${item.cat ?? 'Altele'} · ${dayLabel(item.date)}`}
              amount={`${item.type === 'in' ? '+' : '−'}${money(num(item.amount), currency).replace('−', '')}`}
              tone={item.type === 'in' ? 'good' : undefined}
              action={<button className="os-icon del" onClick={() => onDelete(item.id)} aria-label="Șterge">🗑</button>} />
          ))}
        </Rows>
      ) : (
        <div className="os-card pad os-muted">Nicio mișcare în {MONTHS_L[index]}.</div>
      )}
    </>
  )
}
