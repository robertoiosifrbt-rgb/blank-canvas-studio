import { useState } from 'react'

import {
  isOut,
  kilometres,
  minutesWorked,
  PLATFORM_NAMES,
  PLATFORMS,
  takeHome,
} from '../repository/items'
import { treeOf } from '../repository/items'
import type { Area, Item, Platform, Shift } from '../repository/items'
import { Sheet } from '../ui/Sheet'
import { clock, hoursAndMinutes, penceOf, pounds, readingOf } from './money'
import './ShiftSheet.css'

type Props = {
  item: Item
  shift: Shift | null
  areas: Area[]
  onClockOn: () => Promise<void>
  onClockOff: (sessionId: string) => Promise<void>
  onDropSession: (sessionId: string) => Promise<void>
  onSetPaid: (platform: Platform, amount: number) => Promise<void>
  onSaveReadings: (odo_start: number | null, odo_end: number | null) => Promise<void>
  onSaveTips: (tips: number | null) => Promise<void>
  onSetArea: (area_id: string | null) => Promise<void>
  onClose: () => void
}

const NOTHING: Shift = {
  item_id: '',
  owner: '',
  odo_start: null,
  odo_end: null,
  tips: null,
  rate_tax_pct: null,
  rate_ni_pct: null,
  rate_fuel_per_km: null,
  rate_vehicle_per_km: null,
  sessions: [],
  earnings: [],
}

function amountOf(shift: Shift, platform: Platform): string {
  const found = shift.earnings.find((earning) => earning.platform === platform)
  return found === undefined ? '' : found.amount.toFixed(2)
}

/**
 * One shift, open: the hours, what each platform paid, the odometer, tips.
 *
 * Everything writes on blur rather than on a Save button. A shift is filled in
 * over a whole day, in a van, between drops — a form you have to remember to
 * submit is a form that loses half a day's numbers.
 */
