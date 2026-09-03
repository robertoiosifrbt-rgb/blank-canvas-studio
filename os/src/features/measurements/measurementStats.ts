import type { Measurement, MeasurementNumberField } from './types'

/*
 * Cifrele din spatele cardului „Key Measurements": ultima măsurătoare și cât
 * s-a schimbat fiecare valoare față de cea dinainte.
 *
 * Până acum, ecranul arăta un tabel de istoric și atât — diferența față de data
 * trecută trebuia calculată în cap, uitându-te de la un rând la altul.
 */

export interface FieldSpec {
  key: MeasurementNumberField
  label: string
  unit: string
}

/** Compoziția corpului: ce ești, ca masă. */
export const COMPOSITION_FIELDS: FieldSpec[] = [
  { key: 'weightKg', label: 'Weight', unit: 'kg' },
  { key: 'bodyFatPercent', label: 'Body fat', unit: '%' },
  { key: 'heightCm', label: 'Height', unit: 'cm' },
]

/** Circumferințele: ce se schimbă de la antrenament. */
export const CIRCUMFERENCE_FIELDS: FieldSpec[] = [
  { key: 'chestCm', label: 'Chest', unit: 'cm' },
  { key: 'waistCm', label: 'Waist', unit: 'cm' },
  { key: 'hipsCm', label: 'Hips', unit: 'cm' },
  { key: 'neckCm', label: 'Neck', unit: 'cm' },
  { key: 'leftArmCm', label: 'Left arm', unit: 'cm' },
  { key: 'rightArmCm', label: 'Right arm', unit: 'cm' },
  { key: 'leftThighCm', label: 'Left thigh', unit: 'cm' },
  { key: 'rightThighCm', label: 'Right thigh', unit: 'cm' },
]

/**
 * Măsurătorile în ordine, de la cea mai nouă la cea mai veche.
 *
 * Ordonate după dată, nu după ordinea din storage: se poate adăuga o
 * măsurătoare veche, uitată, iar „ultima" trebuie să rămână cea mai recentă
 * din calendar, nu ultima introdusă. Datele sunt `YYYY-MM-DD`, deci comparația
 * de șiruri e și comparație cronologică.
 */
export function byDateDesc(measurements: Measurement[]): Measurement[] {
  return [...measurements].sort((a, b) => b.date.localeCompare(a.date))
}

export interface MeasurementRow extends FieldSpec {
  value: number
  /** `null` când n-avem cu ce compara: prima măsurătoare, sau câmp necompletat atunci. */
  delta: number | null
}

/**
 * Rândurile cardului, pentru câmpurile cerute.
 *
 * Un câmp necompletat în ultima măsurătoare **nu apare deloc** — un rând cu „—"
 * ocupă loc și nu spune nimic. Dacă apare, dar lipsea data trecută, apare fără
 * deltă: n-avem față de ce.
 */
export function measurementRows(measurements: Measurement[], fields: FieldSpec[]): MeasurementRow[] {
  const [latest, previous] = byDateDesc(measurements)
  if (!latest) return []

  return fields.flatMap((field) => {
    const value = latest[field.key]
    if (typeof value !== 'number') return []
    const before = previous?.[field.key]
    const delta = typeof before === 'number' ? round1(value - before) : null
    return [{ ...field, value, delta }]
  })
}

/** Data ultimei măsurători, sau `''` dacă nu există niciuna. */
export function latestDate(measurements: Measurement[]): string {
  return byDateDesc(measurements)[0]?.date ?? ''
}

/**
 * O zecimală: cântarul de baie și ruleta nu sunt mai precise de-atât, iar
 * scăderile în virgulă mobilă produc oricum cozi de genul `-1.2500000000000018`
 * (din `77.1 - 78.35`).
 *
 * Se rotunjește **mărimea**, apoi se pune semnul înapoi. `Math.round` rotunjește
 * la jumătate mereu spre plus infinit, deci ar da `+1.25 → +1.3` dar
 * `−1.25 → −1.2`: aceeași schimbare, de mărime egală, afișată diferit după cum
 * ai crescut sau ai scăzut.
 */
function round1(value: number): number {
  const rounded = Math.round(Math.abs(value) * 10) / 10
  return value < 0 ? -rounded : rounded
}

/** `1.3` → `+1.3`, `-1.3` → `−1.3`. Semnul minus tipografic, nu cratima. */
export function formatDelta(delta: number): string {
  const rounded = round1(delta)
  if (rounded > 0) return `+${rounded}`
  if (rounded < 0) return `−${Math.abs(rounded)}`
  return '0'
}
