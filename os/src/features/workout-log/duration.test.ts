import { describe, expect, it } from 'vitest'
import { describeDuration, formatDurationInput, formatDurationValue, parseDuration } from './duration'

/*
 * The bug these cover: the field asked for HH:MM:SS and had
 * `inputMode="numeric"`, which on iOS opens a keypad with no colon key. The
 * required format could not be typed on the only device the app runs on, so
 * the duration was simply not editable — the validation was unpassable rather
 * than strict.
 */

describe('formatDurationInput', () => {
  it('groups digits from the right, so the field always shows a valid format', () => {
    expect(formatDurationInput('1')).toBe('1')
    expect(formatDurationInput('11')).toBe('11')
    expect(formatDurationInput('110')).toBe('1:10')
    expect(formatDurationInput('1102')).toBe('11:02')
    expect(formatDurationInput('11023')).toBe('1:10:23')
    expect(formatDurationInput('011023')).toBe('01:10:23')
  })

  it('keeps only the digits, so a paste with colons still works', () => {
    expect(formatDurationInput('01:10:23')).toBe('01:10:23')
    expect(formatDurationInput('1h 10m')).toBe('1:10')
  })

  it('stops at six digits — there is no room for more than HHMMSS', () => {
    expect(formatDurationInput('1234567890')).toBe('12:34:56')
  })

  it('empties out cleanly, so a wrong duration can be cleared', () => {
    expect(formatDurationInput('')).toBe('')
    expect(formatDurationInput('abc')).toBe('')
  })

  /*
   * Typing is one digit at a time, and every intermediate state has to be
   * something the parser accepts — otherwise the error message flashes on
   * while you are still halfway through the number.
   */
  it('produces a parseable value at every keystroke', () => {
    let typed = ''
    for (const digit of '011023') {
      typed = formatDurationInput(typed + digit)
      expect(parseDuration(typed)).not.toBeNull()
    }
    expect(typed).toBe('01:10:23')
  })
})

describe('parseDuration', () => {
  it('reads the colon form', () => {
    expect(parseDuration('01:10:23')).toBe(4223)
    expect(parseDuration('10:23')).toBe(623)
  })

  it('reads bare digits, the way the numeric keypad produces them', () => {
    expect(parseDuration('011023')).toBe(4223)
    expect(parseDuration('1023')).toBe(623)
  })

  it('treats empty as zero, so a duration can be removed', () => {
    expect(parseDuration('')).toBe(0)
    expect(parseDuration('   ')).toBe(0)
  })

  it('rejects minutes or seconds past 59', () => {
    expect(parseDuration('01:60:00')).toBeNull()
    expect(parseDuration('01:00:60')).toBeNull()
  })

  it('rejects text that is not a duration', () => {
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('1:2:3:4')).toBeNull()
    expect(parseDuration('1::2')).toBeNull()
  })

  it('accepts a single digit as seconds rather than failing', () => {
    expect(parseDuration('45')).toBe(45)
  })
})

describe('formatDurationValue', () => {
  it('always pads to HH:MM:SS, so the field opens on a full format', () => {
    expect(formatDurationValue(4223)).toBe('01:10:23')
    expect(formatDurationValue(45)).toBe('00:00:45')
  })

  it('never goes negative', () => {
    expect(formatDurationValue(-10)).toBe('00:00:00')
  })

  it('round-trips through the parser', () => {
    for (const seconds of [0, 45, 623, 4223, 86399]) {
      expect(parseDuration(formatDurationValue(seconds))).toBe(seconds)
    }
  })
})

describe('describeDuration', () => {
  /*
   * The words are the confirmation. With the colons inserted automatically,
   * `01:10:23` can be misread at a glance; "1h 10m 23s" cannot.
   */
  it('says what the digits meant', () => {
    expect(describeDuration(4223)).toBe('1h 10m 23s')
    expect(describeDuration(623)).toBe('10m 23s')
    expect(describeDuration(45)).toBe('45s')
  })

  it('keeps minutes visible once there are hours, so 1h 0m 5s is not read as 1h 5s', () => {
    expect(describeDuration(3605)).toBe('1h 0m 5s')
  })
})
