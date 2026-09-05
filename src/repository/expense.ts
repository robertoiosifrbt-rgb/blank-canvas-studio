// The shape of money going out.
//
// One row per anchor item, like a shift's numbers: an expense happened on a
// day, and the day is the item's.

import { asRecord, optionalNumber, requiredText } from './row'
import type { Fill } from './fuel'

export const CATEGORIES = ['fuel', 'repair', 'insurance', 'other'] as const
export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_NAMES: Record<Category, string> = {
  fuel: 'Fuel',
  repair: 'Repair',
  insurance: 'Insurance',
  other: 'Something else',
}

export type Expense = {
  item_id: string
  owner: string
  amount: number
  category: Category
  /** The odometer at the pump. Only a fuel purchase has one. */
  odo: number | null
  /** Whether the tank was filled. Only a fuel purchase has one. */
  full_tank: boolean | null
}

export function expenseFromRow(row: unknown): Expense {
  const raw = asRecord(row)

  const category = requiredText(raw, 'category')
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    throw new Error(`Unknown category: ${category}`)
  }

  const amount = optionalNumber(raw, 'amount')
  if (amount === null) throw new Error('Expense without an amount')
  if (amount < 0) throw new Error(`An expense below nothing: ${amount}`)

  const odo = optionalNumber(raw, 'odo')
  // Normalised once: a missing column and an explicit null are the same
  // absence, and the checks below have to agree about that. Comparing the raw
  // value against null alone treats undefined as present, which refuses every
  // non-fuel expense that simply has no such column.
  const raw_full = raw['full_tank']
  if (raw_full !== null && raw_full !== undefined && typeof raw_full !== 'boolean') {
    throw new Error('full_tank is not a yes or no')
  }
  const full_tank = raw_full ?? null

  // The database says the pump details belong to fuel and nothing else, so a
  // row saying otherwise did not come from there as it stands.
  if (category !== 'fuel' && (odo !== null || full_tank !== null)) {
    throw new Error(`A ${category} expense carrying pump details`)
  }

  return {
    item_id: requiredText(raw, 'item_id'),
    owner: requiredText(raw, 'owner'),
    amount,
    category: category as Category,
    odo,
    full_tank,
  }
}

/**
 * The fill-ups among a set of expenses, as the rate wants them.
 *
 * A fuel purchase with no reading cannot take part: without an odometer it
 * measures no distance. Its money is lost to the rate — which is a reason to
 * write the reading down, not a reason to guess one.
 */
export function fillsOf(expenses: readonly Expense[]): Fill[] {
  const fills: Fill[] = []
  for (const expense of expenses) {
    if (expense.category !== 'fuel' || expense.odo === null) continue
    fills.push({
      pence: Math.round(expense.amount * 100),
      odo: expense.odo,
      full: expense.full_tank === true,
    })
  }
  return fills
}
