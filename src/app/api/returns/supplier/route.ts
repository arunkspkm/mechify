import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const returnItemSchema = z.object({
  productId: z.string().min(1),
  batchId: z.string().min(1),
  qty: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative(),
  reason: z.string().min(1),
});

const createSchema = z.object({
  supplierId: z.string().min(1),
  items: z.array(returnItemSchema).min(1),
  notes: z.string().optional().nullable(),
});

// GET /api/returns/supplier
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;

  const returns = await prisma.supplierReturn.findMany({
    where,
    include: {
      supplier: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: returns });
}

// POST /api/returns/supplier
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { supplierId, items, notes } = parsed.data;

  try {
    // Generate return number with retry for uniqueness
    let returnNumber = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await prisma.supplierReturn.findFirst({
        orderBy: { createdAt: "desc" },
        select: { returnNumber: true },
      });
      const lastNum = last?.returnNumber ? parseInt(last.returnNumber.replace(/\D/g, "")) || 0 : 0;
      returnNumber = `SRET-${String(lastNum + 1 + attempt).padStart(5, "0")}`;
      const exists = await prisma.supplierReturn.findUnique({ where: { returnNumber } });
      if (!exists) break;
    }

    const totalAmount = items.reduce((s, i) => s + i.qty * i.unitCost, 0);

    const supplierReturn = await prisma.supplierReturn.create({
      data: {
        supplier: { connect: { id: supplierId } },
        returnNumber,
        totalAmount,
        notes: notes ?? null,
      },
    });

    for (const item of items) {
      // Verify batch has enough stock
      const batch = await prisma.batch.findUnique({ where: { id: item.batchId } });
      if (!batch || Number(batch.qtyRemaining) < item.qty) {
        return NextResponse.json({
          error: `Insufficient stock in batch for return. Available: ${batch?.qtyRemaining ?? 0}`,
        }, { status: 400 });
      }

      await prisma.supplierReturnItem.create({
        data: {
          return_: { connect: { id: supplierReturn.id } },
          product: { connect: { id: item.productId } },
          batch: { connect: { id: item.batchId } },
          qty: item.qty,
          unitCost: item.unitCost,
          totalCost: item.qty * item.unitCost,
          reason: item.reason,
        },
      });

      // Deduct from batch immediately
      await prisma.batch.update({
        where: { id: item.batchId },
        data: { qtyRemaining: { decrement: item.qty } },
      });
    }

    return NextResponse.json({ data: { id: supplierReturn.id, returnNumber } }, { status: 201 });
  } catch (err) {
    console.error("Supplier return error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
