/**
 * Margin protection — prevents selling below landed cost.
 *
 * Hard rule: Counter operators cannot sell below (landedCost + 10%).
 * The minimum selling price = landedCost × 1.10
 * Only the owner can override this.
 */

const MIN_MARGIN_PERCENT = 10; // 10% above landed cost — non-negotiable for counter operators

export interface MarginCheckResult {
  allowed: boolean;
  message: string;
  margin: number; // percentage above landed cost
  profit: number; // absolute amount per unit
  minSellingPrice: number; // minimum allowed price for counter operators
}

/**
 * Validate that the selling price (after discount) maintains at least 10% margin
 * above the landed cost for counter operators.
 */
export function validateMargin(
  sellingPrice: number,
  discountAmount: number,
  landedCostPerUnit: number,
  isOwner = false
): MarginCheckResult {
  const effectivePrice = sellingPrice - discountAmount;
  const profit = effectivePrice - landedCostPerUnit;
  const margin =
    landedCostPerUnit > 0
      ? ((effectivePrice - landedCostPerUnit) / landedCostPerUnit) * 100
      : 100;

  const minSellingPrice = landedCostPerUnit > 0
    ? Math.ceil(landedCostPerUnit * (1 + MIN_MARGIN_PERCENT / 100))
    : 0;

  // Hard block: below landed cost (even owner gets warned)
  if (effectivePrice <= landedCostPerUnit) {
    return {
      allowed: false,
      message: `Sale blocked: Selling at Rs.${effectivePrice.toFixed(2)} is at or below landed cost Rs.${landedCostPerUnit.toFixed(2)}. Loss: Rs.${Math.abs(profit).toFixed(2)} per unit.`,
      margin: Math.round(margin * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      minSellingPrice,
    };
  }

  // Counter operator: must maintain 10% margin above landed cost
  if (!isOwner && margin < MIN_MARGIN_PERCENT) {
    return {
      allowed: false,
      message: `Margin too low: ${margin.toFixed(1)}% (minimum ${MIN_MARGIN_PERCENT}% required). Minimum selling price: Rs.${minSellingPrice}. Max discount: Rs.${(sellingPrice - minSellingPrice).toFixed(0)}. Owner approval required.`,
      margin: Math.round(margin * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      minSellingPrice,
    };
  }

  return {
    allowed: true,
    message: `Margin: ${margin.toFixed(1)}% (Rs.${profit.toFixed(2)} profit per unit)`,
    margin: Math.round(margin * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    minSellingPrice,
  };
}

/**
 * Validate that a discount doesn't exceed the maximum allowed percentage.
 */
export function validateDiscount(
  discountPercent: number,
  maxDiscountPercent: number,
  isOwner: boolean
): { allowed: boolean; message: string } {
  if (isOwner) {
    return { allowed: true, message: "Owner override" };
  }

  if (discountPercent > maxDiscountPercent) {
    return {
      allowed: false,
      message: `Discount ${discountPercent}% exceeds maximum allowed ${maxDiscountPercent}%. Owner approval required.`,
    };
  }

  return { allowed: true, message: "" };
}

/**
 * Calculate the maximum discount amount a counter operator can give.
 */
export function getMaxDiscountForOperator(
  sellingPrice: number,
  landedCostPerUnit: number
): number {
  const minSellingPrice = landedCostPerUnit * (1 + MIN_MARGIN_PERCENT / 100);
  return Math.max(0, Math.floor(sellingPrice - minSellingPrice));
}
