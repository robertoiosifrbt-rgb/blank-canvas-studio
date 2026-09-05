import { monthRange, periodMoney } from '../../repository/items'
import type { Expense, Item, Reserves, Shift } from '../../repository/items'
import { hoursAndMinutes, pounds } from '../../shifts/money'
import './MonthMoney.css'

type Props = {
  month: string
  onOpenReserves: () => void
  items: Item[]
  shifts: Shift[]
  expenses: Expense[]
  reserves: Reserves | null
}

/**
 * What the month came to.
 *
 * The honest figure, and the one a shift's sheet cannot give: money that
 * actually left the account, not what a day used up. The two are never added
 * together — that would pay for the same fuel twice.
 *
 * Nothing at all is shown for a month with no work in it. An empty month is
 * not a month that earned nothing; it is a month you have not written down,
 * and a row of zeroes says the wrong one of those.
 */
export function MonthMoney({
  month,
  items,
  shifts,
  expenses,
  reserves,
  onOpenReserves,
}: Props) {
  const sum = periodMoney({ items, shifts, expenses, reserves, ...monthRange(month) })
  if (sum.shifts === 0 && sum.spentPence === 0) return null

  const reserve = sum.taxPence + sum.niPence

  return (
    <section className="money" aria-label="What the month came to">
      <dl className="money-rows">
        <div className="money-row">
          <dt>Made</dt>
          <dd>{pounds(sum.grossPence)}</dd>
        </div>
        <div className="money-row">
          <dt>Spent</dt>
          <dd>−{pounds(sum.spentPence)}</dd>
        </div>
        <div className="money-row money-row-strong">
          <dt>Profit</dt>
          <dd>{pounds(sum.profitPence)}</dd>
        </div>
        {/* The one row you would want to change while looking at it, so it
            is the way in. A button rather than a link somewhere else: the bar
            has room for three screens and the header for two tools. */}
        <div className="money-row">
          <dt>
            <button
              type="button"
              name="reserves"
              className="money-open"
              onClick={onOpenReserves}
            >
              Put aside
            </button>
          </dt>
          <dd>{sum.missingRates ? '—' : `−${pounds(reserve)}`}</dd>
        </div>
        <div className="money-row money-row-left">
          <dt>Left</dt>
          <dd>{sum.missingRates ? '—' : pounds(sum.leftPence)}</dd>
        </div>
      </dl>

      <p className="money-worked">
        {sum.shifts} {sum.shifts === 1 ? 'shift' : 'shifts'} ·{' '}
        {hoursAndMinutes(sum.minutes)} · {sum.km.toFixed(1)} km
      </p>

      {sum.missingRates && (
        <p className="money-note">
          No percentages set yet — tap <strong>Put aside</strong> above.
        </p>
      )}

      {/* A month with work in it and nothing spent is almost always a month
          whose receipts are not written down, not a month that cost nothing.
          Left over is only as true as Spent, and this is the one place that
          can say so before the number is believed. */}
      {sum.spentPence === 0 && sum.shifts > 0 && (
        <p className="money-note">
          Nothing written down as spent. Fuel and the rest go under{' '}
          <strong>Money out</strong> — until they do, Profit is only what came
          in.
        </p>
      )}
    </section>
  )
}
