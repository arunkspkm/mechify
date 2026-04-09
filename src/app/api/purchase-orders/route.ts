import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const poItemSchema = z.object({
  productId: z.string().min(1),
  orderedQty: z.coerce.number().positive(),
  agreedPrice: z.coerce.number().nonnegative(),
  notes: z.string().optional().nullable(),
});

const createPOSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  items: z.array(poItemSchema).min(1, "At least one item required"),
  notes: z.string().optional().nullable(),
  expectedDate: z.string().optional().nullable(),
});

// GET /api/purchase-orders
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const supplierId = searchParams.get("supplierId");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (supplierId) where.supplierId = supplierId;

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        createdBy: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return NextResponse.json({
    data: orders,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/purchase-orders
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createPOSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { supplierId, items, notes, expectedDate } = parsed.data;

  try {
    // Generate PO number
    const lastPO = await prisma.purchaseOrder.findFirst({
      orderBy: { createdAt: "desc" },
      select: { poNumber: true },
    });
    const lastNum = lastPO?.poNumber ? parseInt(lastPO.poNumber.replace(/\D/g, "")) || 0 : 0;
    const poNumber = `PO-${String(lastNum + 1).padStart(5, "0")}`;

    const totalAmount = items.reduce((s, i) => s + i.orderedQty * i.agreedPrice, 0);

    // Create PO
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplier: { connect: { id: supplierId } },
        createdBy: { connect: { id: session.user.id } },
        totalAmount,
        notes: notes ?? null,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
      },
    });

    // Create items
    for (const item of items) {
      await prisma.purchaseOrderItem.create({
        data: {
          purchaseOrder: { connect: { id: po.id } },
          product: { connect: { id: item.productId } },
          orderedQty: item.orderedQty,
          agreedPrice: item.agreedPrice,
          notes: item.notes ?? null,
        },
      });
    }

    // Reload
    const full = await prisma.purchaseOrder.findUnique({
      where: { id: po.id },
      include: {
        supplier: { select: { name: true } },
        createdBy: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
    });

    return NextResponse.json({ data: full }, { status: 201 });
  } catch (err) {
    console.error("PO creation error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
