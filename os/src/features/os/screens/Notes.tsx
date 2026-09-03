import { Empty } from '../parts'
import { dayLabel } from '../format'
import { itemsOf } from '../modules'
import type { Note, OsData } from '../types'

export function Notes({ data, mod, search, onSearch, onAdd, onOpen }: {
  data: OsData
  mod: string
  search: string
  onSearch: (value: string) => void
  onAdd: () => void
  onOpen: (n: Note) => void
}) {
  const all = itemsOf(data.notes, mod)
    .sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''))
  const needle = search.toLowerCase()
  const list = needle
    ? all.filter(n => `${n.title ?? ''} ${n.body ?? ''}`.toLowerCase().includes(needle))
    : all

  return (
    <>
      <div className="os-head">
        <div>
          <h1>Jurnal</h1>
          <p>{all.length ? `${all.length} ${all.length === 1 ? 'însemnare' : 'însemnări'}` : 'Gânduri, idei, jurnal.'}</p>
        </div>
        <button className="os-btn" onClick={onAdd}>Însemnare nouă</button>
      </div>

      {all.length ? (
        <div className="os-bar">
          <input type="text" placeholder="Caută în însemnări…" value={search}
            onChange={e => onSearch(e.target.value)} />
        </div>
      ) : null}

      {list.length ? (
        <div className="os-notes">
          {list.map(n => (
            <button className="os-note" key={n.id} onClick={() => onOpen(n)}>
              <time>{dayLabel((n.updatedAt ?? n.createdAt ?? '').slice(0, 10))}</time>
              <h4>{n.title || 'Fără titlu'}</h4>
              {n.body ? <p>{n.body}</p> : null}
            </button>
          ))}
        </div>
      ) : (
        <Empty title={needle ? `Niciun rezultat pentru „${search}”` : 'Nicio însemnare'}
          text={needle ? 'Încearcă alt cuvânt.' : 'Scrie ce ai în cap. Se caută după titlu și conținut.'}
          action={needle ? undefined : <button className="os-btn" onClick={onAdd}>Scrie prima însemnare</button>} />
      )}
    </>
  )
}
