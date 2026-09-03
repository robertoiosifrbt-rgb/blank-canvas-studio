import { GoalHero } from '../GoalHero'
import { Empty, Section } from '../parts'
import { anchors, goalsAll, isMetric } from '../goals'
import type { Goal, OsData } from '../types'

export function Goals({ data, onAdd, onEdit, onContribute, onMeasure, onDelete, onAnchor, onToggleHabit }: {
  data: OsData
  onAdd: () => void
  onEdit: (g: Goal) => void
  onContribute: (g: Goal) => void
  onMeasure: (g: Goal) => void
  onDelete: (g: Goal) => void
  onAnchor: (g: Goal) => void
  onToggleHabit: (goalId: string, habitId: string) => void
}) {
  const currency = data.settings.currency
  const all = goalsAll(data)
  const pinned = anchors(data)
  const pinnedIds = pinned.map(g => g.id)
  const rest = all.filter(g => !pinnedIds.includes(g.id))
  const habits = Object.values(data.habits)

  if (!all.length) {
    return (
      <>
        <div className="os-head"><div><h1>Goals</h1></div></div>
        <Empty title="Niciun obiectiv stabilit"
          text="Un obiectiv e ori o sumă de strâns, ori o măsurătoare care trebuie să se miște. Alege tipul și aplicația calculează singură ritmul și în ce lună ajungi."
          action={<button className="os-btn" onClick={onAdd}>Stabilește primul obiectiv</button>} />
      </>
    )
  }

  return (
    <>
      <div className="os-head">
        <div>
          <h1>Goals</h1>
          <p>Țintele în jurul cărora se învârte tot. Apar pe fiecare ecran.</p>
        </div>
        <button className="os-btn" onClick={onAdd}>Obiectiv nou</button>
      </div>

      <div className="os-heroes">
        {pinned.map(g => (
          <div key={g.id}>
            <GoalHero data={data} goal={g} currency={currency} actions onEdit={() => onEdit(g)} />
            <div className="os-hero-acts">
              <button className="os-btn sm" onClick={() => (isMetric(g) ? onMeasure(g) : onContribute(g))}>
                {isMetric(g) ? 'Măsurătoare' : 'Contribuție'}
              </button>
              <button className="os-btn ghost sm" onClick={() => onEdit(g)}>Modifică</button>
              <button className="os-icon del" onClick={() => onDelete(g)} aria-label="Șterge">🗑</button>
            </div>
          </div>
        ))}
      </div>

      {habits.length ? pinned.map(g => (
        <div key={`h-${g.id}`}>
          <Section title={`Obiceiuri care duc la „${g.name}”`} />
          <div className="os-card pad os-chips">
            {habits.map(h => (
              <button key={h.id} className={`os-chip${(g.habits ?? []).includes(h.id) ? ' on' : ''}`}
                onClick={() => onToggleHabit(g.id, h.id)}>{h.name}</button>
            ))}
          </div>
        </div>
      )) : null}

      {rest.length ? (
        <>
          <Section title="Celelalte obiective" />
          {rest.map(g => (
            <div className="os-card pad os-goal-card" key={g.id}>
              <GoalHero data={data} goal={g} currency={currency} onEdit={() => onEdit(g)} />
              <div className="os-hero-acts">
                <button className="os-btn sm" onClick={() => (isMetric(g) ? onMeasure(g) : onContribute(g))}>
                  {isMetric(g) ? 'Măsurătoare' : 'Contribuție'}
                </button>
                <button className="os-btn ghost sm" onClick={() => onAnchor(g)}>Fă-l ancoră</button>
                <button className="os-btn ghost sm" onClick={() => onEdit(g)}>Modifică</button>
                <button className="os-icon del" onClick={() => onDelete(g)} aria-label="Șterge">🗑</button>
              </div>
            </div>
          ))}
        </>
      ) : null}
    </>
  )
}
