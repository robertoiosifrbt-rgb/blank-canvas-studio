/** Formatări folosite peste tot: sume, date, acorduri. */

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export const num = (value: unknown): number => {
  const parsed = parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

export const iso = (date?: Date): string => {
  const base = date ?? new Date()
  return new Date(base.getTime() - base.getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
}

export const today = (): string => iso()
export const ym = (date?: string): string => (date ?? today()).slice(0, 7)

export const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec']
export const MONTHS_L = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']
export const WEEK = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D']

export function money(value: number, currency = '£'): string {
  const shown = Math.abs(value).toLocaleString('ro-RO',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sign = value < 0 ? '−' : ''
  return currency === 'RON' ? `${sign}${shown} RON` : `${sign}${currency}${shown}`
}

export function dayLabel(date: string): string {
  if (!date) return ''
  const shift = (days: number): string => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return iso(d)
  }
  if (date === today()) return 'azi'
  if (date === shift(1)) return 'mâine'
  if (date === shift(-1)) return 'ieri'
  const d = new Date(`${date}T12:00:00`)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`
}

export const daysTo = (date: string): number =>
  Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${today()}T12:00:00`).getTime()) / 864e5)

/** „1 zi", „5 zile", „21 de zile" — acordul cerut de română. */
export function zile(n: number): string {
  if (n === 1) return '1 zi'
  return `${n} ${n % 100 >= 20 || n === 0 ? 'de zile' : 'zile'}`
}
