import { describe, expect, it } from 'vitest'
import {
  boundsToDisplay,
  cmToDisplay,
  deltaToDisplay,
  displayToCm,
  displayToKg,
  formatVolume,
  kgToDisplay,
  toDisplay,
  unitSystemLabel,
} from './units'

describe('unit conversion', () => {
  it('leaves metric values alone', () => {
    expect(kgToDisplay(77.1, 'metric')).toBe(77.1)
    expect(cmToDisplay(92.5, 'metric')).toBe(92.5)
  })

  it('converts to pounds and inches', () => {
    expect(kgToDisplay(100, 'imperial')).toBe(220.5)
    expect(cmToDisplay(2.54, 'imperial')).toBe(1)
  })

  it('rounds display values to one decimal', () => {
    expect(kgToDisplay(0.1 + 0.2, 'metric')).toBe(0.3)
    expect(cmToDisplay(92.46, 'imperial')).toBe(36.4)
  })

  /*
   * Ce salvezi trebuie să fie ce citești înapoi. Fără asta, o greutate tastată
   * în livre s-ar plimba cu câteva zecimi la fiecare deschidere a formularului.
   */
  it('round-trips a typed value back to the same display number', () => {
    for (const typed of [45, 154.3, 220.5]) {
      expect(kgToDisplay(displayToKg(typed, 'imperial'), 'imperial')).toBe(typed)
    }
    for (const typed of [12, 36.4, 78.7]) {
      expect(cmToDisplay(displayToCm(typed, 'imperial'), 'imperial')).toBe(typed)
    }
  })

  it('stores metric input untouched', () => {
    expect(displayToKg(77.1, 'metric')).toBe(77.1)
    expect(displayToCm(92.5, 'metric')).toBe(92.5)
  })
})

describe('toDisplay', () => {
  it('picks the unit that matches the system', () => {
    expect(toDisplay(80, 'kg', 'metric')).toEqual({ value: 80, unit: 'kg' })
    expect(toDisplay(80, 'kg', 'imperial')).toEqual({ value: 176.4, unit: 'lb' })
    expect(toDisplay(90, 'cm', 'metric')).toEqual({ value: 90, unit: 'cm' })
    expect(toDisplay(90, 'cm', 'imperial')).toEqual({ value: 35.4, unit: 'in' })
  })

  /* Un procent nu are sistem de unități — dacă l-am converti, 18% ar deveni 39.7. */
  it('never converts a percentage', () => {
    expect(toDisplay(18, '%', 'imperial')).toEqual({ value: 18, unit: '%' })
  })

  it('keeps the sign of a delta', () => {
    expect(deltaToDisplay(-1.25, 'kg', 'metric').value).toBe(-1.3)
    expect(deltaToDisplay(-2.54, 'cm', 'imperial').value).toBe(-1)
  })

  it('states the bounds in the unit the field is showing', () => {
    expect(boundsToDisplay({ min: 1, max: 700 }, 'kg', 'metric')).toEqual({ min: 1, max: 700 })
    expect(boundsToDisplay({ min: 1, max: 700 }, 'kg', 'imperial')).toEqual({ min: 2.3, max: 1543.2 })
  })

  /*
   * Limita afișată trebuie să fie o limită **acceptată**. Rotunjită în afară,
   * `1 kg` ar deveni `2.2 lb`, iar `2.2 lb` salvat înapoi e `0.998 kg`: sub
   * minim, deci măsurătoarea ar fi aruncată la următoarea citire din storage.
   */
  it('keeps a value typed exactly on the shown bound inside the stored range', () => {
    const stored = { min: 1, max: 700 }
    const shown = boundsToDisplay(stored, 'kg', 'imperial')
    expect(displayToKg(shown.min, 'imperial')).toBeGreaterThanOrEqual(stored.min)
    expect(displayToKg(shown.max, 'imperial')).toBeLessThanOrEqual(stored.max)
  })
})

describe('formatVolume', () => {
  it('groups thousands and names the unit', () => {
    expect(formatVolume(7661, 'metric')).toBe('7,661 kg')
    expect(formatVolume(7661, 'imperial')).toBe('16,890 lb')
  })

  /* „0 kg" pe o sesiune fără greutăți e zgomot: rândul arată mai bine fără. */
  it('says nothing when nothing was lifted', () => {
    expect(formatVolume(0, 'metric')).toBe('')
    expect(formatVolume(-5, 'metric')).toBe('')
  })
})

describe('unitSystemLabel', () => {
  it('names both units, the way the settings row shows them', () => {
    expect(unitSystemLabel('metric')).toBe('kg, cm')
    expect(unitSystemLabel('imperial')).toBe('lb, in')
  })
})
