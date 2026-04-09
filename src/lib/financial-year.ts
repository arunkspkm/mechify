/**
 * Indian Financial Year utilities (April-March)
 */

/**
 * Get the financial year string for a given date.
 * E.g., April 2026 → "2026-27", March 2027 → "2026-27"
 */
export function getFinancialYear(date: Date, startMonth = 4): string {
  const month = date.getMonth() + 1; // 1-based
  const year = date.getFullYear();

  const fyStartYear = month >= startMonth ? year : year - 1;
  const fyEndYear = fyStartYear + 1;

  return `${fyStartYear}-${String(fyEndYear).slice(2)}`;
}

/**
 * Get the start date of a financial year.
 * E.g., "2026-27" → April 1, 2026
 */
export function getFinancialYearStart(fy: string, startMonth = 4): Date {
  const startYear = parseInt(fy.split("-")[0], 10);
  return new Date(startYear, startMonth - 1, 1);
}

/**
 * Get the end date of a financial year.
 * E.g., "2026-27" → March 31, 2027
 */
export function getFinancialYearEnd(fy: string, startMonth = 4): Date {
  const startYear = parseInt(fy.split("-")[0], 10);
  const endYear = startYear + 1;
  return new Date(endYear, startMonth - 1, 0); // Last day of month before startMonth
}
