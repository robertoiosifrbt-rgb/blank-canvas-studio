import { Empty, Rows } from '../parts'
import { dayLabel, today } from '../format'
import { itemsOf } from '../modules'
import type { OsData, Task } from '../types'

export function Tasks({ data, mod, filter, onFilter, onAdd, onToggle, onDelete, onClear }: {
  data: OsData
  mod: string
  filter: 'open' | 'all' | 'done'
  onFilter: (f: 'open' | 'all' | 'done') => void
  onAdd: () => void
  onToggle: (t: Task) => void
  onDelete: (t: Task) => void
  onClear: () => void
}) {
  const all = itemsOf(data.tasks, mod)
  const open = all.filter(t => !t.done)
  const done = all.filter(t => t.done)
  const list = (filter === 'open' ? open : filter === 'done' ? done : all)
    .slice()
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      const ad = a.due || '9999-99-99', bd = b.due || '9999-99-99'
      return ad === bd ? (b.createdAt ?? '').localeCompare(a.createdAt ?? '') : ad.localeCompare(bd)
    })

  return (
    <>
      <div className="os-head">
        <div>
          <h1>Task-uri</h1>
          <p>{open.length ? `${open.length} ${open.length === 1 ? 'lucru de făcut' : 'lucruri de făcut'}` : 'Totul bifat.'}</p>
        </div>
        <button className="os-btn" onClick={onAdd}>Task nou</button>
      </div>

      <div className="os-bar">
        <div className="os-seg">
          {(['open', 'all', 'done'] as const).map(key => (
            <button key={key} className={filter === key ? 'on' : ''} onClick={() => onFilter(key)}>
              {key === 'open' ? 'De făcut' : key === 'all' ? 'Toate' : 'Gata'}{' '}
              {key === 'open' ? open.length : key === 'all' ? all.length : done.length}
            </button>
          ))}
        </div>
        {done.length ? <button className="os-btn ghost sm" onClick={onClear}>Curăță bifate ({done.length})</button> : null}
      </div>

      {list.length ? (
        <Rows>
          {list.map(t => {
            const late = !t.done && t.due && t.due < today()
            return (
              <div className={`os-row${t.done ? ' done' : ''}`} key={t.id}>
                <button className={`os-chk${t.done ? ' on' : ''}`} onClick={() => onToggle(t)} aria-label="Bifează">✓</button>
                <div className="main">
                  <span className="ttl">{t.title}</span>
                  {(t.due || t.proj) ? (
                    <span className="sub">
                      {t.proj ? <span className="os-pill">{t.proj}</span> : null}
                      {t.due ? <span className={`os-pill${late ? ' bad' : ''}`}>{late ? 'restant ' : ''}{dayLabel(t.due)}</span> : null}
                    </span>
                  ) : null}
                </div>
                <button className="os-icon del" onClick={() => onDelete(t)} aria-label="Șterge">🗑</button>
              </div>
            )
          })}
        </Rows>
      ) : (
        <Empty title={filter === 'done' ? 'Niciun task bifat încă' : all.length ? 'Nimic aici' : 'Listă goală'}
          text={all.length ? 'Schimbă filtrul de mai sus ca să vezi restul.'
            : 'Scrie primul task. Poți să-i pui o scadență și un proiect, ca să știi ce e urgent.'}
          action={all.length ? undefined : <button className="os-btn" onClick={onAdd}>Adaugă primul task</button>} />
      )}
    </>
  )
}
