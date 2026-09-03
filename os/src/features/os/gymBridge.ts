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