export function ShiftSheet(props: Props) {
  const { item, onClose } = props
  const shift = props.shift ?? NOTHING
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function run(body: () => Promise<void>) {
    setBusy(true)
    setError(null)
    void body()
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => setBusy(false))
  }

  function onPaid(platform: Platform, typed: string) {
    const already = amountOf(shift, platform)
    if (typed.trim() === already.trim()) return
    let pence: number | null
    try {
      pence = penceOf(typed)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      return
    }
    if (pence === null) return
    run(() => props.onSetPaid(platform, pence / 100))
  }

  const worked = minutesWorked(shift)
  const km = kilometres(shift)
  const sum = takeHome(shift)
  const out = isOut(shift)
  const open = shift.sessions.find((session) => session.ended_at === null)

  return (
    <Sheet title={`Shift · ${item.due ?? ''}`} onClose={onClose}>
      <dl className="shift-totals">
        <div className="shift-total">
          <dt>Made</dt>
          <dd>{pounds(sum.grossPence)}</dd>
        </div>
        <div className="shift-total shift-total-net">
          <dt>Yours</dt>
          {/* The number the day is actually worth. Only shown as an answer
              when there is nothing missing behind it. */}
          <dd>{sum.missing.length === 0 ? pounds(sum.netPence) : '—'}</dd>
        </div>
        <div className="shift-total">
          <dt>Worked</dt>
          <dd>{hoursAndMinutes(worked)}</dd>
        </div>
      </dl>

      <dl className="shift-breakdown">
        <div className="shift-line">
          <dt>Driven</dt>
          {/* Unknown, not zero: one reading tells you nothing about the other. */}
          <dd>{km === null ? '—' : `${km.toFixed(1)} km`}</dd>
        </div>
        <div className="shift-line">
          <dt>Fuel and vehicle</dt>
          <dd>{sum.missing.includes('costs') || sum.missing.includes('kilometres')
            ? '—'
            : `−${pounds(sum.costsPence)}`}</dd>
        </div>
        <div className="shift-line">
          <dt>Tax and NI put aside</dt>
          <dd>
            {sum.missing.includes('rates')
              ? '—'
              : `−${pounds(sum.taxPence + sum.niPence)}`}
          </dd>
        </div>
      </dl>

      {/* Never a silent zero: a missing rate is an unknown reserve, not a
          reserve of nothing, and £0 tax is the lie that costs money. */}
      {sum.missing.includes('rates') && (
        <p className="shift-missing">
          No percentages set yet — open <strong>Put aside</strong> in the header.
        </p>
      )}
      {sum.missing.includes('costs') && (
        <p className="shift-missing">
          This area has no cost per kilometre yet — open it in Areas.
        </p>
      )}
      {sum.missing.includes('kilometres') && (
        <p className="shift-missing">
          Both odometer readings are needed before fuel can be worked out.
        </p>
      )}

      {error !== null && <p className="shift-error">{error}</p>}

      <section className="shift-block">
        <h3 className="shift-heading">Hours</h3>
        <ul className="shift-sessions">
          {shift.sessions.map((session) => (
            <li key={session.id} className="shift-session">
              <span className="shift-when">
                {clock(session.started_at)} —{' '}
                {session.ended_at === null ? 'now' : clock(session.ended_at)}
              </span>
              <button
                type="button"
                name="drop-session"
                className="shift-drop"
                disabled={busy}
                aria-label={`Remove the session that started at ${clock(session.started_at)}`}
                onClick={() => run(() => props.onDropSession(session.id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        {out && open !== undefined ? (
          <button
            type="button"
            name="clock-off"
            className="shift-clock shift-clock-off"
            disabled={busy}
            onClick={() => run(() => props.onClockOff(open.id))}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            name="clock-on"
            className="shift-clock"
            disabled={busy}
            onClick={() => run(props.onClockOn)}
          >
            Start
          </button>
        )}
      </section>

      <section className="shift-block">
        <h3 className="shift-heading">Paid</h3>
        {PLATFORMS.map((platform) => (
          <label key={platform} className={`shift-paid shift-${platform}`}>
            <span className="shift-platform">{PLATFORM_NAMES[platform]}</span>
            <input
              className="shift-amount"
              name={platform}
              inputMode="decimal"
              defaultValue={amountOf(shift, platform)}
              disabled={busy}
              onBlur={(event) => onPaid(platform, event.target.value)}
            />
          </label>
        ))}
        <label className="shift-paid shift-tips">
          <span className="shift-platform">Tips</span>
          <input
            className="shift-amount"
            name="tips"
            inputMode="decimal"
            defaultValue={shift.tips === null ? '' : shift.tips.toFixed(2)}
            disabled={busy}
            onBlur={(event) => {
              try {
                const pence = penceOf(event.target.value)
                run(() => props.onSaveTips(pence === null ? null : pence / 100))
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : String(reason))
              }
            }}
          />
        </label>
      </section>

      <section className="shift-block">
        <h3 className="shift-heading">Where it belongs</h3>
        <label className="shift-paid">
          <span className="shift-platform">Area</span>
          <select
            className="shift-amount shift-area"
            name="area"
            value={item.area_id ?? ''}
            disabled={busy}
            onChange={(event) =>
              run(() => props.onSetArea(event.target.value === '' ? null : event.target.value))
            }
          >
            <option value="">—</option>
            {treeOf(props.areas).map(({ area, depth }) => (
              <option key={area.id} value={area.id}>
                {'\u00a0'.repeat(depth * 2)}
                {area.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="shift-block">
        <h3 className="shift-heading">Odometer</h3>
        <div className="shift-odo">
          {(['odo_start', 'odo_end'] as const).map((which) => (
            <label key={which} className="shift-paid">
              <span className="shift-platform">
                {which === 'odo_start' ? 'Out' : 'Back'}
              </span>
              <input
                className="shift-amount"
                name={which}
                inputMode="decimal"
                defaultValue={shift[which] === null ? '' : String(shift[which])}
                disabled={busy}
                onBlur={(event) => {
                  try {
                    const value = readingOf(event.target.value)
                    const start = which === 'odo_start' ? value : shift.odo_start
                    const end = which === 'odo_end' ? value : shift.odo_end
                    run(() => props.onSaveReadings(start, end))
                  } catch (reason) {
                    setError(reason instanceof Error ? reason.message : String(reason))
                  }
                }}
              />
            </label>
          ))}
        </div>
      </section>
    </Sheet>
  )
}
