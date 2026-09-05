import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useScreen } from '../../items/context'
import { treeOf } from '../../repository/items'
import './AreasScreen.css'

/**
 * The tree, and the two things you do to it: add under, or go in.
 *
 * Tapping a name enters the area rather than opening a settings sheet. The
 * tree is how you get somewhere; what an area holds, and what you do to the
 * area itself, are both in the place the name points at.
 *
 * There is no drag and drop and no reordering. Siblings come out in name
 * order, decided in one place, so the list cannot drift into an order nobody
 * chose and nobody can restore.
 */
export function AreasScreen() {
  const { data } = useScreen()
  const [addingUnder, setAddingUnder] = useState<string | null | undefined>(undefined)
  const [name, setName] = useState('')

  const rows = treeOf(data.areas)
  const adding = addingUnder !== undefined
  const trimmed = name.trim()

  function startAdding(parent: string | null) {
    setAddingUnder(parent)
    setName('')
  }

  function stopAdding() {
    setAddingUnder(undefined)
    setName('')
  }

  async function save() {
    if (trimmed === '' || addingUnder === undefined) return
    await data.addArea(trimmed, addingUnder)
    stopAdding()
  }

  return (
    <section className="areas">
      {rows.length === 0 && !adding && (
        <p className="areas-empty">
          No areas yet. An area is a part of your life — Business, and what sits
          under it.
        </p>
      )}

      <ul className="areas-tree">
        {rows.map(({ area, depth }) => (
          <li
            key={area.id}
            className="areas-row"
            style={{ paddingLeft: `calc(${depth} * var(--space-4))` }}
          >
            <Link className="areas-name" to={`/areas/${area.id}`}>
              {area.name}
            </Link>
            <button
              type="button"
              name="add-under"
              className="areas-add-under"
              aria-label={`Add an area under ${area.name}`}
              onClick={() => startAdding(area.id)}
            >
              +
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <form
          className="areas-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <label className="areas-label" htmlFor="area-new">
            {addingUnder === null
              ? 'A new area'
              : `Under ${data.areas.find((a) => a.id === addingUnder)?.name ?? ''}`}
          </label>
          <input
            id="area-new"
            name="new-area"
            className="areas-input"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
          <div className="areas-form-buttons">
            <button
              type="submit"
              name="save"
              className="areas-save"
              disabled={trimmed === ''}
            >
              Add it
            </button>
            <button
              type="button"
              name="cancel"
              className="areas-cancel"
              onClick={stopAdding}
            >
              Not now
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          name="add-root"
          className="areas-add-root"
          onClick={() => startAdding(null)}
        >
          Add an area
        </button>
      )}

    </section>
  )
}
