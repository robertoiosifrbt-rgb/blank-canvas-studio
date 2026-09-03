import { recoverArray } from '../../shared/storage'
import { usePersistedState } from '../../shared/usePersistedState'
import { parseMeasurement, type Measurement, type NewMeasurement } from './types'

const STORAGE_KEY = 'gym-app:measurements'

const recover = recoverArray(parseMeasurement)

const byDateDesc = (a: Measurement, b: Measurement) => b.date.localeCompare(a.date)

export function useMeasurements() {
  const {
    value: measurements,
    update,
    error,
    dismissError,
  } = usePersistedState<Measurement[]>(STORAGE_KEY, [], recover)

  /** Returns false when storage refused the write, so the form can keep its values. */
  function addMeasurement(entry: NewMeasurement): boolean {
    const measurement: Measurement = { ...entry, id: crypto.randomUUID() }
    return update((prev) => [...prev, measurement].sort(byDateDesc))
  }

  return { measurements, addMeasurement, error, dismissError }
}
