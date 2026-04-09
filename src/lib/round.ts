/**
 * Round to 2 decimal places for financial calculations.
 * Avoids floating point issues like 0.1 + 0.2 = 0.30000000000000004
 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
