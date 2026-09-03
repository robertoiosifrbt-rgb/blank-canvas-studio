import { useState } from 'react'
import { parseBounded } from '../../shared/numbers'
import { todayLocal } from '../../shared/localDate'
import { isCalendarDate } from '../../shared/validate'
import { boundsToDisplay, displayToCm, displayToKg, displayUnit, type StoredUnit, type UnitSystem } from '../../shared/units'
import { useUnits } from '../../shared/unitsContext'
import { MEASUREMENT_BOUNDS, type MeasurementNumberField, type NewMeasurement } from './types'
import { CIRCUMFERENCE_FIELDS, COMPOSITION_FIELDS } from './measurementStats'
import './measurements.css'

interface MeasurementFormProps {
  /** Returns false when the entry could not be saved, so the form keeps its values. */
  onAdd: (entry: NewMeasurement) => boolean
  /** Present when the form can be closed again — it opens from a button now. */
  onCancel?: () => void
}

const emptyForm = {
  date: '',
  heightCm: '',
  weightKg: '',
  bodyFatPercent: '',
  neckCm: '',
  chestCm: '',
  waistCm: '',
  hipsCm: '',
  leftArmCm: '',
  rightArmCm: '',
  leftThighCm: '',
  rightThighCm: '',
}

/*
 * Câmpurile și unitățile lor vin din listele care desenează și cardul „Key
 * Measurements". Formularul avea a doua listă, cu unitatea lipită în etichetă
 * („Neck (cm)"), deci ar fi rămas în centimetri și după trecerea la inci.
 */
const numberFields = [...COMPOSITION_FIELDS, ...CIRCUMFERENCE_FIELDS]

const quickFields = new Set<MeasurementNumberField>(['weightKg', 'heightCm', 'bodyFatPercent', 'chestCm', 'waistCm'])

/** Ce s-a tastat, adus în unitatea în care se salvează. Procentele trec neatinse. */
function toStored(value: number, unit: StoredUnit, system: UnitSystem): number {
  if (unit === 'kg') return displayToKg(value, system)
  if (unit === 'cm') return displayToCm(value, system)
  return value
}

export function MeasurementForm({ onAdd, onCancel }: MeasurementFormProps) {
  const [form, setForm] = useState({ ...emptyForm, date: todayLocal() })
  const [error, setError] = useState<string | null>(null)
  const { system } = useUnits()

  function handleChange(field: keyof typeof emptyForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  /**
   * Un câmp completat, verificat în unitatea în care a fost scris și întors în
   * unitatea în care se salvează.
   *
   * Verificarea se face pe limitele **afișate**, nu pe cele salvate: altfel
   * mesajul ar vorbi despre kilograme unui om care tastează livre.
   */
  function readField(field: (typeof numberFields)[number]) {
    const unit = field.unit as StoredUnit
    const label = `${field.label} (${displayUnit(unit, system)})`
    const parsed = parseBounded(form[field.key], label, boundsToDisplay(MEASUREMENT_BOUNDS[field.key], unit, system))
    if (!parsed.ok) return parsed
    return { ok: true as const, value: toStored(parsed.value, unit, system) }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!isCalendarDate(form.date)) {
      setError('Pick a valid date.')
      return
    }

    const weightField = numberFields.find((field) => field.key === 'weightKg')!
    const weight = readField(weightField)
    if (!weight.ok) {
      setError(weight.error)
      return
    }

    const entry: NewMeasurement = { date: form.date, weightKg: weight.value }
    for (const field of numberFields) {
      if (field.key === 'weightKg') continue
      if (form[field.key].trim() === '') continue
      const parsed = readField(field)
      if (!parsed.ok) {
        setError(parsed.error)
        return
      }
      entry[field.key] = parsed.value
    }

    if (!onAdd(entry)) {
      setError('Could not save this measurement — see the message above. Your values are still here.')
      return
    }

    setForm({ ...emptyForm, date: todayLocal() })
  }

  const renderField = (field: (typeof numberFields)[number]) => {
    const { key, label, unit } = field
    const bounds = boundsToDisplay(MEASUREMENT_BOUNDS[key], unit as StoredUnit, system)
    return (
      <div className="field" key={key}>
        <label htmlFor={key}>{`${label} (${displayUnit(unit as StoredUnit, system)})`}</label>
        <input
          id={key}
          inputMode="decimal"
          type="number"
          step="0.1"
          min={bounds.min}
          max={bounds.max}
          value={form[key]}
          onChange={(e) => handleChange(key, e.target.value)}
          required={key === 'weightKg'}
        />
      </div>
    )
  }

  return (
    <form className="measurement-form" onSubmit={handleSubmit}>
      <div className="measurement-form-section measurement-form-primary">
        <div className="field field-wide">
          <label htmlFor="date">Date</label>
          <input id="date" type="date" value={form.date} onChange={(e) => handleChange('date', e.target.value)} required />
        </div>
        <div className="measurement-grid">
          {numberFields.filter(({ key }) => quickFields.has(key)).map(renderField)}
        </div>
      </div>

      <details className="measurement-more">
        <summary>More measurements</summary>
        <div className="measurement-grid measurement-grid-secondary">
          {numberFields.filter(({ key }) => !quickFields.has(key)).map(renderField)}
        </div>
      </details>

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="measurement-form-actions">
        <button className="measurement-save" type="submit">Add measurement</button>
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
