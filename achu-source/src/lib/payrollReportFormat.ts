export const money = (n: number) =>
  `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Hours, to one place. `7.5h`, not `7.50h` and not 450. */
export const hours = (n: number) => `${Math.round(n * 100) / 100}h`;

