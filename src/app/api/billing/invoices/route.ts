import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { generateInvoiceNumber } from "@/lib/invoice-number";
import { selectBatches } from "@/lib/batch-selector";
import { calculateGST } from "@/lib/gst";
import { validateMargin } from "@/lib/margin-guard";
import { round2 } from "@/lib/round";
import { formatValidationError } from "@/lib/validation";
import { createNotification } from "@/lib/notify";

const invoiceItemSchema = z.object({
  productId: z.string().optional().nullable(),
  isCustomItem: z.boolean().default(false),
  customItemName: z.string().optional().nullable(),
  qty: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  discountAmount: z.coerce.number().nonnegative().default(0),
  installationCharge: z.coerce.number().nonnegative().default(0),
  taxRatePercent: z.coerce.number().nonnegative().default(0),
});

const paymentSchema = z.object({
  paymentMethodId: z.string().min(1),
  amount: z.coerce.number().positive(),
  reference: z.string().optional().nullable(),
});

const createInvoiceSchema = z.object({
  customerId: z.string().optional().nullable(),
  vehicleId: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1),
  payments: z.array(paymentSchema).min(0),
  isCreditSale: z.boolean().default(false),
  loyaltyPointsRedeemed: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
  shiftId: z.string().optional().nullable(),
});

