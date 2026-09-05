import type { Shift } from '../repository/items'
import { readingOf } from './money'

type Props = {
  shift: Shift
  busy: boolean
  onSaveReadings: (odo_start: number | null, odo_end: number | null) => Promise<void>
  onSavePersonalKm: (personal_km: number | null) => Promise<void>
  onRun: (body: () => Promise<void>) => void
  onError: (message: string) => void
}

/**
 * What the odometer said, and how much of it was not work.
 *
 * Kilometres are never stored: they are the difference between two readings,
 * so the two can never disagree with the distance. The personal part is stored,
 * because nothing else knows it — the detour to the shops leaves no trace on a
 * platform's payment, and it is not a cost of earning.
 */
export function ShiftOdometer(props: Props) {
  const { shift, busy } = props

  function read(typed: string, then: (value: number | null) => void) {
    try {
      then(readingOf(typed))
    } catch (reason) {
      props.onError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  return (
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
              onBlur={(event) =>
                read(event.target.value, (value) => {
                  const start = which === 'odo_start' ? value : shift.odo_start
                  const end = which === 'odo_end' ? value : shift.odo_end
                  props.onRun(() => props.onSaveReadings(start, end))
                })
              }
            />
          </label>
        ))}
      </div>

      <label className="shift-paid">
        <span className="shift-platform">Of that, personal</span>
        <input
          className="shift-amount"
          name="personal_km"
          inputMode="decimal"
          defaultValue={shift.personal_km === null ? '' : String(shift.personal_km)}
          disabled={busy}
          onBlur={(event) =>
            read(event.target.value, (value) => {
              props.onRun(() => props.onSavePersonalKm(value))
            })
          }
        />
      </label>
    </section>
  )
}
