import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Fast product search for POS screen.
 * GET /api/products/search?q=speaker&limit=20
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  if (q.length < 1) {
    return NextResponse.json({ data: [] });
  }

  const products = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { barcode: q }, // Exact match for barcode
      ],
    },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      sellingPrice: true,
      mrp: true,
      installationCharge: true,
      hasExpiry: true,
      bundleSize: true,
      hsnCode: true,
      maxDiscountPercent: true,
      unit: { select: { id: true, name: true, code: true } },
      taxRate: { select: { id: true, name: true, metadata: true } },
      category: { select: { id: true, name: true } },
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
      companionProducts: {
        include: {
          companionProduct: {
            select: { id: true, name: true, sku: true, sellingPrice: true },
          },
        },
      },
      // Last batch info for auto-filling stock inward form
      batches: {
        where: { active: true },
        orderBy: { purchaseDate: "desc" },
        take: 1,
        select: {
          unitCost: true,
          handlingCharge: true,
          landedCostPerUnit: true,
          supplierId: true,
          supplier: { select: { id: true, name: true } },
          qualityGrade: { select: { id: true, name: true } },
        },
      },
    },
    take: limit,
    orderBy: { name: "asc" },
  });

  // Add stock info
  const productsWithStock = await Promise.all(
    products.map(async (product) => {
      const stockResult = await prisma.batch.aggregate({
        where: {
          productId: product.id,
          active: true,
          qtyRemaining: { gt: 0 },
          OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
        },
        _sum: { qtyRemaining: true },
      });

      const lastBatch = product.batches[0] ?? null;
      const unitCost = lastBatch ? Number(lastBatch.unitCost) : 0;

      return {
        ...product,
        stock: Number(stockResult._sum.qtyRemaining ?? 0),
        primaryImage: product.images[0]?.url ?? null,
        lastBatch: {
          // Only use actual purchase cost from batches, never fall back to selling price
          unitCost: unitCost > 0 ? unitCost : 0,
          handlingCharge: lastBatch ? Number(lastBatch.handlingCharge) : 0,
          landedCostPerUnit: lastBatch ? Number(lastBatch.landedCostPerUnit) : 0,
          supplierId: lastBatch?.supplierId ?? null,
          supplierName: lastBatch?.supplier?.name ?? null,
          qualityGradeId: lastBatch?.qualityGrade?.id ?? null,
        },
      };
    })
  );

  return NextResponse.json({ data: productsWithStock });
}
