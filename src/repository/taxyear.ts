// The UK tax year: 6 April to 5 April.
//
// Not the calendar year and not a month, which is why nothing already here
// could answer "what have I earned this year". `periodMoney` takes a stretch
// of days, so the only thing missing was the stretch.

/** A tax year, as the days that bound it and the name HMRC uses. */
export type TaxYear = {
  /** 6 April, 'YYYY-MM-DD'. */
  from: string
  /** 5 April of the next calendar year. */
  to: string
  /** How it is written on a tax return: '2026/27'. */
  label: string
}

/** The tax year a day falls in. Days are 'YYYY-MM-DD'. */
export function taxYearOf(day: string): TaxYear {
  const year = Number(day.slice(0, 4))
  // Before 6 April, the day belongs to the year that started last April.
  const starts = day >= `${year}-04-06` ? year : year - 1
  return {
    from: `${starts}-04-06`,
    to: `${starts + 1}-04-05`,
    label: `${starts}/${String((starts + 1) % 100).padStart(2, '0')}`,
  }
}
