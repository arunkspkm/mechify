/**
 * Distribute handling/courier charges proportionally across line items
 * to calculate the true landed cost per unit.
 */

export interface LandedCostLineItem {
  unitCost: number;
  qty: number;
}

export interface LandedCostResult {
  landedCostPerUnit: number;
  handlingPerUnit: number;
}

/**
 * Distribute a handling charge proportionally across line items by their value.
 *
 * Example: 2 items costing Rs.1000 and Rs.500, handling Rs.150
 * Item 1 gets Rs.100 handling (1000/1500 * 150), Item 2 gets Rs.50 (500/1500 * 150)
 */
export function distributeLandedCost(
  lineItems: LandedCostLineItem[],
  totalHandlingCharge: number
): LandedCostResult[] {
  if (totalHandlingCharge <= 0 || lineItems.length === 0) {
    return lineItems.map((item) => ({
      landedCostPerUnit: item.unitCost,
      handlingPerUnit: 0,
    }));
  }

  const totalValue = lineItems.reduce(
    (sum, item) => sum + item.unitCost * item.qty,
    0
  );

  if (totalValue <= 0) {
    // Distribute equally if total value is zero
    const perItem = totalHandlingCharge / lineItems.length;
    return lineItems.map((item) => ({
      landedCostPerUnit: round2(item.unitCost + (item.qty > 0 ? perItem / item.qty : 0)),
      handlingPerUnit: round2(item.qty > 0 ? perItem / item.qty : 0),
    }));
  }

  return lineItems.map((item) => {
    const itemValue = item.unitCost * item.qty;
    const proportion = itemValue / totalValue;
    const handlingForItem = totalHandlingCharge * proportion;
    const handlingPerUnit = item.qty > 0 ? handlingForItem / item.qty : 0;

    return {
      landedCostPerUnit: round2(item.unitCost + handlingPerUnit),
      handlingPerUnit: round2(handlingPerUnit),
    };
  });
}

/**
 * Calculate landed cost for a single item with handling charge.
 */
export function calculateSingleLandedCost(
  unitCost: number,
  qty: number,
  handlingCharge: number
): number {
  if (qty <= 0) return unitCost;
  return round2(unitCost + handlingCharge / qty);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
