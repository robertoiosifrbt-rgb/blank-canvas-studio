import { displayUnit, toDisplay, type StoredUnit } from '../../shared/units'
import { useUnits } from '../../shared/unitsContext'
import type { Measurement } from './types'
import { CIRCUMFERENCE_FIELDS, COMPOSITION_FIELDS } from './measurementStats'

interface MeasurementHistoryProps {
  measurements: Measurement[]
}

/*
 * Coloanele vin din aceleași liste care desenează cardul „Key Measurements".
 * Erau scrise a doua oară aici, cu unitatea lipită în etichetă („Neck (cm)"),
 * deci un câmp adăugat într-un loc lipsea din celălalt — iar acum, cu unități
 * comutabile, a doua listă ar fi rămas în centimetri pentru totdeauna.
 */
const columns = [...COMPOSITION_FIELDS, ...CIRCUMFERENCE_FIELDS]

export function MeasurementHistory({ measurements }: MeasurementHistoryProps) {
  const { system } = useUnits()

  if (measurements.length === 0) {
    return <p>No measurements logged yet.</p>
  }

  // 12 nowrap columns are far wider than a phone screen, so the table scrolls
  // inside its own container instead of stretching the page sideways.
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            {columns.map(({ key, label, unit }) => (
              <th key={key}>{`${label} (${displayUnit(unit as StoredUnit, system)})`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {measurements.map((measurement) => (
            <tr key={measurement.id}>
              <td>{measurement.date}</td>
              {columns.map(({ key, unit }) => {
                const value = measurement[key]
                return <td key={key}>{typeof value === 'number' ? toDisplay(value, unit as StoredUnit, system).value : '—'}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
