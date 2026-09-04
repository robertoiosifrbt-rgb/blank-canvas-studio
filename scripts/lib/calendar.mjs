// Driving the Calendar's month grid from a browser check.
//
// The Calendar opens on today, so any other day is a mark on the grid until it
// is asked for. A check that wants to see tomorrow has to tap it, the way a
// finger would.

/**
 * The cell for a day of the month on show.
 *
 * The days that only fill the week out are excluded on purpose: a grid spills
 * either side, so the same number can appear twice.
 */
export function dayCell(page, day) {
  const number = String(Number(day.slice(8, 10)))
  return page.locator('.month-cell:not(.month-cell-outside)', {
    has: page.locator('.month-date', { hasText: new RegExp(`^${number}$`) }),
  })
}

/** Whether two days fall in the same month. */
export function sameMonth(a, b) {
  return a.slice(0, 7) === b.slice(0, 7)
}

/** Taps a day, stepping to the next month first when it lives there. */
export async function pickDay(page, day, today) {
  if (!sameMonth(day, today)) {
    await page.click('button[aria-label="Next month"]')
  }
  await dayCell(page, day).first().click()
}
