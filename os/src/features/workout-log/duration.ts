/*
 * Introducerea unei durate de la telefon.
 *
 * Câmpul cerea `HH:MM:SS` și refuza orice altceva — dar are `inputMode="numeric"`,
 * iar tastatura numerică a iOS-ului **nu are două puncte**. Formatul cerut era
 * imposibil de tastat pe singurul dispozitiv pe care rulează aplicația. Nu era o
 * validare prea strictă, era o validare pe care n-aveai cum s-o treci.
 *
 * Soluția e să punem noi separatoarele, în timp ce se tastează: cifrele se
 * grupează de la dreapta spre stânga — secunde, minute, ore — la fel ca la
 * introducerea unei ore pe un bancomat. Se tastează `011023` și în câmp apare
 * `01:10:23`, deci ce se vede e mereu formatul valid.
 */

/** Câte cifre încap: `HHMMSS`. */
const MAX_DIGITS = 6

/**
 * Ce se afișează în câmp după fiecare tastă. Ia orice text, păstrează cifrele și
 * le grupează de la dreapta.
 *
 * Stările intermediare se deplasează pe măsură ce tastezi (`0110` → `01:10`,
 * apoi `01102` → `0:11:02`), la fel ca la orice câmp de acest fel. Ce contează
 * e că starea finală e cea corectă și că nu poate ieși un format invalid.
 */
export function formatDurationInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, MAX_DIGITS)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, -2)}:${digits.slice(-2)}`
  return `${digits.slice(0, -4)}:${digits.slice(-4, -2)}:${digits.slice(-2)}`
}

/**
 * Durata în secunde, sau `null` dacă textul nu e o durată.
 *
 * Gol înseamnă zero, nu eroare: e felul în care ștergi o durată greșită.
 * Acceptă și cifre lipite (`011023`), pentru cazul în care textul ajunge în
 * câmp altfel decât tastat — o lipire, sau o valoare veche din storage.
 */
export function parseDuration(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return 0

  const text = trimmed.includes(':') ? trimmed : formatDurationInput(trimmed)
  if (text === '') return null

  const parts = text.split(':')
  /*
   * Una sau două cifre, încă fără separator: sunt secunde. Cazul apare la
   * fiecare tastare — primele două taste dintr-o durată trec pe aici — și dacă
   * l-am respinge, mesajul de eroare ar clipi cât timp scrii numărul.
   */
  if (parts.length === 1) {
    if (!/^\d{1,2}$/.test(parts[0])) return null
    return Number(parts[0])
  }
  if (parts.length > 3) return null
  if (parts.some((part) => part === '' || !/^\d+$/.test(part))) return null

  const numbers = parts.map(Number)
  const [hours, minutes, seconds] = parts.length === 3 ? numbers : [0, numbers[0], numbers[1]]
  if (minutes > 59 || seconds > 59) return null

  return hours * 3600 + minutes * 60 + seconds
}

/** Secunde → `HH:MM:SS`, forma în care câmpul își arată valoarea de pornire. */
export function formatDurationValue(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':')
}

/** `3623` → `1h 0m 23s`. Confirmarea, în cuvinte, a ce s-a înțeles din cifre. */
export function describeDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const parts: string[] = []
  if (hours) parts.push(`${hours}h`)
  if (minutes || hours) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return parts.join(' ')
}
