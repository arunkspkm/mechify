import { prisma } from "@/lib/prisma";

export interface BatchAllocation {
  batchId: string;
  qty: number;
  landedCostPerUnit: number;
}

/**
 * Select batches for a product using FIFO (First In, First Out)
 * or FEFO (First Expiry, First Out) for expiry-tracked products.
 *
 * Returns an array of batch allocations that sum to the required quantity.
 * Throws if insufficient stock.
 */
export async function selectBatches(
  productId: string,
  requiredQty: number
): Promise<BatchAllocation[]> {
  // Get product to check if it has expiry tracking
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { hasExpiry: true, name: true },
  });

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  // Get available batches, ordered by FEFO or FIFO
  const batches = await prisma.batch.findMany({
    where: {
      productId,
      active: true,
      qtyRemaining: { gt: 0 },
      // Exclude expired batches
      ...(product.hasExpiry
        ? { OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }] }
        : {}),
    },
    orderBy: product.hasExpiry
      ? [{ expiryDate: "asc" }, { purchaseDate: "asc" }] // FEFO
      : [{ purchaseDate: "asc" }], // FIFO
  });

  const allocations: BatchAllocation[] = [];
  let remaining = requiredQty;

  for (const batch of batches) {
    if (remaining <= 0) break;

    const available = Number(batch.qtyRemaining);
    const allocQty = Math.min(available, remaining);

    allocations.push({
      batchId: batch.id,
      qty: allocQty,
      landedCostPerUnit: Number(batch.landedCostPerUnit),
    });

    remaining -= allocQty;
  }

  if (remaining > 0) {
    throw new Error(
      `Insufficient stock for "${product.name}". Required: ${requiredQty}, Available: ${requiredQty - remaining}`
    );
  }

  return allocations;
}

/**
 * Get total available stock for a product (excluding expired batches).
 */
export async function getAvailableStock(productId: string): Promise<number> {
  const result = await prisma.batch.aggregate({
    where: {
      productId,
      active: true,
      qtyRemaining: { gt: 0 },
      OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
    },
    _sum: { qtyRemaining: true },
  });

  return Number(result._sum.qtyRemaining ?? 0);
}
