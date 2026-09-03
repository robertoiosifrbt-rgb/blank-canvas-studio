import { useState } from 'react'
import { StorageNotice } from '../../shared/StorageNotice'
import { useMeasurements } from './useMeasurements'
import { MeasurementForm } from './MeasurementForm'
import { MeasurementHistory } from './MeasurementHistory'
import { KeyMeasurements } from './KeyMeasurements'
import { CIRCUMFERENCE_FIELDS, COMPOSITION_FIELDS } from './measurementStats'

/** Which of the Body Stats sections is showing. */
export type MeasurementsSection = 'measurements' | 'composition' | 'history'

interface MeasurementsPageProps {
  section: MeasurementsSection
}

/**
 * Body Stats: the last measurement, what changed since the one before it, and
 * the full history.
 *
 * The form is behind a button rather than always open. It is eleven fields
 * tall, and it used to be the first thing on the screen — so the numbers you
 * came to read started below a form you were not filling in.
 */
export function MeasurementsPage({ section }: MeasurementsPageProps) {
  const { measurements, addMeasurement, error, dismissError } = useMeasurements()
  const [adding, setAdding] = useState(false)

  function handleAdd(entry: Parameters<typeof addMeasurement>[0]): boolean {
    if (!addMeasurement(entry)) return false
    setAdding(false)
    return true
  }

  return (
    <section className="measurements-page">
      <StorageNotice message={error} onDismiss={dismissError} />

      {section === 'measurements' && (
        <KeyMeasurements
          measurements={measurements}
          fields={CIRCUMFERENCE_FIELDS}
          title="Key Measurements"
          emptyHint="No circumferences recorded yet. Add a measurement to start tracking them."
        />
      )}

      {section === 'composition' && (
        <KeyMeasurements
          measurements={measurements}
          fields={COMPOSITION_FIELDS}
          title="Composition"
          emptyHint="No measurements yet. Weight, body fat and height show up here."
        />
      )}

      {section === 'history' &&
        (measurements.length > 0 ? (
          <MeasurementHistory measurements={measurements} />
        ) : (
          <div className="empty-state card">
            <strong>No history yet</strong>
            <span>Every measurement you add shows up here, newest first.</span>
          </div>
        ))}

      {section !== 'history' &&
        (adding ? (
          <div className="measurement-add-panel">
            <div className="section-header">
              <h2>Add New Measurement</h2>
            </div>
            <MeasurementForm onAdd={handleAdd} onCancel={() => setAdding(false)} />
          </div>
        ) : (
          <button type="button" className="measurement-add-trigger" onClick={() => setAdding(true)}>
            + Add Measurements
          </button>
        ))}
    </section>
  )
}
