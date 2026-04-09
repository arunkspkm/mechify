import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { createNotification } from "@/lib/notify";

const createWriteOffSchema = z.object({
  productId: z.string().min(1),
  batchId: z.string().min(1),
  qty: z.coerce.number().positive("Quantity must be positive"),
  reasonId: z.string().min(1, "Reason is required"),
  notes: z.string().optional().default(""),
});

const approveSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["APPROVED", "REJECTED"]),
});

/**
 * GET /api/inventory/write-offs — List write-offs, optionally filter by status.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const writeOffs = await prisma.stockWriteOff.findMany({
    where,
    include: {
      batch: {
        include: {
          product: { select: { name: true, sku: true } },
        },
      },
      reason: { select: { name: true } },
      submittedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: writeOffs });
}

/**
 * POST /api/inventory/write-offs — Submit a new write-off request.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createWriteOffSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { productId, batchId, qty, reasonId, notes } = parsed.data;

  // Verify batch exists and has enough stock
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  if (Number(batch.qtyRemaining) < qty) {
    return NextResponse.json(
      { error: `Insufficient batch stock. Available: ${batch.qtyRemaining}, Requested: ${qty}` },
      { status: 400 }
    );
  }

  const valueLost = qty * Number(batch.landedCostPerUnit);

  const writeOff = await prisma.stockWriteOff.create({
    data: {
      productId,
      batchId,
      qty,
      valueLost,
      reasonId,
      notes: notes || null,
      submittedById: session.user.id,
      status: "PENDING",
    },
    include: {
      batch: { include: { product: { select: { name: true } } } },
      reason: { select: { name: true } },
      submittedBy: { select: { name: true } },
    },
  });

  try {
    await createNotification({
      type: "WRITE_OFF_SUBMITTED",
      title: "Write-off Submitted",
      message: `Write-off for ${writeOff.batch.product.name} — ${qty} units (Rs.${valueLost.toFixed(2)})`,
      link: `/inventory`,
      recipientRole: "OWNER",
    });
  } catch {}

  return NextResponse.json({ data: writeOff }, { status: 201 });
}

/**
 * PATCH /api/inventory/write-offs — Approve or reject a write-off (Owner only).
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden — Owner only" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = approveSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id, action } = parsed.data;

  const writeOff = await prisma.stockWriteOff.findUnique({
    where: { id },
    include: { batch: true },
  });

  if (!writeOff) {
    return NextResponse.json({ error: "Write-off not found" }, { status: 404 });
  }

  if (writeOff.status !== "PENDING") {
    return NextResponse.json(
      { error: `Write-off is already ${writeOff.status}` },
      { status: 400 }
    );
  }

  if (action === "APPROVED") {
    // Deduct from batch in a transaction
    await prisma.$transaction([
      prisma.stockWriteOff.update({
        where: { id },
        data: { status: "APPROVED", approvedById: session.user.id },
      }),
      prisma.batch.update({
        where: { id: writeOff.batchId },
        data: {
          qtyRemaining: { decrement: Number(writeOff.qty) },
        },
      }),
    ]);
  } else {
    await prisma.stockWriteOff.update({
      where: { id },
      data: { status: "REJECTED", approvedById: session.user.id },
    });
  }

  return NextResponse.json({ data: { id, status: action } });
}
