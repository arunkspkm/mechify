import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const updateBatchSchema = z.object({
  unitCost: z.coerce.number().nonnegative().optional(),
  handlingCharge: z.coerce.number().nonnegative().optional(),
  landedCostPerUnit: z.coerce.number().nonnegative().optional(),
  batchNumber: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  qtyRemaining: z.coerce.number().nonnegative().optional(),
});

// GET /api/inventory/batches/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      product: { select: { name: true, sku: true, bundleSize: true } },
      supplier: { select: { name: true } },
      qualityGrade: { select: { name: true } },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  return NextResponse.json({ data: batch });
}

// PATCH /api/inventory/batches/[id] — Edit batch details (Owner only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden — Owner only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateBatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const batch = await prisma.batch.findUnique({ where: { id } });
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (parsed.data.unitCost !== undefined) {
    updateData.unitCost = parsed.data.unitCost;
    // Recalculate landed cost if unit cost changes
    const handling = parsed.data.handlingCharge ?? Number(batch.handlingCharge);
    const qtyReceived = Number(batch.qtyReceived);
    const handlingPerUnit = qtyReceived > 0 ? handling / qtyReceived : 0;
    updateData.landedCostPerUnit = parsed.data.unitCost + handlingPerUnit;
  }

  if (parsed.data.handlingCharge !== undefined) {
    updateData.handlingCharge = parsed.data.handlingCharge;
    // Recalculate landed cost if handling changes
    const unitCost = parsed.data.unitCost ?? Number(batch.unitCost);
    const qtyReceived = Number(batch.qtyReceived);
    const handlingPerUnit = qtyReceived > 0 ? parsed.data.handlingCharge / qtyReceived : 0;
    updateData.landedCostPerUnit = unitCost + handlingPerUnit;
  }

  if (parsed.data.landedCostPerUnit !== undefined && !parsed.data.unitCost && !parsed.data.handlingCharge) {
    // Direct override of landed cost
    updateData.landedCostPerUnit = parsed.data.landedCostPerUnit;
  }

  if (parsed.data.batchNumber !== undefined) {
    updateData.batchNumber = parsed.data.batchNumber;
  }

  if (parsed.data.expiryDate !== undefined) {
    updateData.expiryDate = parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null;
  }

  if (parsed.data.qtyRemaining !== undefined) {
    updateData.qtyRemaining = parsed.data.qtyRemaining;
  }

  const updated = await prisma.batch.update({
    where: { id },
    data: updateData,
    include: {
      product: { select: { name: true, sku: true } },
      supplier: { select: { name: true } },
    },
  });

  // Sync linked purchase invoice item if cost changed
  if (updateData.unitCost !== undefined) {
    const piItem = await prisma.purchaseInvoiceItem.findFirst({
      where: { batchId: id },
    });
    if (piItem) {
      const newUnitCost = Number(updateData.unitCost);
      const newTotalCost = Number(piItem.bundleQty) * newUnitCost;
      await prisma.purchaseInvoiceItem.update({
        where: { id: piItem.id },
        data: { unitCost: newUnitCost, totalCost: newTotalCost },
      });

      // Recalculate purchase invoice totals
      const allItems = await prisma.purchaseInvoiceItem.findMany({
        where: { purchaseInvoiceId: piItem.purchaseInvoiceId },
      });
      const totalItemsAmount = allItems.reduce((s, i) => s + Number(i.totalCost), 0);
      const pi = await prisma.purchaseInvoice.findUnique({ where: { id: piItem.purchaseInvoiceId } });
      if (pi) {
        const grandTotal = totalItemsAmount + Number(pi.handlingCharge);
        const outstanding = grandTotal - Number(pi.amountPaid);
        await prisma.purchaseInvoice.update({
          where: { id: pi.id },
          data: { totalItemsAmount, grandTotal, outstandingAmount: Math.max(0, outstanding) },
        });
      }
    }
  }

  return NextResponse.json({ data: updated });
}
