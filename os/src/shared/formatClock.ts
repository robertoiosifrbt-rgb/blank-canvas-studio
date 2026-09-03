/**
 * Seconds as a clock. Hours are dropped under an hour so a short session reads
 * `12:04` rather than `00:12:04`; the workout runner asks for `alwaysHours`
 * because its clock is the focal point of the screen and must not change width
 * the moment it passes the hour.
 */
export function formatClock(totalSeconds: number, alwaysHours = false): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  if (hours === 0 && !alwaysHours) return `${mm}:${ss}`
  return `${String(hours).padStart(2, '0')}:${mm}:${ss}`
}
