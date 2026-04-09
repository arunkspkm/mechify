import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/products/[id]/price-history — All batches for a product showing cost trends.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const batches = await prisma.batch.findMany({
    where: { productId: id },
    select: {
      id: true,
      batchNumber: true,
      purchaseDate: true,
      qtyReceived: true,
      qtyRemaining: true,
      unitCost: true,
      handlingCharge: true,
      landedCostPerUnit: true,
      expiryDate: true,
      supplier: { select: { name: true } },
      qualityGrade: { select: { name: true } },
    },
    orderBy: { purchaseDate: "desc" },
  });

  const history = batches.map((b) => ({
    id: b.id,
    batchNumber: b.batchNumber,
    date: b.purchaseDate,
    supplier: b.supplier?.name ?? "Unknown",
    qtyReceived: Number(b.qtyReceived),
    qtyRemaining: Number(b.qtyRemaining),
    unitCost: Number(b.unitCost),
    handlingCharge: Number(b.handlingCharge),
    landedCost: Number(b.landedCostPerUnit),
    qualityGrade: b.qualityGrade?.name ?? null,
    expiryDate: b.expiryDate,
  }));

  // Calculate stats
  const costs = history.map((h) => h.landedCost).filter((c) => c > 0);
  const stats = {
    avgCost: costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0,
    minCost: costs.length > 0 ? Math.min(...costs) : 0,
    maxCost: costs.length > 0 ? Math.max(...costs) : 0,
    latestCost: costs[0] ?? 0,
    totalBatches: history.length,
  };

  // Get selling price change history
  const priceChanges = await prisma.productPriceChange.findMany({
    where: { productId: id },
    include: { changedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const sellingPriceHistory = priceChanges.map((pc) => ({
    id: pc.id,
    date: pc.createdAt,
    changeType: pc.changeType,
    oldMrp: Number(pc.oldMrp),
    newMrp: Number(pc.newMrp),
    oldSellingPrice: Number(pc.oldSellingPrice),
    newSellingPrice: Number(pc.newSellingPrice),
    oldTaxRateName: pc.oldTaxRateName,
    newTaxRateName: pc.newTaxRateName,
    reason: pc.reason,
    changedBy: pc.changedBy.name,
  }));

  return NextResponse.json({ data: history, stats, sellingPriceHistory });
}
