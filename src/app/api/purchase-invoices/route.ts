import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { distributeLandedCost } from "@/lib/landed-cost";

const lineItemSchema = z.object({
  productId: z.string().min(1),
  bundleQty: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative(),
  qualityGradeId: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
});

const createSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  invoiceNumber: z.string().optional().nullable(),
  handlingCharge: z.coerce.number().nonnegative().default(0),
  items: z.array(lineItemSchema).min(1, "At least one item is required"),
  notes: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "FINALIZED"]).default("FINALIZED"),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
});

// GET /api/purchase-invoices
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const supplierId = searchParams.get("supplierId");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  const where: Record<string, unknown> = {};
  if (supplierId) where.supplierId = supplierId;
  if (status) where.status = status;

  const [invoices, total] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.purchaseInvoice.count({ where }),
  ]);

  return NextResponse.json({
    data: invoices,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/purchase-invoices — Create purchase invoice + batches
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { supplierId, invoiceNumber, handlingCharge, items, notes, status, invoiceDate, dueDate } = parsed.data;

  try {
    // Load products for bundle size
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, bundleSize: true, hasExpiry: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Calculate line items with selling unit costs
    const lineItems = items.map((item) => {
      const product = productMap.get(item.productId);
      const bundleSize = Number(product?.bundleSize ?? 1);
      const qtyInSellingUnits = item.bundleQty * bundleSize;
      const costPerSellingUnit = bundleSize > 0 ? item.unitCost / bundleSize : item.unitCost;
      const totalCost = item.bundleQty * item.unitCost;

      return {
        ...item,
        product,
        bundleSize,
        qtyInSellingUnits,
        costPerSellingUnit,
        totalCost,
      };
    });

    // Distribute handling charge
    const landedCosts = distributeLandedCost(
      lineItems.map((li) => ({ unitCost: li.costPerSellingUnit, qty: li.qtyInSellingUnits })),
      handlingCharge
    );

    const totalItemsAmount = lineItems.reduce((s, li) => s + li.totalCost, 0);
    const grandTotal = totalItemsAmount + handlingCharge;

    // Create purchase invoice
    const purchaseInvoice = await prisma.purchaseInvoice.create({
      data: {
        invoiceNumber: invoiceNumber || null,
        supplier: { connect: { id: supplierId } },
        totalItemsAmount,
        handlingCharge,
        grandTotal,
        outstandingAmount: grandTotal,
        status,
        notes: notes || null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    // Create line items and batches
    for (let i = 0; i < lineItems.length; i++) {
      const li = lineItems[i];
      const lc = landedCosts[i];

      // Create batch
      const batch = await prisma.batch.create({
        data: {
          product: { connect: { id: li.productId } },
          supplier: { connect: { id: supplierId } },
          batchNumber: `PI-${purchaseInvoice.id.slice(-6)}`,
          bundleQtyReceived: li.bundleQty,
          qtyReceived: li.qtyInSellingUnits,
          qtyRemaining: status === "FINALIZED" ? li.qtyInSellingUnits : 0,
          unitCost: li.costPerSellingUnit,
          handlingCharge: lc.handlingPerUnit * li.qtyInSellingUnits,
          landedCostPerUnit: lc.landedCostPerUnit,
          ...(li.qualityGradeId ? { qualityGrade: { connect: { id: li.qualityGradeId } } } : {}),
          expiryDate: li.expiryDate ? new Date(li.expiryDate) : null,
          purchaseDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        },
      });

      // Create purchase invoice item linked to batch
      await prisma.purchaseInvoiceItem.create({
        data: {
          purchaseInvoice: { connect: { id: purchaseInvoice.id } },
          product: { connect: { id: li.productId } },
          batch: { connect: { id: batch.id } },
          bundleQty: li.bundleQty,
          unitCost: li.unitCost,
          totalCost: li.totalCost,
          expiryDate: li.expiryDate ? new Date(li.expiryDate) : null,
        },
      });
    }

    // Reload full invoice
    const full = await prisma.purchaseInvoice.findUnique({
      where: { id: purchaseInvoice.id },
      include: {
        supplier: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
            batch: { select: { id: true, landedCostPerUnit: true, qtyReceived: true } },
          },
        },
      },
    });

    return NextResponse.json({ data: full }, { status: 201 });
  } catch (err) {
    console.error("Purchase invoice creation error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
