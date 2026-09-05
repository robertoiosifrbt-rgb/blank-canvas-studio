import { describe, expect, it } from 'vitest'

import { hoursAndMinutes, penceOf, pounds, readingOf } from './money'

describe('pounds', () => {
  it('keeps the pence, always two of them', () => {
    expect(pounds(12645)).toBe('£126.45')
    expect(pounds(500)).toBe('£5.00')
    expect(pounds(5)).toBe('£0.05')
    expect(pounds(0)).toBe('£0.00')
  })
})

describe('hoursAndMinutes', () => {
  it('reads like a day, not like a decimal', () => {
    expect(hoursAndMinutes(210)).toBe('3h 30m')
    expect(hoursAndMinutes(180)).toBe('3h')
    expect(hoursAndMinutes(45)).toBe('45m')
    expect(hoursAndMinutes(0)).toBe('0m')
  })
})

describe('penceOf', () => {
  it('takes what a person actually types', () => {
    expect(penceOf('64.20')).toBe(6420)
    expect(penceOf('64,20')).toBe(6420)
    expect(penceOf('£64.20')).toBe(6420)
    expect(penceOf(' 64 ')).toBe(6400)
  })

  it('treats empty as nothing said, not as zero', () => {
    expect(penceOf('')).toBeNull()
    expect(penceOf('   ')).toBeNull()
  })

  it('refuses what is not an amount instead of guessing', () => {
    expect(() => penceOf('abc')).toThrow()
    expect(() => penceOf('64.203')).toThrow()
    expect(() => penceOf('-5')).toThrow()
  })
})

describe('readingOf', () => {
  it('takes an odometer to one decimal', () => {
    expect(readingOf('120345')).toBe(120345)
    expect(readingOf('120345.6')).toBe(120345.6)
    expect(readingOf('')).toBeNull()
  })

  it('refuses more precision than an odometer has', () => {
    expect(() => readingOf('120345.67')).toThrow()
  })
})
