import { Empty } from '../parts'
import { iso, zile } from '../format'
import { itemsOf } from '../modules'
import type { Habit, OsData } from '../types'

export function Habits({ data, mod, phone, onAdd, onTick, onDelete }: {
  data: OsData
  mod: string
  phone: boolean
  onAdd: () => void
  onTick: (habitId: string, date: string) => void
  onDelete: (h: Habit) => void
}) {
  const list = itemsOf(data.habits, mod)
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
  const span = phone ? 7 : 21
  const days: string[] = []
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(iso(d))
  }
  const day = iso()

  const streak = (log: Record<string, number>): number => {
    let n = 0
    const d = new Date()
    if (!log[iso(d)]) d.setDate(d.getDate() - 1)
    while (log[iso(d)]) { n++; d.setDate(d.getDate() - 1) }
    return n
  }

  return (
    <>
      <div className="os-head">
        <div>
          <h1>Obiceiuri</h1>
          <p>Bifele stau înăuntrul obiceiului — ani de bifat zilnic ocupă tot o singură fișă.</p>
        </div>
        <button className="os-btn" onClick={onAdd}>Obicei nou</button>
      </div>

      {list.length ? (
        <div className="os-card pad os-habits">
          {list.map(h => {
            const log = h.log ?? {}
            const doneCount = days.filter(d => log[d]).length
            return (
              <div className="os-hrow" key={h.id}>
                <div className="os-hname">
                  <b>{h.name}</b>
                  <em>{doneCount} din ultimele {zile(span)}</em>
                </div>
                <div>
                  <div className="os-hgrid">
                    {days.map(d => (
                      <button key={d} className={`os-hcell${log[d] ? ' on' : ''}${d === day ? ' today' : ''}`}
                        onClick={() => onTick(h.id, d)} aria-label={`${h.name} — ${d}`} />
                    ))}
                  </div>
                  <div className="os-hlabels">
                    {days.map(d => <em key={d}>{span <= 10 ? new Date(`${d}T12:00:00`).getDate() : ''}</em>)}
                  </div>
                </div>
                <span className="os-streak">{zile(streak(log))}</span>
                <button className="os-icon del" onClick={() => onDelete(h)} aria-label="Șterge">🗑</button>
              </div>
            )
          })}
        </div>
      ) : (
        <Empty title="Niciun obicei urmărit"
          text="Alege lucrurile pe care vrei să le faci zilnic. Bifezi un pătrat pe zi și vezi seria crescând."
          action={<button className="os-btn" onClick={onAdd}>Adaugă primul obicei</button>} />
      )}
    </>
  )
}
