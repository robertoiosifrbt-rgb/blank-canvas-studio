import { GoalHeroes } from '../GoalHero'
import { Row, Rows, Section, Tile } from '../parts'
import { MONTHS_L, dayLabel, money, today, ym, zile } from '../format'
import { monthTotals, remainingDebt } from '../goals'
import type { OsData } from '../types'

const DAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă']

export function Today({ data, onGoals, onTick }:
{ data: OsData; onGoals: () => void; onTick: (habitId: string, date: string) => void }) {
  const currency = data.settings.currency
  const key = ym()
  const totals = monthTotals(data, key)
  const day = today()

  const habits = Object.values(data.habits)
  const doneToday = habits.filter(h => h.log?.[day]).length
  const debts = Object.values(data.debts).filter(d => remainingDebt(d) > 0)
  const debtLeft = debts.reduce((sum, d) => sum + remainingDebt(d), 0)
  const tasks = Object.values(data.tasks)
    .filter(t => !t.done && t.due && t.due <= day)
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))
  const soon = debts.filter(d => d.due).sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '')).slice(0, 3)

  const now = new Date()
  const streak = (log: Record<string, number>): number => {
    let n = 0
    const d = new Date()
    const at = () => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
    if (!log[at()]) d.setDate(d.getDate() - 1)
    while (log[at()]) { n++; d.setDate(d.getDate() - 1) }
    return n
  }

  return (
    <>
      <div className="os-head">
        <div>
          <h1>Azi</h1>
          <p>{DAYS[now.getDay()]}, {now.getDate()} {MONTHS_L[now.getMonth()]} {now.getFullYear()}</p>
        </div>
      </div>

      <GoalHeroes data={data} currency={currency} onGoals={onGoals} />

      <div className="os-tiles">
        <Tile label="Balanța lunii" value={money(totals.bal, currency)} sub={MONTHS_L[Number(key.slice(5, 7)) - 1]}
          tone={totals.bal < 0 ? 'bad' : 'good'} lead />
        <Tile label="Cheltuit luna asta" value={money(totals.out, currency)}
          sub={`${data.finance[key]?.items.length ?? 0} mișcări`} />
        <Tile label="Datorii rămase" value={money(debtLeft, currency)}
          sub={debts.length ? `${debts.length} active` : 'nicio datorie'} />
        <Tile label="Obiceiuri azi" value={habits.length ? `${doneToday}/${habits.length}` : '—'}
          sub={habits.length ? (doneToday === habits.length ? 'toate bifate'
            : `${habits.length - doneToday} ${habits.length - doneToday === 1 ? 'rămas' : 'rămase'}`) : 'niciunul definit'}
          tone={habits.length && doneToday === habits.length ? 'good' : undefined} />
      </div>

      {habits.length ? (
        <>
          <Section title="Obiceiuri de bifat" />
          <Rows>
            {habits.map(h => {
              const on = Boolean(h.log?.[day])
              return (
                <div className="os-row" key={h.id}>
                  <button className={`os-chk${on ? ' on' : ''}`} onClick={() => onTick(h.id, day)}
                    aria-label={`Bifează ${h.name}`}>✓</button>
                  <div className="main"><span className="ttl">{h.name}</span></div>
                  <span className="os-streak">{zile(streak(h.log ?? {}))}</span>
                </div>
              )
            })}
          </Rows>
        </>
      ) : null}

      <Section title={tasks.length ? 'De făcut' : 'De făcut — nimic restant'} />
      {tasks.length ? (
        <Rows>
          {tasks.map(t => (
            <Row key={t.id} title={t.title}
              sub={<>{t.proj ? <span className="os-pill">{t.proj}</span> : null}
                {t.due ? <span className="os-pill warn">{dayLabel(t.due)}</span> : null}</>} />
          ))}
        </Rows>
      ) : (
        <div className="os-card pad os-muted">Niciun task scadent azi sau restant.</div>
      )}

      {soon.length ? (
        <>
          <Section title="Scadențe apropiate" />
          <Rows>
            {soon.map(d => {
              const days = Math.round((new Date(`${d.due}T12:00:00`).getTime()
                - new Date(`${day}T12:00:00`).getTime()) / 864e5)
              const cls = days < 0 ? 'bad' : days <= 7 ? 'warn' : 'good'
              return (
                <Row key={d.id} stripe={cls} title={d.name}
                  sub={`${days < 0 ? `restanță de ${zile(Math.abs(days))}`
                    : days === 0 ? 'scadent azi' : `în ${zile(days)}`} · ${dayLabel(d.due ?? '')}`}
                  amount={money(remainingDebt(d), currency)} />
              )
            })}
          </Rows>
        </>
      ) : null}
    </>
  )
}
