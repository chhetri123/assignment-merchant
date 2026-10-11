// Up to 12 digits with at most 2 decimal places, matching numeric(14,2).
export const DECIMAL_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

// Money stays a decimal string from request to database and back, so it never
// passes through a float. Comparisons use integer minor units.
export function toMinorUnits(amount: string): bigint {
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function isPositiveAmount(amount: string): boolean {
  return DECIMAL_PATTERN.test(amount) && toMinorUnits(amount) > 0n;
}
