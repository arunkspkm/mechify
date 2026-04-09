/**
 * GST calculation helpers for Indian tax system.
 * CGST + SGST for intra-state, IGST for inter-state.
 */

export interface GSTResult {
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  totalWithTax: number;
}

/**
 * Calculate GST on a taxable amount.
 * When GST is disabled, returns zero tax amounts.
 */
export function calculateGST(
  taxableAmount: number,
  taxRatePercent: number,
  gstEnabled: boolean,
  isInterState = false
): GSTResult {
  if (!gstEnabled || taxRatePercent <= 0) {
    return {
      taxableAmount,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      totalTax: 0,
      totalWithTax: taxableAmount,
    };
  }

  if (isInterState) {
    const igstAmount = round2(taxableAmount * (taxRatePercent / 100));
    return {
      taxableAmount,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: taxRatePercent,
      igstAmount,
      totalTax: igstAmount,
      totalWithTax: round2(taxableAmount + igstAmount),
    };
  }

  const halfRate = taxRatePercent / 2;
  const cgstAmount = round2(taxableAmount * (halfRate / 100));
  const sgstAmount = round2(taxableAmount * (halfRate / 100));
  const totalTax = round2(cgstAmount + sgstAmount);

  return {
    taxableAmount,
    cgstRate: halfRate,
    cgstAmount,
    sgstRate: halfRate,
    sgstAmount,
    igstRate: 0,
    igstAmount: 0,
    totalTax,
    totalWithTax: round2(taxableAmount + totalTax),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
