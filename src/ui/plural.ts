// Counting out loud, in one place. "1 day" and "12 days" are the same rule.

/** "1 item" / "14 items". */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}
