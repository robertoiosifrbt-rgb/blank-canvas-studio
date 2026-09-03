import { Empty, Row, Rows, Section, Tile } from '../parts'
import { money, num, zile } from '../format'
import { paidDebt, remainingDebt } from '../goals'
import type { Debt, OsData } from '../types'

export function Debts({ data, onAdd, onPay, onDelete }: {
  data: OsData
  onAdd: () => void
  onPay: (d: Debt) => void
  onDelete: (d: Debt) => void
}) {
  const currency = data.settings.currency
  const all = Object.values(data.debts)
  const active = all.filter(d => remainingDebt(d) > 0)
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
  const closed = all.filter(d => remainingDebt(d) <= 0)
  const left = active.reduce((sum, d) => sum + remainingDebt(d), 0)
  const total = all.reduce((sum, d) => sum + num(d.total), 0)
  const paid = all.reduce((sum, d) => sum + paidDebt(d), 0)

  return (
    <>
      <div className="os-head">
        <div>
          <h1>Datorii</h1>
          <p>Fiecare plată se scade din rest. Vezi mereu cât mai ai de dat.</p>
        </div>
        <button className="os-btn" onClick={onAdd}>Datorie nouă</button>
      </div>

      {all.length ? (
        <div className="os-tiles">
          <Tile label="Rest de plată" value={money(left, currency)} lead tone={left ? 'bad' : 'good'}
            sub={`${active.length} ${active.length === 1 ? 'datorie activă' : 'datorii active'}`} />
          <Tile label="Achitat" value={money(paid, currency)}
            sub={total ? `${Math.round((paid / total) * 100)}% din total` : undefined} />
          <Tile label="Total contractat" value={money(total, currency)} sub={`${all.length} în evidență`} />
        </div>
      ) : null}

      <Section title="Active" />
      {active.length ? (
        <Rows>
          {active.map(d => {
            const days = d.due ? Math.round((new Date(`${d.due}T12:00:00`).getTime() - Date.now()) / 864e5) : null
            const cls = days === null ? undefined : days < 0 ? 'bad' : days <= 14 ? 'warn' : 'good'
            const when = days === null ? 'fără scadență'
              : days < 0 ? `restanță de ${zile(Math.abs(days))}`
              : days === 0 ? 'scadent azi' : `scadent în ${zile(days)}`
            const pct = num(d.total) ? (paidDebt(d) / num(d.total)) * 100 : 0
            return (
              <div className="os-row" key={d.id}>
                {cls ? <span className={`os-stripe ${cls}`} /> : null}
                <div className="main">
                  <span className="ttl">{d.name}</span>
                  <span className="sub">achitat {money(paidDebt(d), currency)} din {money(num(d.total), currency)} · {when}</span>
                  <span className="os-prog" style={{ marginTop: 6, maxWidth: 280 }}>
                    <i className={cls} style={{ width: `${pct}%` }} />
                  </span>
                </div>
                <span className="amt">{money(remainingDebt(d), currency)}</span>
                <button className="os-btn ghost sm" onClick={() => onPay(d)}>Plată</button>
                <button className="os-icon del" onClick={() => onDelete(d)} aria-label="Șterge">🗑</button>
              </div>
            )
          })}
        </Rows>
      ) : (
        <Empty title={all.length ? 'Nicio datorie activă — toate achitate' : 'Nicio datorie înregistrată'}
          text={all.length ? 'Felicitări. Când apare una nouă, o adaugi aici.'
            : 'Adaugă o datorie cu suma totală și scadența. Pe măsură ce plătești, vezi cât ți-a mai rămas.'}
          action={<button className="os-btn" onClick={onAdd}>Adaugă o datorie</button>} />
      )}

      {closed.length ? (
        <>
          <Section title="Achitate" />
          <Rows>
            {closed.map(d => (
              <Row key={d.id} stripe="good" title={d.name}
                sub={`achitat integral · ${money(num(d.total), currency)}`}
                action={<button className="os-icon del" onClick={() => onDelete(d)} aria-label="Șterge">🗑</button>} />
            ))}
          </Rows>
        </>
      ) : null}
    </>
  )
}
