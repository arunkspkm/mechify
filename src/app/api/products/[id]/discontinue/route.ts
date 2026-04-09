import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const discontinueSchema = z.object({
  writeOffStock: z.boolean().default(false),
  reason: z.string().optional().default("Product discontinued"),
});

/**
 * POST /api/products/[id]/discontinue
 * Deactivates a product and optionally writes off all remaining stock.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden — Owner only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = discontinueSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { writeOffStock, reason } = parsed.data;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      active: true,
      batches: {
        where: { active: true, qtyRemaining: { gt: 0 } },
        select: { id: true, qtyRemaining: true, landedCostPerUnit: true },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  try {
    let totalWrittenOff = 0;
    let totalValueLost = 0;

    // Get or create a "Discontinued" write-off reason
    if (writeOffStock && product.batches.length > 0) {
      let discontinuedReason = await prisma.masterData.findFirst({
        where: { type: "STOCK_ADJUSTMENT_REASON", name: "Discontinued" },
      });

      if (!discontinuedReason) {
        discontinuedReason = await prisma.masterData.create({
          data: {
            type: "STOCK_ADJUSTMENT_REASON",
            name: "Discontinued",
            displayOrder: 10,
          },
        });
      }

      // Write off all remaining stock
      for (const batch of product.batches) {
        const qty = Number(batch.qtyRemaining);
        const valueLost = qty * Number(batch.landedCostPerUnit);

        await prisma.stockWriteOff.create({
          data: {
            productId: id,
            batch: { connect: { id: batch.id } },
            qty,
            valueLost,
            reason: { connect: { id: discontinuedReason.id } },
            submittedBy: { connect: { id: session.user.id } },
            approvedBy: { connect: { id: session.user.id } },
            notes: reason,
            status: "APPROVED",
          },
        });

        // Deduct stock
        await prisma.batch.update({
          where: { id: batch.id },
          data: { qtyRemaining: 0 },
        });

        totalWrittenOff += qty;
        totalValueLost += valueLost;
      }
    }

    // Deactivate the product
    await prisma.product.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json({
      data: {
        productName: product.name,
        deactivated: true,
        stockWrittenOff: writeOffStock,
        totalWrittenOff,
        totalValueLost: Math.round(totalValueLost * 100) / 100,
      },
    });
  } catch (err) {
    console.error("Discontinue error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
