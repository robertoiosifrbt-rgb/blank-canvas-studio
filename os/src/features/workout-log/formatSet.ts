import type { FieldType } from '../exercises'
import type { SetValues } from './types'

export function formatSet(set: SetValues, fieldTypes: FieldType[]): string {
  const named = fieldTypes
    .filter(({ id }) => set[id] !== undefined)
    .map(({ id, label, unit }) => (unit ? `${set[id]}${unit}` : `${set[id]} ${label.toLowerCase()}`))

  /*
   * Values whose track is no longer in the list — a custom track deleted in an
   * older version, or a backup restored without it. They used to be dropped
   * silently, so a set that held nothing else came out blank: three empty
   * pills under "Last time", an empty line in the log. The number without its
   * label is still the number.
   */
  const unlabelled = Object.entries(set)
    .filter(([fieldId]) => !fieldTypes.some((field) => field.id === fieldId))
    .map(([, value]) => String(value))

  return [...named, ...unlabelled].join(' · ')
}
