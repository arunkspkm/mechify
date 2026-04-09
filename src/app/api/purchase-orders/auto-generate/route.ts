import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/purchase-orders/auto-generate — Preview suggested POs based on low stock.
 * Groups low-stock products by their last supplier and suggests quantities.
 */
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all active products with their stock levels
  const products = await prisma.product.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      sku: true,
      lowStockThreshold: true,
      sellingPrice: true,
      batches: {
        where: { active: true },
        orderBy: { purchaseDate: "desc" },
        select: {
          qtyRemaining: true,
          unitCost: true,
          supplierId: true,
          supplier: { select: { id: true, name: true } },
        },
      },
      // Get last supplier from purchase invoices
      purchaseInvoiceItems: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          unitCost: true,
          purchaseInvoice: {
            select: {
              supplierId: true,
              supplier: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  // Get product IDs that already have open POs (DRAFT, SENT, or PARTIALLY_RECEIVED)
  const openPOItems = await prisma.purchaseOrderItem.findMany({
    where: {
      purchaseOrder: {
        status: { in: ["DRAFT", "SENT", "PARTIALLY_RECEIVED"] },
      },
    },
    select: { productId: true },
  });
  const productsWithOpenPO = new Set(openPOItems.map((i) => i.productId));

  // Find low-stock products, excluding those with open POs
  const lowStockProducts = products
    .map((p) => {
      const totalStock = p.batches.reduce((s, b) => s + Number(b.qtyRemaining), 0);

      // Try purchase invoice first, then fall back to batch-level supplier
      const lastPI = p.purchaseInvoiceItems[0];
      const lastBatchWithSupplier = p.batches.find((b) => b.supplierId);

      const supplierId = lastPI?.purchaseInvoice.supplierId
        ?? lastBatchWithSupplier?.supplierId
        ?? null;
      const supplierName = lastPI?.purchaseInvoice.supplier.name
        ?? lastBatchWithSupplier?.supplier?.name
        ?? null;
      const lastCost = lastPI
        ? Number(lastPI.unitCost)
        : lastBatchWithSupplier
          ? Number(lastBatchWithSupplier.unitCost)
          : 0;

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        currentStock: totalStock,
        threshold: p.lowStockThreshold,
        suggestedQty: Math.max(p.lowStockThreshold * 2 - totalStock, p.lowStockThreshold),
        lastCost,
        lastSupplierId: supplierId,
        lastSupplierName: supplierName,
        hasOpenPO: productsWithOpenPO.has(p.id),
      };
    })
    .filter((p) => p.currentStock <= p.threshold && !p.hasOpenPO);

  // Group by supplier
  const supplierGroups: Record<string, {
    supplierId: string;
    supplierName: string;
    items: typeof lowStockProducts;
    totalEstimatedCost: number;
  }> = {};

  for (const product of lowStockProducts) {
    const key = product.lastSupplierId ?? "unknown";
    if (!supplierGroups[key]) {
      supplierGroups[key] = {
        supplierId: product.lastSupplierId ?? "",
        supplierName: product.lastSupplierName ?? "Unknown Supplier",
        items: [],
        totalEstimatedCost: 0,
      };
    }
    supplierGroups[key].items.push(product);
    supplierGroups[key].totalEstimatedCost += product.suggestedQty * product.lastCost;
  }

  return NextResponse.json({
    data: {
      lowStockCount: lowStockProducts.length,
      supplierGroups: Object.values(supplierGroups),
    },
  });
}
