import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { AreaSheet } from '../../areas/AreaSheet'
import { useScreen } from '../../items/context'
import { countUnder, monthRange, pathOf, periodMoney } from '../../repository/items'
import type { Item } from '../../repository/items'
import { hoursAndMinutes, pounds } from '../../shifts/money'
import './AreaScreen.css'

/** The month a day falls in, as 'YYYY-MM'. */
function monthOf(day: string): string {
  return day.slice(0, 7)
}

/**
 * One area, entered.
 *
 * An area was a label: you tagged a shift with it and never went there. This
 * is the other half — the place the label points at. What belongs to this part
 * of your life, and what it came to this month.
 *
 * It shows the area's own work, not its children's. A parent is a container:
 * Business does not drive, MultiApp Delivery does, and adding the two together
 * would put the same shift in two totals.
 */
export function AreaScreen() {
  const { id = '' } = useParams()
  const { data, openItem, today } = useScreen()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)

  const area = data.areas.find((one) => one.id === id && one.deleted_at === null)
  if (area === undefined) {
    return (
      <section className="area-screen">
        <p className="area-screen-empty">
          No such area. It may have been removed.{' '}
          <Link to="/areas">Back to the tree</Link>
        </p>
      </section>
    )
  }

  const children = data.areas.filter(
    (one) => one.parent_id === area.id && one.deleted_at === null,
  )

  const mine = data.items.filter(
    (item) => item.area_id === area.id && item.deleted_at === null,
  )
  // Newest first: what you wrote down today is what you are looking for.
  const dated = [...mine].sort((one, other) => (one.due ?? '').localeCompare(other.due ?? ''))
  dated.reverse()

  const month = monthOf(today)
  const sum = periodMoney({
    items: mine,
    shifts: data.shifts,
    expenses: data.expenses,
    reserves: data.reserves,
    ...monthRange(month),
  })
  const worked = sum.shifts > 0 || sum.spentPence > 0

  return (
    <section className="area-screen">
      <div className="area-screen-head">
        <p className="area-screen-path">{pathOf(data.areas, area.id)}</p>
        <button
          type="button"
          name="settings"
          className="area-screen-settings"
          onClick={() => setEditing(true)}
        >
          Settings
        </button>
      </div>

      {editing && (
        <AreaSheet
          area={area}
          under={countUnder(data.areas, area.id)}
          onRename={(next) => data.renameArea(area, next)}
          onDrop={async () => {
            await data.dropArea(area)
            // The page you are on has just been removed. Standing on it would
            // show "No such area" to someone who did nothing wrong.
            void navigate('/areas')
          }}
          onClose={() => setEditing(false)}
        />
      )}

      {children.length > 0 && (
        <ul className="area-screen-children">
          {children.map((child) => (
            <li key={child.id}>
              <Link className="area-screen-child" to={`/areas/${child.id}`}>
                {child.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Nothing at all for an area with no work in it this month. A row of
          zeroes says "you earned nothing", and what is true is "you have not
          written anything down here". */}
      {worked && (
        <dl className="area-screen-money" aria-label="What this month came to">
          <div>
            <dt>Made</dt>
            <dd>{pounds(sum.grossPence)}</dd>
          </div>
          <div>
            <dt>Spent</dt>
            <dd>{pounds(sum.spentPence)}</dd>
          </div>
          <div>
            <dt>Worked</dt>
            <dd>{hoursAndMinutes(sum.minutes)}</dd>
          </div>
          <div>
            <dt>Left</dt>
            <dd>{sum.missingRates ? 'Not yet' : pounds(sum.leftPence)}</dd>
          </div>
        </dl>
      )}

      {dated.length === 0 ? (
        <p className="area-screen-empty">
          Nothing here yet. What you put in this area shows up on this page.
        </p>
      ) : (
        <ul className="area-screen-list">
          {dated.map((item: Item) => (
            <li key={item.id}>
              <button
                type="button"
                name="open"
                className="area-screen-item"
                onClick={() => openItem(item)}
              >
                <span className="area-screen-title">{item.title}</span>
                <span className="area-screen-day">{item.due ?? '—'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
