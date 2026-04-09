import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const bulkTaxUpdateSchema = z.object({
  productIds: z.array(z.string()).min(1, "Select at least one product"),
  newTaxRateId: z.string().min(1, "New tax rate is required"),
  reason: z.string().min(1, "Reason is required (e.g., GST notification number)"),
});

// GET /api/products/bulk-tax-update?filterType=HSN&filterValue=85182900
// Preview which products will be affected
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const filterType = searchParams.get("filterType");
  const filterValue = searchParams.get("filterValue");

  const where: Record<string, unknown> = { active: true };

  if (filterType === "HSN" && filterValue) {
    where.hsnCode = filterValue;
  } else if (filterType === "CATEGORY" && filterValue) {
    where.categoryId = filterValue;
  }

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      sku: true,
      hsnCode: true,
      mrp: true,
      sellingPrice: true,
      taxRateId: true,
      taxRate: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: products, count: products.length });
}

// POST /api/products/bulk-tax-update — Apply new tax rate to filtered products
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = bulkTaxUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { productIds, newTaxRateId, reason } = parsed.data;

  try {
    // Get the new tax rate name
    const newTaxRate = await prisma.masterData.findUnique({
      where: { id: newTaxRateId },
      select: { name: true },
    });

    if (!newTaxRate) {
      return NextResponse.json({ error: "Tax rate not found" }, { status: 404 });
    }

    // Find selected products
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        mrp: true,
        sellingPrice: true,
        taxRateId: true,
        taxRate: { select: { name: true } },
      },
    });

    let updated = 0;
    let skipped = 0;

    for (const product of products) {
      // Skip if already on the same tax rate
      if (product.taxRateId === newTaxRateId) {
        skipped++;
        continue;
      }

      // Log the change
      await prisma.productPriceChange.create({
        data: {
          product: { connect: { id: product.id } },
          changedBy: { connect: { id: session.user.id } },
          changeType: "TAX_RATE",
          oldMrp: Number(product.mrp),
          newMrp: Number(product.mrp),
          oldSellingPrice: Number(product.sellingPrice),
          newSellingPrice: Number(product.sellingPrice),
          oldTaxRateId: product.taxRateId ?? null,
          oldTaxRateName: product.taxRate?.name ?? null,
          newTaxRateId,
          newTaxRateName: newTaxRate.name,
          reason,
        },
      });

      // Update the product
      await prisma.product.update({
        where: { id: product.id },
        data: { taxRateId: newTaxRateId },
      });

      updated++;
    }

    return NextResponse.json({
      data: {
        updated,
        skipped,
        total: products.length,
        newTaxRate: newTaxRate.name,
      },
    });
  } catch (err) {
    console.error("Bulk tax update error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
