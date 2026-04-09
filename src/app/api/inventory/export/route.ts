import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateExcel } from "@/lib/excel-export";

/**
 * GET /api/inventory/export — Download current inventory as Excel.
 */
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    include: {
      category: { select: { name: true } },
      unit: { select: { name: true, code: true } },
      taxRate: { select: { name: true, metadata: true } },
      batches: {
        where: { active: true, qtyRemaining: { gt: 0 } },
        select: {
          qtyRemaining: true,
          landedCostPerUnit: true,
          unitCost: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = products.map((p) => {
    const totalStock = p.batches.reduce((s, b) => s + Number(b.qtyRemaining), 0);
    const totalValue = p.batches.reduce(
      (s, b) => s + Number(b.qtyRemaining) * Number(b.landedCostPerUnit),
      0
    );
    const avgCost = totalStock > 0 ? totalValue / totalStock : 0;

    return {
      "Product Name": p.name,
      SKU: p.sku,
      "HSN Code": p.hsnCode ?? "",
      Category: p.category.name,
      Unit: p.unit.code ?? p.unit.name,
      MRP: Number(p.mrp),
      "Selling Price": Number(p.sellingPrice),
      "Tax Rate": p.taxRate?.name ?? "",
      "Current Stock": Math.round(totalStock * 100) / 100,
      "Avg Landed Cost": Math.round(avgCost * 100) / 100,
      "Stock Value": Math.round(totalValue * 100) / 100,
    };
  });

  const buffer = generateExcel(rows, "Inventory");

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventory_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
