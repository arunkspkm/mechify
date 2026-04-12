import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/inventory — Stock overview with aggregated batch data per product.
 * Query params: search, category, lowStock=true, nearExpiry=true, page, limit
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const categoryId = searchParams.get("category");
  const supplierId = searchParams.get("supplier");
  const lowStockOnly = searchParams.get("lowStock") === "true";
  const nearExpiryOnly = searchParams.get("nearExpiry") === "true";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "30", 10);

  // Get business config for expiry alert days
  const config = await prisma.businessConfig.findUnique({ where: { id: "default" } });
  const expiryAlertDays = config?.expiryAlertDays ?? 30;
  const alertDate = new Date();
  alertDate.setDate(alertDate.getDate() + expiryAlertDays);

  const where: Record<string, unknown> = { active: true };
  if (categoryId) where.categoryId = categoryId;
  if (supplierId) {
    where.batches = { some: { supplierId, active: true, qtyRemaining: { gt: 0 } } };
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
    ];
  }

  const products = await prisma.product.findMany({
    where,
    include: {
      category: { select: { name: true } },
      unit: { select: { name: true, code: true } },
      images: { where: { isPrimary: true }, take: 1 },
      batches: {
        where: { active: true, qtyRemaining: { gt: 0 } },
        select: {
          id: true,
          qtyRemaining: true,
          landedCostPerUnit: true,
          expiryDate: true,
          purchaseDate: true,
        },
      },
    },
    orderBy: { name: "asc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  const total = await prisma.product.count({ where });

  // Compute stock summary per product
  const data = products.map((product) => {
    const totalStock = product.batches.reduce(
      (sum, b) => sum + Number(b.qtyRemaining),
      0
    );

    const totalValue = product.batches.reduce(
      (sum, b) => sum + Number(b.qtyRemaining) * Number(b.landedCostPerUnit),
      0
    );

    const avgLandedCost =
      totalStock > 0 ? totalValue / totalStock : 0;

    const isLowStock = totalStock < product.lowStockThreshold;

    // Check for near-expiry batches
    const nearExpiryBatches = product.batches.filter(
      (b) => b.expiryDate && new Date(b.expiryDate) <= alertDate
    );
    const expiredBatches = product.batches.filter(
      (b) => b.expiryDate && new Date(b.expiryDate) <= new Date()
    );

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category.name,
      unit: product.unit.code ?? product.unit.name,
      primaryImage: product.images[0]?.url ?? null,
      lowStockThreshold: product.lowStockThreshold,
      totalStock: Math.round(totalStock * 100) / 100,
      stockValue: Math.round(totalValue * 100) / 100,
      avgLandedCost: Math.round(avgLandedCost * 100) / 100,
      isLowStock,
      hasNearExpiry: nearExpiryBatches.length > 0,
      hasExpired: expiredBatches.length > 0,
      batchCount: product.batches.length,
    };
  });

  // Apply post-filters
  let filteredData = data;
  if (lowStockOnly) {
    filteredData = filteredData.filter((d) => d.isLowStock);
  }
  if (nearExpiryOnly) {
    filteredData = filteredData.filter((d) => d.hasNearExpiry || d.hasExpired);
  }

  // Compute summary across ALL matching products (same filters, no pagination)
  const allMatchingProducts = await prisma.product.findMany({
    where,
    select: {
      lowStockThreshold: true,
      batches: {
        where: { active: true, qtyRemaining: { gt: 0 } },
        select: {
          qtyRemaining: true,
          landedCostPerUnit: true,
          expiryDate: true,
        },
      },
    },
  });

  let summaryStockValue = 0;
  let summaryLowStockCount = 0;
  let summaryExpiryCount = 0;

  for (const p of allMatchingProducts) {
    const stock = p.batches.reduce((s, b) => s + Number(b.qtyRemaining), 0);
    const value = p.batches.reduce((s, b) => s + Number(b.qtyRemaining) * Number(b.landedCostPerUnit), 0);

    // Apply same post-filters
    const isLow = stock < p.lowStockThreshold;
    const hasNearExp = p.batches.some((b) => b.expiryDate && new Date(b.expiryDate) <= alertDate);
    const hasExpired = p.batches.some((b) => b.expiryDate && new Date(b.expiryDate) <= new Date());

    if (lowStockOnly && !isLow) continue;
    if (nearExpiryOnly && !hasNearExp && !hasExpired) continue;

    summaryStockValue += value;
    if (isLow) summaryLowStockCount++;
    if (hasNearExp || hasExpired) summaryExpiryCount++;
  }

  return NextResponse.json({
    data: filteredData,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: {
      totalStockValue: Math.round(summaryStockValue * 100) / 100,
      lowStockCount: summaryLowStockCount,
      expiryCount: summaryExpiryCount,
    },
  });
}
