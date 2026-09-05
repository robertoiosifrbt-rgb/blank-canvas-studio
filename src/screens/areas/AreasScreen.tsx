import { useState } from 'react'

import { AreaSheet } from '../../areas/AreaSheet'
import { useScreen } from '../../items/context'
import { countUnder, treeOf } from '../../repository/items'
import './AreasScreen.css'

/**
 * The tree, and the two things you do to it: add under, or open.
 *
 * There is no drag and drop and no reordering. Siblings come out in name
 * order, decided in one place, so the list cannot drift into an order nobody
 * chose and nobody can restore.
 */
export function AreasScreen() {
  const { data } = useScreen()
  const [addingUnder, setAddingUnder] = useState<string | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const rows = treeOf(data.areas)
  const open = data.areas.find((area) => area.id === openId) ?? null
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
            <button
              type="button"
              name="open"
              className="areas-name"
              onClick={() => setOpenId(area.id)}
            >
              {area.name}
            </button>
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

      {open !== null && (
        <AreaSheet
          area={open}
          under={countUnder(data.areas, open.id)}
          onRename={(next) => data.renameArea(open, next)}
          onDrop={() => data.dropArea(open)}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  )
}
