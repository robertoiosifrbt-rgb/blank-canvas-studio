/**
 * Puntea către aplicația de sală. Ea își ține datele sub cheile ei; aici le
 * citim ca să apară și în calendarul comun, fără să le atingem.
 *
 * Citire, niciodată scriere: sala rămâne singura care își modifică datele.
 */

const SESSIONS = 'gym-app:workout-sessions'
const MEASUREMENTS = 'gym-app:measurements'

function readArray(key: string): unknown[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export interface GymSession { date: string; name: string }
export interface GymMeasurement { date: string; weightKg?: number; bodyFatPercent?: number }

/**
 * Măsurătorile pe care un obiectiv le poate urmări singur.
 *
 * Numele cheilor sunt ale sălii, ca să nu fie nimic de tradus între ele și
 * ce e scris pe disc. Unitatea stă lângă, altfel obiectivul ar arăta un număr
 * gol și n-ai ști dacă 84 e centimetri sau kilograme.
 */
export const GYM_METRICS = [
  { key: 'waistCm', name: 'Talie', unit: 'cm' },
  { key: 'weightKg', name: 'Greutate', unit: 'kg' },
  { key: 'bodyFatPercent', name: 'Grăsime', unit: '%' },
  { key: 'chestCm', name: 'Piept', unit: 'cm' },
  { key: 'hipsCm', name: 'Șolduri', unit: 'cm' },
  { key: 'neckCm', name: 'Gât', unit: 'cm' },
  { key: 'leftArmCm', name: 'Braț stâng', unit: 'cm' },
  { key: 'rightArmCm', name: 'Braț drept', unit: 'cm' },
  { key: 'leftThighCm', name: 'Coapsă stângă', unit: 'cm' },
  { key: 'rightThighCm', name: 'Coapsă dreaptă', unit: 'cm' },
] as const

export type GymMetric = (typeof GYM_METRICS)[number]

export const gymMetric = (key: string): GymMetric | undefined =>
  GYM_METRICS.find(metric => metric.key === key)

/**
 * Măsurătorile sălii pentru un câmp, ca citiri de obiectiv: cronologic, fără
 * zilele în care câmpul n-a fost completat. Id-ul vine din dată pentru că
 * lista se recompune la fiecare randare — un id nou de fiecare dată ar
 * schimba lista fără ca datele să se fi schimbat.
 */
export function gymReadings(field: string): Array<{ id: string; date: string; value: number }> {
  return readArray(MEASUREMENTS)
    .flatMap(item => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      const value = row[field]
      if (typeof row.date !== 'string' || typeof value !== 'number' || !Number.isFinite(value)) return []
      return [{ id: `gym:${field}:${row.date}`, date: row.date, value }]
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function gymSessions(): GymSession[] {
  return readArray(SESSIONS).flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const row = item as { date?: unknown; name?: unknown }
    if (typeof row.date !== 'string') return []
    return [{ date: row.date, name: typeof row.name === 'string' && row.name ? row.name : 'Antrenament' }]
  })
}

export function gymMeasurements(): GymMeasurement[] {
  return readArray(MEASUREMENTS).flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const row = item as { date?: unknown; weightKg?: unknown; bodyFatPercent?: unknown }
    if (typeof row.date !== 'string') return []
    return [{
      date: row.date,
      weightKg: typeof row.weightKg === 'number' ? row.weightKg : undefined,
      bodyFatPercent: typeof row.bodyFatPercent === 'number' ? row.bodyFatPercent : undefined,
    }]
  })
}

/** Ultima măsurătoare pentru un câmp, sau `null` dacă n-ai măsurat-o încă. */
export function latestGym(field: string): number | null {
  const reads = gymReadings(field)
  return reads.length ? reads[reads.length - 1].value : null
}
