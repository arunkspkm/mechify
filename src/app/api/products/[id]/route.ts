import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { productUpdateSchema } from "@/types/product";
import { formatValidationError } from "@/lib/validation";
import { createNotification } from "@/lib/notify";

// GET /api/products/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        unit: true,
        taxRate: true,
        images: { orderBy: { isPrimary: "desc" } },
        companionProducts: {
          include: {
            companionProduct: {
              select: { id: true, name: true, sku: true, sellingPrice: true },
            },
          },
        },
        companionOf: {
          include: {
            primaryProduct: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
        batches: {
          where: { active: true, qtyRemaining: { gt: 0 } },
          orderBy: { purchaseDate: "asc" },
          take: 10,
          include: {
            supplier: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ data: product });
  } catch (err) {
    console.error("Product detail error:", err);
    return NextResponse.json({ error: "Failed to fetch product details" }, { status: 500 });
  }
}

// PATCH /api/products/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  try {
  const parsed = productUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  const { companionProductIds, ...updateData } = parsed.data;

  // Check SKU uniqueness if changing
  if (updateData.sku) {
    const existing = await prisma.product.findFirst({
      where: { sku: updateData.sku, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `SKU "${updateData.sku}" is already in use` },
        { status: 409 }
      );
    }
  }

  // Update companion products if provided
  if (companionProductIds) {
    await prisma.productCompanion.deleteMany({
      where: { primaryProductId: id },
    });
    if (companionProductIds.length > 0) {
      await prisma.productCompanion.createMany({
        data: companionProductIds.map((companionId) => ({
          primaryProductId: id,
          companionProductId: companionId,
        })),
      });
    }
  }

  // Check if MRP, selling price, or tax rate changed — log it
  const reason = body.priceChangeReason as string | undefined;
  const current = await prisma.product.findUnique({
    where: { id },
    select: {
      mrp: true,
      sellingPrice: true,
      taxRateId: true,
      taxRate: { select: { name: true } },
    },
  });

  let priceChanged = false;
  let resolvedNewSellingPrice = 0;

  if (current) {
    const oldMrp = Number(current.mrp);
    const oldSellingPrice = Number(current.sellingPrice);
    const newMrp = updateData.mrp !== undefined ? Number(updateData.mrp) : oldMrp;
    const newSellingPrice = updateData.sellingPrice !== undefined ? Number(updateData.sellingPrice) : oldSellingPrice;
    priceChanged = oldMrp !== newMrp || oldSellingPrice !== newSellingPrice;
    resolvedNewSellingPrice = newSellingPrice;

    const oldTaxRateId = current.taxRateId;
    const newTaxRateId = updateData.taxRateId !== undefined ? updateData.taxRateId : oldTaxRateId;
    const taxChanged = oldTaxRateId !== newTaxRateId;

    if (priceChanged || taxChanged) {
      let newTaxRateName: string | null = null;
      if (taxChanged && newTaxRateId) {
        const newTaxRate = await prisma.masterData.findUnique({
          where: { id: newTaxRateId },
          select: { name: true },
        });
        newTaxRateName = newTaxRate?.name ?? null;
      }

      await prisma.productPriceChange.create({
        data: {
          product: { connect: { id } },
          changedBy: { connect: { id: session.user.id } },
          changeType: priceChanged && taxChanged ? "BOTH" : taxChanged ? "TAX_RATE" : "PRICE",
          oldMrp,
          newMrp,
          oldSellingPrice,
          newSellingPrice,
          oldTaxRateId: oldTaxRateId ?? null,
          oldTaxRateName: current.taxRate?.name ?? null,
          newTaxRateId: newTaxRateId ?? null,
          newTaxRateName,
          reason: reason ?? null,
        },
      });
    }
  }

  // Check if bundle size changed — need to recalculate existing batches
  const oldProduct = await prisma.product.findUnique({
    where: { id },
    select: { bundleSize: true },
  });
  const oldBundleSize = Number(oldProduct?.bundleSize ?? 1);
  const newBundleSize = updateData.bundleSize !== undefined ? Number(updateData.bundleSize) : oldBundleSize;
  const bundleSizeChanged = oldBundleSize !== newBundleSize && newBundleSize > 0 && oldBundleSize > 0;

  const product = await prisma.product.update({
    where: { id },
    data: updateData,
    include: {
      category: true,
      brand: true,
      unit: true,
      images: true,
      companionProducts: { include: { companionProduct: true } },
    },
  });

  // Recalculate active batches AND product prices when bundle size changes
  if (bundleSizeChanged) {
    const ratio = newBundleSize / oldBundleSize;

    // Recalculate batches only — selling price/MRP must be set by user
    const batches = await prisma.batch.findMany({
      where: { productId: id, active: true },
    });

    for (const batch of batches) {
      const newQtyReceived = Math.round(Number(batch.qtyReceived) * ratio);
      const newQtyRemaining = Math.round(Number(batch.qtyRemaining) * ratio);
      const newUnitCost = Number(batch.unitCost) / ratio;
      const newLanded = Number(batch.landedCostPerUnit) / ratio;

      await prisma.batch.update({
        where: { id: batch.id },
        data: {
          qtyReceived: newQtyReceived,
          qtyRemaining: newQtyRemaining,
          unitCost: newUnitCost,
          landedCostPerUnit: newLanded,
        },
      });
    }
  }

  if (priceChanged) {
    try {
      await createNotification({
        type: "PRICE_UPDATED",
        title: "Price Updated",
        message: `${product.name} — new price Rs.${resolvedNewSellingPrice}`,
        link: `/products/${id}`,
      });
    } catch {}
  }

  return NextResponse.json({ data: product, batchesRecalculated: bundleSizeChanged });
  } catch (err) {
    console.error("Product update error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Update failed: ${message}` }, { status: 500 });
  }
}
