import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { generateEstimateNumber } from "@/lib/invoice-number";
import { calculateGST } from "@/lib/gst";
import { optionalPhoneSchema } from "@/lib/validators";

const estimateItemSchema = z.object({
  productId: z.string().optional().nullable(),
  isCustomItem: z.boolean().default(false),
  customItemName: z.string().optional().nullable(),
  qty: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  discountAmount: z.coerce.number().nonnegative().default(0),
  installationCharge: z.coerce.number().nonnegative().default(0),
  taxRatePercent: z.coerce.number().nonnegative().default(0),
  hsnCode: z.string().optional().nullable(),
});

const createEstimateSchema = z.object({
  customerId: z.string().optional().nullable(),
  vehicleId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerPhone: optionalPhoneSchema,
  items: z.array(estimateItemSchema).min(1),
  validityDays: z.coerce.number().positive().default(15),
  notes: z.string().optional().nullable(),
});

// GET /api/estimates
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
  if (status) where.status = status;

  const [estimates, total] = await Promise.all([
    prisma.estimate.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true } },
        vehicle: {
          include: {
            vehicleMake: { select: { name: true } },
            vehicleModel: { select: { name: true } },
          },
        },
        operator: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.estimate.count({ where }),
  ]);

  // Auto-flag expired estimates
  const now = new Date();
  const data = estimates.map((est) => ({
    ...est,
    isExpired: est.status === "DRAFT" || est.status === "SENT"
      ? new Date(est.validUntil) < now
      : false,
  }));

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/estimates
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createEstimateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let { customerId } = parsed.data;
  const { vehicleId, customerName, customerPhone, items, validityDays, notes } = parsed.data;

  try {
    // Auto-create customer if walk-in details provided and no existing customer selected
    if (!customerId && customerPhone) {
      // Check if customer with this phone already exists
      const existing = await prisma.customer.findUnique({
        where: { phone: customerPhone },
      });
      if (existing) {
        customerId = existing.id;
        // Warn if the name doesn't match
        if (customerName && customerName.toLowerCase() !== existing.name.toLowerCase()) {
          return NextResponse.json(
            {
              error: `This mobile number belongs to existing customer "${existing.name}" (not "${customerName}"). Please search and select the existing customer, or use a different number.`,
            },
            { status: 409 }
          );
        }
      } else if (customerName) {
        const newCustomer = await prisma.customer.create({
          data: {
            name: customerName,
            phone: customerPhone,
          },
        });
        customerId = newCustomer.id;
      }
    }

    const config = await prisma.businessConfig.findUnique({ where: { id: "default" } });
    const gstEnabled = config?.gstEnabled ?? false;
    const estimatePrefix = config?.estimatePrefix ?? "EST";
    const fyStartMonth = config?.financialYearStartMonth ?? 4;

    // Load products for tax rates
    const productIds = items.filter((i) => i.productId && !i.isCustomItem).map((i) => i.productId!);
    const products = productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          include: { taxRate: { select: { metadata: true } } },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Calculate totals
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    const estimateItems = items.map((item) => {
      let taxRatePercent = item.taxRatePercent;
      let hsnCode = item.hsnCode ?? null;

      if (!item.isCustomItem && item.productId) {
        const product = productMap.get(item.productId);
        if (product) {
          taxRatePercent = (product.taxRate?.metadata as Record<string, number> | null)?.rate ?? 0;
          hsnCode = product.hsnCode ?? null;
        }
      }

      const effectivePrice = item.unitPrice - item.discountAmount;
      const taxableAmount = effectivePrice * item.qty + item.installationCharge;
      const gst = calculateGST(taxableAmount, taxRatePercent, gstEnabled);

      subtotal += effectivePrice * item.qty + item.installationCharge;
      taxTotal += gst.totalTax;
      discountTotal += item.discountAmount * item.qty;

      return {
        productId: item.isCustomItem ? null : item.productId,
        isCustomItem: item.isCustomItem,
        customItemName: item.isCustomItem ? item.customItemName : null,
        qty: item.qty,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount * item.qty,
        installationCharge: item.installationCharge,
        taxableAmount: gst.taxableAmount,
        cgstRate: gst.cgstRate,
        cgstAmount: gst.cgstAmount,
        sgstRate: gst.sgstRate,
        sgstAmount: gst.sgstAmount,
        lineTotal: gst.totalWithTax,
        hsnCode,
      };
    });

    const grandTotal = subtotal + taxTotal;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validityDays);

    const { estimateNumber, financialYear, sequenceNumber } =
      await generateEstimateNumber(estimatePrefix, fyStartMonth);

    // Create estimate
    const estimate = await prisma.estimate.create({
      data: {
        estimateNumber,
        financialYear,
        sequenceNumber,
        operatorId: session.user.id,
        customerId: customerId ?? null,
        vehicleId: vehicleId ?? null,
        customerName: customerName ?? null,
        customerPhone: customerPhone ?? null,
        subtotal,
        taxTotal,
        discountTotal,
        grandTotal,
        gstEnabled,
        validUntil,
        notes: notes ?? null,
      },
    });

    // Create items
    for (const item of estimateItems) {
      await prisma.estimateItem.create({
        data: {
          estimate: { connect: { id: estimate.id } },
          ...(item.productId ? { product: { connect: { id: item.productId } } } : {}),
          isCustomItem: item.isCustomItem,
          customItemName: item.customItemName,
          qty: item.qty,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          installationCharge: item.installationCharge,
          taxableAmount: item.taxableAmount,
          cgstRate: item.cgstRate,
          cgstAmount: item.cgstAmount,
          sgstRate: item.sgstRate,
          sgstAmount: item.sgstAmount,
          lineTotal: item.lineTotal,
          hsnCode: item.hsnCode,
        },
      });
    }

    // Reload full estimate
    const fullEstimate = await prisma.estimate.findUnique({
      where: { id: estimate.id },
      include: {
        items: { include: { product: true } },
        customer: true,
        vehicle: {
          include: {
            vehicleMake: { select: { name: true } },
            vehicleModel: { select: { name: true } },
          },
        },
        operator: { select: { name: true } },
      },
    });

    return NextResponse.json({ data: fullEstimate }, { status: 201 });
  } catch (err) {
    console.error("Estimate creation error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Estimate creation failed: ${message}` }, { status: 500 });
  }
}
