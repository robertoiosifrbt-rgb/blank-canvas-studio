/*
 * Kilograme și centimetri, sau livre și inci.
 *
 * **Ce se salvează nu se schimbă niciodată.** În `localStorage` o greutate
 * rămâne în kg și o circumferință în cm, oricare ar fi setarea. Conversia se
 * face doar la afișare și la citirea din formular, în punctul cel mai apropiat
 * de ecran. Altfel, o apăsare pe „Units" ar trebui să rescrie tot istoricul —
 * și orice rotunjire făcută acolo s-ar acumula la fiecare comutare.
 */

export type UnitSystem = 'metric' | 'imperial'

export const UNIT_SYSTEMS: UnitSystem[] = ['metric', 'imperial']

/** Valorile exacte, prin definiție — nu aproximări de genul `2.2`. */
const KG_PER_LB = 0.45359237
const CM_PER_IN = 2.54

/** Ce scrie pe rândul „Units" din Settings: `kg, cm` / `lb, in`. */
export function unitSystemLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'lb, in' : 'kg, cm'
}

export function weightUnit(system: UnitSystem): string {
  return system === 'imperial' ? 'lb' : 'kg'
}

export function lengthUnit(system: UnitSystem): string {
  return system === 'imperial' ? 'in' : 'cm'
}

/**
 * O zecimală, ca peste tot în aplicație: cântarul și ruleta nu sunt mai
 * precise, iar `0.1 + 0.2` produce altfel cozi de genul `.30000000000000004`.
 */
function round1(value: number): number {
  const rounded = Math.round(Math.abs(value) * 10) / 10
  return value < 0 ? -rounded : rounded
}

export function kgToDisplay(kg: number, system: UnitSystem): number {
  return system === 'imperial' ? round1(kg / KG_PER_LB) : round1(kg)
}

export function cmToDisplay(cm: number, system: UnitSystem): number {
  return system === 'imperial' ? round1(cm / CM_PER_IN) : round1(cm)
}

/** Din ce a tastat utilizatorul, înapoi în kg. Fără rotunjire: aici se salvează. */
export function displayToKg(value: number, system: UnitSystem): number {
  return system === 'imperial' ? value * KG_PER_LB : value
}

/** Din ce a tastat utilizatorul, înapoi în cm. */
export function displayToCm(value: number, system: UnitSystem): number {
  return system === 'imperial' ? value * CM_PER_IN : value
}

/**
 * Unitatea în care e **salvat** un câmp. `%` nu se convertește: un procent e
 * un procent în orice sistem, iar a-l trece prin conversie ar fi o greșeală
 * tăcută.
 */
export type StoredUnit = 'kg' | 'cm' | '%'

export interface DisplayValue {
  value: number
  unit: string
}

/** Cum se scrie unitatea unui câmp în sistemul ales: `cm` → `in`, `%` → `%`. */
export function displayUnit(unit: StoredUnit, system: UnitSystem): string {
  if (unit === 'kg') return weightUnit(system)
  if (unit === 'cm') return lengthUnit(system)
  return '%'
}

/** O valoare salvată, gata de afișat: numărul convertit plus unitatea potrivită. */
export function toDisplay(value: number, unit: StoredUnit, system: UnitSystem): DisplayValue {
  if (unit === 'kg') return { value: kgToDisplay(value, system), unit: displayUnit(unit, system) }
  if (unit === 'cm') return { value: cmToDisplay(value, system), unit: displayUnit(unit, system) }
  return { value: round1(value), unit: '%' }
}

/**
 * O **diferență** între două valori salvate.
 *
 * Se poate converti la fel ca o valoare pentru că amândouă conversiile sunt
 * simple înmulțiri, fără termen liber: `(a − b)/f` e același lucru cu
 * `a/f − b/f`. Dacă vreodată apare o unitate cu offset (Celsius→Fahrenheit),
 * regula asta nu mai ține și funcția trebuie despărțită de `toDisplay`.
 */
export function deltaToDisplay(delta: number, unit: StoredUnit, system: UnitSystem): DisplayValue {
  return toDisplay(delta, unit, system)
}

/**
 * Limitele de validare (`MEASUREMENT_BOUNDS`) sunt scrise în kg și cm. Când
 * formularul e în livre, limita trebuie spusă în livre — altfel „Weight (lb)
 * must be between 1 and 700" e o graniță pe care utilizatorul n-o poate
 * verifica.
 *
 * **Rotunjirea strânge intervalul, nu îl lărgește**: minimul urcă, maximul
 * coboară. Invers, `1 kg` ar deveni `2.2 lb`, iar `2.2 lb` scris înapoi e
 * `0.998 kg` — sub limită. Valoarea ar trece de formular și ar fi aruncată la
 * următoarea citire din `localStorage`, adică măsurătoarea ar dispărea după
 * reîncărcare.
 */
export function boundsToDisplay(
  bounds: { min: number; max: number },
  unit: StoredUnit,
  system: UnitSystem,
): { min: number; max: number } {
  // Ceil/floor pe **valoarea neconvertită la o zecimală**, nu pe cea trecută
  // prin `toDisplay`: aceea rotunjește deja la cel mai apropiat, deci `2.2046`
  // ar ajunge `2.2` înainte să apuce ceil-ul să urce.
  const min = exactConversion(bounds.min, unit, system)
  const max = exactConversion(bounds.max, unit, system)
  return { min: Math.ceil(min * 10) / 10, max: Math.floor(max * 10) / 10 }
}

/** Conversia fără rotunjire — folosită doar acolo unde rotunjirea trebuie dirijată. */
function exactConversion(value: number, unit: StoredUnit, system: UnitSystem): number {
  if (system === 'metric' || unit === '%') return value
  return unit === 'kg' ? value / KG_PER_LB : value / CM_PER_IN
}

/** `1240` → `1,240 kg` / `2,734 lb`. Gol când nu s-a ridicat nimic, ca să nu apară „0 kg". */
export function formatVolume(kg: number, system: UnitSystem): string {
  if (kg <= 0) return ''
  const { value, unit } = toDisplay(kg, 'kg', system)
  return `${Math.round(value).toLocaleString('en-GB')} ${unit}`
}