// GET /api/billing/invoices — List invoices
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const customerId = searchParams.get("customerId");

  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: "insensitive" } },
      { customer: { phone: { contains: search } } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (customerId) where.customerId = customerId;
  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    where.date = dateFilter;
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
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
    prisma.invoice.count({ where }),
  ]);

  return NextResponse.json({
    data: invoices,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/billing/invoices — Create invoice (atomic)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createInvoiceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  const { customerId, vehicleId, items, payments, isCreditSale, loyaltyPointsRedeemed, notes, shiftId } = parsed.data;

  try {
  // Verify operator exists (catches stale sessions after DB reset)
  const operator = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!operator) {
    return NextResponse.json(
      { error: "Session expired — please log out and log back in" },
      { status: 401 }
    );
  }

  // Credit sales require a customer
  if (isCreditSale && !customerId) {
    return NextResponse.json(
      { error: "Customer is required for credit sales" },
      { status: 400 }
    );
  }

  // Load business config
  const config = await prisma.businessConfig.findUnique({ where: { id: "default" } });
  const gstEnabled = config?.gstEnabled ?? false;
  const invoicePrefix = config?.invoicePrefix ?? "MEC";
  const fyStartMonth = config?.financialYearStartMonth ?? 4;
  const defaultMaxDiscount = Number(config?.defaultDiscountMax ?? 10);
  const isOwner = session.user.role === "OWNER";

  // Load products for tax rates and discount validation
  const productIds = items.filter((i) => i.productId && !i.isCustomItem).map((i) => i.productId!);
  const products = productIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { taxRate: { select: { metadata: true } } },
      })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Prepare invoice items with batch allocation and GST
  const invoiceItems: {
    productId: string | null;
    batchId: string | null;
    isCustomItem: boolean;
    customItemName: string | null;
    qty: number;
    unitPrice: number;
    landedCostPerUnit: number;
    discountAmount: number;
    installationCharge: number;
    taxableAmount: number;
    cgstRate: number;
    cgstAmount: number;
    sgstRate: number;
    sgstAmount: number;
    igstRate: number;
    igstAmount: number;
    lineTotal: number;
    hsnCode: string | null;
  }[] = [];

  // Track which batches to deduct after invoice creation
  const batchDeductions: { batchId: string; qty: number }[] = [];

  let subtotal = 0;
  let taxTotal = 0;
  let discountTotal = 0;

  for (const item of items) {
    // ---- Custom item (no product, no batch) ----
    if (item.isCustomItem) {
      if (!item.customItemName) {
        return NextResponse.json(
          { error: "Custom item name is required" },
          { status: 400 }
        );
      }

      const effectivePrice = item.unitPrice - item.discountAmount;
      const taxableAmount = effectivePrice * item.qty + item.installationCharge;
      const gst = calculateGST(taxableAmount, item.taxRatePercent, gstEnabled);

      invoiceItems.push({
        productId: null,
        batchId: null,
        isCustomItem: true,
        customItemName: item.customItemName,
        qty: item.qty,
        unitPrice: item.unitPrice,
        landedCostPerUnit: 0,
        discountAmount: item.discountAmount * item.qty,
        installationCharge: item.installationCharge,
        taxableAmount: gst.taxableAmount,
        cgstRate: gst.cgstRate,
        cgstAmount: gst.cgstAmount,
        sgstRate: gst.sgstRate,
        sgstAmount: gst.sgstAmount,
        igstRate: gst.igstRate,
        igstAmount: gst.igstAmount,
        lineTotal: gst.totalWithTax,
        hsnCode: null,
      });

      subtotal += effectivePrice * item.qty + item.installationCharge;
      taxTotal += gst.totalTax;
      discountTotal += item.discountAmount * item.qty;
      continue;
    }

    // ---- Product item (with batch allocation) ----
    const product = productMap.get(item.productId!);
    if (!product) {
      return NextResponse.json(
        { error: `Product not found: ${item.productId}` },
        { status: 404 }
      );
    }

    // Validate discount
    const maxDiscount = product.maxDiscountPercent
      ? Number(product.maxDiscountPercent)
      : defaultMaxDiscount;
    const discountPercent =
      item.unitPrice > 0 ? (item.discountAmount / item.unitPrice) * 100 : 0;
    if (!isOwner && discountPercent > maxDiscount) {
      return NextResponse.json(
        {
          error: `Discount on "${product.name}" (${discountPercent.toFixed(1)}%) exceeds max allowed (${maxDiscount}%). Owner approval required.`,
        },
        { status: 403 }
      );
    }

    // Allocate batches (FIFO/FEFO)
    let batchAllocations;
    try {
      batchAllocations = await selectBatches(item.productId!, item.qty);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Batch selection failed" },
        { status: 400 }
      );
    }

    // Get tax rate
    const taxRatePercent =
      (product.taxRate?.metadata as Record<string, number> | null)?.rate ?? 0;

    // Create invoice items per batch allocation
    for (const alloc of batchAllocations) {
      // Validate discount percentage cap (from Settings + product-level)
      if (!isOwner && item.discountAmount > 0 && item.unitPrice > 0) {
        const maxPct = product.maxDiscountPercent != null ? Number(product.maxDiscountPercent) : Number(config?.defaultDiscountMax ?? 100);
        const discPct = (item.discountAmount / item.unitPrice) * 100;
        if (maxPct < 100 && discPct > maxPct) {
          return NextResponse.json(
            { error: `${product.name}: Discount ${discPct.toFixed(1)}% exceeds max allowed ${maxPct}%` },
            { status: 403 }
          );
        }
      }

      // Validate margin (cost-based floor)
      const marginCheck = validateMargin(
        item.unitPrice,
        item.discountAmount,
        alloc.landedCostPerUnit,
        isOwner
      );
      if (!marginCheck.allowed) {
        return NextResponse.json(
          { error: `${product.name}: ${marginCheck.message}` },
          { status: 403 }
        );
      }

      const effectivePrice = item.unitPrice - item.discountAmount;
      const taxableAmount = effectivePrice * alloc.qty + item.installationCharge;
      const gst = calculateGST(taxableAmount, taxRatePercent, gstEnabled);

      invoiceItems.push({
        productId: item.productId!,
        batchId: alloc.batchId,
        isCustomItem: false,
        customItemName: null,
        qty: alloc.qty,
        unitPrice: item.unitPrice,
        landedCostPerUnit: alloc.landedCostPerUnit,
        discountAmount: item.discountAmount * alloc.qty,
        installationCharge: item.installationCharge,
        taxableAmount: gst.taxableAmount,
        cgstRate: gst.cgstRate,
        cgstAmount: gst.cgstAmount,
        sgstRate: gst.sgstRate,
        sgstAmount: gst.sgstAmount,
        igstRate: gst.igstRate,
        igstAmount: gst.igstAmount,
        lineTotal: gst.totalWithTax,
        hsnCode: product.hsnCode,
      });

      batchDeductions.push({ batchId: alloc.batchId, qty: alloc.qty });

      subtotal += effectivePrice * alloc.qty + item.installationCharge;
      taxTotal += gst.totalTax;
      discountTotal += item.discountAmount * alloc.qty;
    }
  }

  // Calculate loyalty discount — validate points exist BEFORE applying
  let loyaltyDiscount = 0;
  if (loyaltyPointsRedeemed > 0 && customerId && config?.loyaltyEnabled) {
    const custPoints = await prisma.customer.findUnique({ where: { id: customerId }, select: { loyaltyPoints: true } });
    if (!custPoints || custPoints.loyaltyPoints < loyaltyPointsRedeemed) {
      return NextResponse.json(
        { error: `Insufficient loyalty points. Available: ${custPoints?.loyaltyPoints ?? 0}, trying to redeem: ${loyaltyPointsRedeemed}` },
        { status: 400 }
      );
    }
    const redemptionValue = Number(config.loyaltyRedemptionValue) || 0;
    loyaltyDiscount = round2(loyaltyPointsRedeemed * redemptionValue);
  }

  const grandTotal = round2(Math.max(0, subtotal + taxTotal - loyaltyDiscount));
  const totalPaid = round2(payments.reduce((s, p) => s + p.amount, 0));
  const outstandingAmount = isCreditSale ? round2(grandTotal - totalPaid) : 0;

  // Generate invoice number
  const { invoiceNumber, financialYear, sequenceNumber } =
    await generateInvoiceNumber(invoicePrefix, fyStartMonth);

  // Create invoice + items + payments + deduct stock in sequence
  // If any step fails after invoice creation, delete the invoice (manual rollback)
  let invoiceId: string | null = null;

  try {
    // Step 1: Create the invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        financialYear,
        sequenceNumber,
        operatorId: session.user.id,
        customerId: customerId ?? null,
        vehicleId: vehicleId ?? null,
        shiftId: shiftId ?? null,
        subtotal,
        taxTotal,
        discountTotal,
        grandTotal,
        gstEnabled,
        isCreditSale,
        amountPaid: totalPaid,
        outstandingAmount,
        notes: notes ?? null,
      },
    });
    invoiceId = invoice.id;

    // Step 2: Create invoice items
    for (const item of invoiceItems) {
      await prisma.invoiceItem.create({
        data: {
          invoice: { connect: { id: invoice.id } },
          ...(item.productId ? { product: { connect: { id: item.productId } } } : {}),
          ...(item.batchId ? { batch: { connect: { id: item.batchId } } } : {}),
          isCustomItem: item.isCustomItem,
          customItemName: item.customItemName,
          qty: item.qty,
          unitPrice: item.unitPrice,
          landedCostPerUnit: item.landedCostPerUnit,
          discountAmount: item.discountAmount,
          installationCharge: item.installationCharge,
          taxableAmount: item.taxableAmount,
          cgstRate: item.cgstRate,
          cgstAmount: item.cgstAmount,
          sgstRate: item.sgstRate,
          sgstAmount: item.sgstAmount,
          igstRate: item.igstRate,
          igstAmount: item.igstAmount,
          lineTotal: item.lineTotal,
          hsnCode: item.hsnCode,
        },
      });
    }

    // Step 3: Create payment records
    for (const p of payments) {
      await prisma.invoicePayment.create({
        data: {
          invoice: { connect: { id: invoice.id } },
          paymentMethod: { connect: { id: p.paymentMethodId } },
          amount: p.amount,
          reference: p.reference ?? null,
        },
      });
    }

    // Step 4: Deduct batch quantities (verify stock before deducting)
    for (const deduction of batchDeductions) {
      const batch = await prisma.batch.findUnique({ where: { id: deduction.batchId }, select: { qtyRemaining: true } });
      if (!batch || Number(batch.qtyRemaining) < deduction.qty) {
        throw new Error(`Insufficient stock in batch ${deduction.batchId}. Available: ${Number(batch?.qtyRemaining ?? 0)}, Needed: ${deduction.qty}`);
      }
      await prisma.batch.update({
        where: { id: deduction.batchId },
        data: { qtyRemaining: { decrement: deduction.qty } },
      });
    }

    // Step 5: Update customer outstanding balance if credit sale
    if (isCreditSale && customerId && outstandingAmount > 0) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { outstandingBalance: { increment: outstandingAmount } },
      });

      // Notify owner when customer crosses 80% credit utilization
      try {
        const cust = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { name: true, creditLimit: true, outstandingBalance: true },
        });
        if (cust) {
          const limit = Number(cust.creditLimit);
          const balance = Number(cust.outstandingBalance);
          if (limit > 0 && balance >= limit * 0.8) {
            const pct = Math.round((balance / limit) * 100);
            await createNotification({
              type: "CREDIT_LIMIT_WARNING",
              title: balance >= limit ? "Credit Limit Exceeded" : "Credit Limit Warning",
              message: `${cust.name} is at ${pct}% credit utilization (Rs.${balance.toFixed(0)} / Rs.${limit.toFixed(0)})`,
              link: `/customers/${customerId}`,
              recipientRole: "OWNER",
            });
          }
        }
      } catch {}
    }

    // Step 6: Deduct redeemed loyalty points (use decrement to avoid race condition)
    if (loyaltyPointsRedeemed > 0 && customerId && config?.loyaltyEnabled) {
      const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { loyaltyPoints: true } });
      if (customer && customer.loyaltyPoints >= loyaltyPointsRedeemed) {
        await prisma.customer.update({
          where: { id: customerId },
          data: { loyaltyPoints: { decrement: loyaltyPointsRedeemed } },
        });
        // Re-read for accurate balance in transaction log
        const updatedCust = await prisma.customer.findUnique({ where: { id: customerId }, select: { loyaltyPoints: true } });
        await prisma.loyaltyTransaction.create({
          data: {
            customer: { connect: { id: customerId } },
            type: "REDEEMED",
            points: -loyaltyPointsRedeemed,
            balance: updatedCust?.loyaltyPoints ?? 0,
            invoiceId: invoice.id,
            description: `Redeemed on invoice ${invoiceNumber} (Rs.${loyaltyDiscount.toFixed(0)} discount)`,
          },
        });
      }
    }

    // Step 7: Award loyalty points if enabled and customer exists
    if (customerId && config?.loyaltyEnabled && Number(config.loyaltyPointsPerRupee) > 0) {
      const pointsEarned = Math.floor(grandTotal * Number(config.loyaltyPointsPerRupee));
      if (pointsEarned > 0) {
        await prisma.customer.update({
          where: { id: customerId },
          data: { loyaltyPoints: { increment: pointsEarned } },
        });
        const updatedCust = await prisma.customer.findUnique({ where: { id: customerId }, select: { loyaltyPoints: true } });
        await prisma.loyaltyTransaction.create({
          data: {
            customer: { connect: { id: customerId } },
            type: "EARNED",
            points: pointsEarned,
            balance: updatedCust?.loyaltyPoints ?? 0,
            invoiceId: invoice.id,
            description: `Earned from invoice ${invoiceNumber}`,
          },
        });
      }
    }

    // Reload full invoice
    const fullInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        items: { include: { product: true } },
        payments: { include: { paymentMethod: true } },
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

    return NextResponse.json({ data: fullInvoice }, { status: 201 });
  } catch (innerErr) {
    // Rollback: delete the partially created invoice and its relations
    if (invoiceId) {
      try {
        await prisma.invoicePayment.deleteMany({ where: { invoiceId } });
        await prisma.invoiceItem.deleteMany({ where: { invoiceId } });
        await prisma.invoice.delete({ where: { id: invoiceId } });
      } catch { /* rollback best-effort */ }
    }
    throw innerErr; // re-throw to be caught by outer try-catch
  }

  } catch (err) {
    console.error("Invoice creation error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Invoice creation failed: ${message}` }, { status: 500 });
  }
}
