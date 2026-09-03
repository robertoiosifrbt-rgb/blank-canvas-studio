import { Pill, Ring } from './parts'
import { anchors, current, facts, formatValue, hasTarget, isMetric, percent, status } from './goals'
import { dayLabel, num } from './format'
import type { Goal, OsData } from './types'

/** Panoul unei ancore. Pe „Azi" ține doar esențialul; pe Goals, tot. */
export function GoalHero({ data, goal, currency, actions, onEdit }:
{ data: OsData; goal: Goal; currency: string; actions?: boolean; onEdit?: () => void }) {
  const ready = hasTarget(goal)
  const state = status(data, goal, true)
  const pct = percent(goal)
  const shown = facts(data, goal, true, currency).slice(0, actions ? 99 : 2)

  return (
    <div className="os-hero">
      <div className="os-hero-main">
        <Ring percent={pct} ready={ready} />
        <div className="os-hero-txt">
          <span className="os-hero-name">
            {goal.name}
            {state ? <Pill tone={state.cls}>{state.text}</Pill> : null}
          </span>
          {ready ? (
            <>
              <span className="cur">{formatValue(goal, current(goal), currency)}</span>
              <span className="of">
                {isMetric(goal) ? '→ ' : 'din '}
                {formatValue(goal, num(goal.target), currency)}
                {goal.due ? ` · până în ${dayLabel(goal.due)}` : ''}
              </span>
            </>
          ) : (
            <span className="of">Pune punctul de plecare și ținta, ca să-ți pot urmări progresul.</span>
          )}
        </div>
      </div>

      {!ready && onEdit ? (
        <div><button className="os-btn sm" onClick={onEdit}>Completează</button></div>
      ) : null}

      {ready && shown.length ? (
        <div className="os-hero-facts">
          {shown.map(f => (
            <div key={f.key}><b>{f.value}</b><span>{f.key}</span></div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function GoalHeroes({ data, currency, onGoals }:
{ data: OsData; currency: string; onGoals: () => void }) {
  const list = anchors(data)
  if (!list.length) {
    return (
      <button className="os-strip" onClick={onGoals}>
        <span className="lbl">Obiective</span>
        <span className="os-strip-note">Niciunul stabilit — pune țintele în jurul cărora se învârte tot.</span>
        <span className="v">Stabilește →</span>
      </button>
    )
  }
  return (
    <div className="os-heroes">
      {list.map(g => <GoalHero key={g.id} data={data} goal={g} currency={currency} />)}
    </div>
  )
}

/** Banda subțire care ține ancorele la vedere pe celelalte ecrane. */
export function GoalStrips({ data, onGoals }: { data: OsData; onGoals: () => void }) {
  const list = anchors(data)
  if (!list.length) return null
  return (
    <div className="os-strips">
      {list.map(g => {
        const pct = percent(g)
        return (
          <button className="os-strip" key={g.id} onClick={onGoals} title={g.name}>
            <span className="lbl">{g.name}</span>
            <span className="os-prog"><i style={{ width: `${Math.max(pct, 0.8)}%` }} /></span>
            <span className="v">{hasTarget(g) ? `${pct.toFixed(0)}%` : 'de completat'}</span>
          </button>
        )
      })}
    </div>
  )
}
