import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateExcel } from "@/lib/excel-export";

// GET /api/reports/inventory?type=stock|lowstock|expiry&format=json|excel
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "stock";
  const format = searchParams.get("format") ?? "json";
  const toParam = searchParams.get("to");

  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      select: {
        id: true, name: true, sku: true, sellingPrice: true, bundleSize: true, lowStockThreshold: true, hasExpiry: true,
        category: { select: { name: true } },
        batches: {
          where: { active: true },
          select: { id: true, qtyRemaining: true, landedCostPerUnit: true, expiryDate: true, batchNumber: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const now = new Date();
    // Near-expiry cutoff: use `to` if provided, else default to today + 30 days.
    const alertDate = toParam ? new Date(toParam) : (() => {
      const d = new Date(now);
      d.setDate(now.getDate() + 30);
      return d;
    })();

    const stockData = products.map((p) => {
      const totalQty = p.batches.reduce((s, b) => s + Number(b.qtyRemaining), 0);
      const totalValue = p.batches.reduce((s, b) => s + Number(b.qtyRemaining) * Number(b.landedCostPerUnit), 0);
      const nearestExpiry = p.batches
        .filter((b) => b.expiryDate && Number(b.qtyRemaining) > 0)
        .sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime())[0];
      const perUnitPrice = Number(p.sellingPrice) / (Number(p.bundleSize) || 1);
      return {
        id: p.id, name: p.name, sku: p.sku, category: p.category.name,
        sellingPrice: perUnitPrice,
        totalQty, totalValue, threshold: p.lowStockThreshold,
        isLowStock: totalQty < p.lowStockThreshold,
        nearestExpiry: nearestExpiry?.expiryDate ?? null,
        isNearExpiry: nearestExpiry?.expiryDate ? new Date(nearestExpiry.expiryDate) <= alertDate : false,
        batchCount: p.batches.length,
      };
    });

    let filtered = stockData;
    if (type === "lowstock") filtered = stockData.filter((p) => p.isLowStock);
    if (type === "expiry") filtered = stockData.filter((p) => p.isNearExpiry);

    const totalStockValue = filtered.reduce((s, p) => s + p.totalValue, 0);
    const totalRetailValue = filtered.reduce((s, p) => s + p.totalQty * p.sellingPrice, 0);

    if (format === "excel") {
      const rows = filtered.map((p) => ({
        "Product": p.name,
        "SKU": p.sku,
        "Category": p.category,
        "Stock Qty": p.totalQty,
        "Stock Value (Cost)": p.totalValue.toFixed(2),
        "Selling Price": p.sellingPrice.toFixed(2),
        "Retail Value": (p.totalQty * p.sellingPrice).toFixed(2),
        "Low Stock": p.isLowStock ? "YES" : "",
        "Nearest Expiry": p.nearestExpiry ? new Date(p.nearestExpiry).toLocaleDateString("en-IN") : "",
      }));
      const buffer = generateExcel(rows, "Inventory Report");
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="inventory_${type}_report.xlsx"`,
        },
      });
    }

    return NextResponse.json({
      data: {
        summary: {
          totalProducts: filtered.length,
          totalStockValue,
          totalRetailValue,
          lowStockCount: stockData.filter((p) => p.isLowStock).length,
          nearExpiryCount: stockData.filter((p) => p.isNearExpiry).length,
        },
        products: filtered,
      },
    });
  } catch (err) {
    console.error("Inventory report error:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
