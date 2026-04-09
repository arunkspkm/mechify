import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { formatValidationError } from "@/lib/validation";
import { createNotification } from "@/lib/notify";

const returnItemSchema = z.object({
  productId: z.string().optional().nullable(),
  batchId: z.string().optional().nullable(),
  qty: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  reasonId: z.string().min(1),
  resolution: z.enum(["REFUND", "REPLACE", "CREDIT", "WARRANTY"]).default("REFUND"),
  restockable: z.boolean().default(false),
  isCustomItem: z.boolean().default(false),
  customItemName: z.string().optional().nullable(),
  // Warranty: immediate replacement from stock
  replacementBatchId: z.string().optional().nullable(),
});

const createReturnSchema = z.object({
  invoiceId: z.string().min(1),
  items: z.array(returnItemSchema).min(1),
  notes: z.string().optional().nullable(),
});

// GET /api/returns/customer
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;

  const [returns, total] = await Promise.all([
    prisma.customerReturn.findMany({
      where,
      include: {
        invoice: { select: { id: true, invoiceNumber: true } },
        customer: { select: { name: true, phone: true } },
        processedBy: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
            reason: { select: { name: true } },
          },
        },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.customerReturn.count({ where }),
  ]);

  return NextResponse.json({
    data: returns,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/returns/customer — Create a return
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createReturnSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  const { invoiceId, items, notes } = parsed.data;

  try {
    // Verify invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, customerId: true, invoiceNumber: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Generate return number with retry for uniqueness
    let returnNumber = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const lastReturn = await prisma.customerReturn.findFirst({
        orderBy: { createdAt: "desc" },
        select: { returnNumber: true },
      });
      const lastNum = lastReturn?.returnNumber ? parseInt(lastReturn.returnNumber.replace(/\D/g, "")) || 0 : 0;
      returnNumber = `RET-${String(lastNum + 1 + attempt).padStart(5, "0")}`;
      const exists = await prisma.customerReturn.findUnique({ where: { returnNumber } });
      if (!exists) break;
    }

    // WARRANTY and REPLACE items have no refund
    const totalRefund = items.reduce((s, i) => {
      if (i.resolution === "WARRANTY" || i.resolution === "REPLACE") return s;
      return s + i.qty * i.unitPrice;
    }, 0);

    // Create return
    const customerReturn = await prisma.customerReturn.create({
      data: {
        invoice: { connect: { id: invoiceId } },
        ...(invoice.customerId ? { customer: { connect: { id: invoice.customerId } } } : {}),
        returnNumber,
        totalRefund,
        notes: notes ?? null,
      },
    });

    // Create return items
    for (const item of items) {
      const hasReplacement = (item.resolution === "WARRANTY" || item.resolution === "REPLACE") && item.replacementBatchId;

      await prisma.customerReturnItem.create({
        data: {
          return_: { connect: { id: customerReturn.id } },
          ...(item.productId ? { product: { connect: { id: item.productId } } } : {}),
          ...(item.batchId ? { batch: { connect: { id: item.batchId } } } : {}),
          qty: item.qty,
          unitPrice: item.unitPrice,
          refundAmount: (item.resolution === "WARRANTY" || item.resolution === "REPLACE") ? 0 : item.qty * item.unitPrice,
          reason: { connect: { id: item.reasonId } },
          resolution: item.resolution,
          restockable: item.restockable,
          isCustomItem: item.isCustomItem,
          customItemName: item.customItemName ?? null,
          replacementBatchId: item.replacementBatchId ?? null,
          replacementGiven: !!hasReplacement,
        },
      });

      // If warranty/replace with immediate replacement, deduct stock from replacement batch
      if (hasReplacement) {
        const repBatch = await prisma.batch.findUnique({ where: { id: item.replacementBatchId! }, select: { qtyRemaining: true } });
        if (!repBatch || Number(repBatch.qtyRemaining) < item.qty) {
          return NextResponse.json(
            { error: `Insufficient replacement stock. Available: ${Number(repBatch?.qtyRemaining ?? 0)}, needed: ${item.qty}` },
            { status: 400 }
          );
        }
        await prisma.batch.update({
          where: { id: item.replacementBatchId! },
          data: { qtyRemaining: { decrement: item.qty } },
        });
      }
    }

    try {
      await createNotification({
        type: "RETURN_CREATED",
        title: "New Return Request",
        message: `${returnNumber} — ${items.length} items from invoice ${invoice.invoiceNumber}`,
        link: `/billing/invoices/${invoiceId}`,
        recipientRole: "OWNER",
      });
    } catch {}

    return NextResponse.json({ data: { id: customerReturn.id, returnNumber } }, { status: 201 });
  } catch (err) {
    console.error("Customer return error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
