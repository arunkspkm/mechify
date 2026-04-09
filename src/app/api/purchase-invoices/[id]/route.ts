import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { distributeLandedCost } from "@/lib/landed-cost";

const addItemSchema = z.object({
  productId: z.string().min(1),
  bundleQty: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative(),
  qualityGradeId: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
});

// GET /api/purchase-invoices/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: {
        include: {
          product: { select: { name: true, sku: true, bundleSize: true } },
          batch: {
            select: {
              id: true,
              qtyReceived: true,
              qtyRemaining: true,
              unitCost: true,
              handlingCharge: true,
              landedCostPerUnit: true,
            },
          },
        },
      },
      payments: {
        include: { paymentMethod: { select: { name: true } } },
        orderBy: { date: "desc" },
      },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Purchase invoice not found" }, { status: 404 });
  }

  // Calculate available credit for this supplier (advances + overpayments)
  let availableCredit = 0;

  if (Number(invoice.outstandingAmount) > 0) {
    // Pending advances
    const advances = await prisma.supplierPayment.findMany({
      where: { supplierId: invoice.supplierId, isAdvance: true },
      select: { amount: true, adjustedAmount: true },
    });
    const pendingAdvance = advances.reduce((s, a) => s + Number(a.amount) - Number(a.adjustedAmount), 0);

    // Overpayments from other invoices
    const otherInvoices = await prisma.purchaseInvoice.findMany({
      where: { supplierId: invoice.supplierId, id: { not: id }, status: { not: "CANCELLED" } },
      select: { amountPaid: true, grandTotal: true },
    });
    const overpayments = otherInvoices.reduce((s, i) => s + Math.max(0, Number(i.amountPaid) - Number(i.grandTotal)), 0);

    availableCredit = pendingAdvance + overpayments;
  }

  return NextResponse.json({ data: { ...invoice, availableCredit } });
}

// PATCH /api/purchase-invoices/[id] — Add item, update status, record payment
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id },
    include: { items: { include: { batch: true } } },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Handle different actions
  const action = body.action as string;

  // --- Add missed item ---
  if (action === "addItem") {
    const parsed = addItemSchema.safeParse(body.item);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const item = parsed.data;
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { bundleSize: true },
    });
    const bundleSize = Number(product?.bundleSize ?? 1);
    const qtyInSellingUnits = item.bundleQty * bundleSize;
    const costPerSellingUnit = bundleSize > 0 ? item.unitCost / bundleSize : item.unitCost;
    const totalCost = item.bundleQty * item.unitCost;

    // Create batch
    const batch = await prisma.batch.create({
      data: {
        product: { connect: { id: item.productId } },
        supplier: { connect: { id: invoice.supplierId } },
        batchNumber: `PI-${id.slice(-6)}`,
        bundleQtyReceived: item.bundleQty,
        qtyReceived: qtyInSellingUnits,
        qtyRemaining: invoice.status === "FINALIZED" ? qtyInSellingUnits : 0,
        unitCost: costPerSellingUnit,
        handlingCharge: 0,
        landedCostPerUnit: costPerSellingUnit,
        ...(item.qualityGradeId ? { qualityGrade: { connect: { id: item.qualityGradeId } } } : {}),
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        purchaseDate: invoice.invoiceDate,
      },
    });

    // Create purchase invoice item
    await prisma.purchaseInvoiceItem.create({
      data: {
        purchaseInvoice: { connect: { id } },
        product: { connect: { id: item.productId } },
        batch: { connect: { id: batch.id } },
        bundleQty: item.bundleQty,
        unitCost: item.unitCost,
        totalCost,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
      },
    });

    // Recalculate totals and redistribute handling
    await recalculateInvoice(id);

    return NextResponse.json({ message: "Item added" });
  }

  // --- Record payment ---
  if (action === "recordPayment") {
    const paymentSchema = z.object({
      amount: z.coerce.number().positive(),
      paymentMethodId: z.string().min(1),
      reference: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    });

    const parsed = paymentSchema.safeParse(body.payment);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    await prisma.supplierPayment.create({
      data: {
        purchaseInvoice: { connect: { id } },
        supplierId: invoice.supplierId,
        amount: parsed.data.amount,
        paymentMethod: { connect: { id: parsed.data.paymentMethodId } },
        reference: parsed.data.reference ?? null,
        notes: parsed.data.notes ?? null,
      },
    });

    // Update totals
    const totalPaid = Number(invoice.amountPaid) + parsed.data.amount;
    const outstanding = Number(invoice.grandTotal) - totalPaid;
    const newStatus = outstanding <= 0 ? "PAID" : totalPaid > 0 ? "PARTIALLY_PAID" : invoice.status;

    await prisma.purchaseInvoice.update({
      where: { id },
      data: {
        amountPaid: totalPaid,
        outstandingAmount: Math.max(outstanding, 0),
        status: newStatus,
      },
    });

    return NextResponse.json({ message: "Payment recorded" });
  }

  // Apply pending advances + overpayments to this purchase invoice
  if (action === "applyAdvance") {
    const currentOutstanding = Number(invoice.outstandingAmount);
    if (currentOutstanding <= 0) {
      return NextResponse.json({ error: "No outstanding amount on this invoice" }, { status: 400 });
    }

    let remainingToApply = currentOutstanding;
    let totalApplied = 0;
    const details: string[] = [];

    // 1. Apply unadjusted advances
    const advances = await prisma.supplierPayment.findMany({
      where: { supplierId: invoice.supplierId, isAdvance: true },
      orderBy: { date: "asc" },
    });

    let advanceApplied = 0;
    for (const adv of advances) {
      if (remainingToApply <= 0) break;
      const unadjusted = Number(adv.amount) - Number(adv.adjustedAmount);
      if (unadjusted <= 0) continue;

      const applyAmount = Math.min(unadjusted, remainingToApply);
      await prisma.supplierPayment.update({
        where: { id: adv.id },
        data: { adjustedAmount: Number(adv.adjustedAmount) + applyAmount },
      });

      // Create a linked payment record on the target invoice
      await prisma.supplierPayment.create({
        data: {
          purchaseInvoice: { connect: { id } },
          supplierId: invoice.supplierId,
          amount: applyAmount,
          paymentMethod: { connect: { id: adv.paymentMethodId } },
          notes: `Adjusted from advance (${new Date(adv.date).toLocaleDateString("en-IN")}, Rs.${Number(adv.amount).toFixed(0)})`,
        },
      });

      remainingToApply -= applyAmount;
      advanceApplied += applyAmount;
      totalApplied += applyAmount;
    }
    if (advanceApplied > 0) details.push(`Rs.${advanceApplied.toFixed(0)} from advances`);

    // 2. Apply overpayments from other invoices (paid > grandTotal)
    if (remainingToApply > 0) {
      const otherInvoices = await prisma.purchaseInvoice.findMany({
        where: {
          supplierId: invoice.supplierId,
          id: { not: id },
          status: { not: "CANCELLED" },
        },
        select: { id: true, amountPaid: true, grandTotal: true },
      });

      // Get a default payment method for recording the transfer
      const defaultMethod = await prisma.masterData.findFirst({
        where: { type: "PAYMENT_METHOD", active: true },
        select: { id: true },
      });

      let overpayApplied = 0;
      for (const other of otherInvoices) {
        if (remainingToApply <= 0) break;
        const overpaid = Number(other.amountPaid) - Number(other.grandTotal);
        if (overpaid <= 0) continue;

        const applyAmount = Math.min(overpaid, remainingToApply);
        // Reduce the overpaid invoice's amountPaid
        await prisma.purchaseInvoice.update({
          where: { id: other.id },
          data: { amountPaid: Number(other.amountPaid) - applyAmount },
        });

        // Create a linked payment record on the target invoice
        if (defaultMethod) {
          await prisma.supplierPayment.create({
            data: {
              purchaseInvoice: { connect: { id } },
              supplierId: invoice.supplierId,
              amount: applyAmount,
              paymentMethod: { connect: { id: defaultMethod.id } },
              notes: `Transferred from overpayment on PI-${other.id.slice(-6)}`,
            },
          });
        }

        remainingToApply -= applyAmount;
        overpayApplied += applyAmount;
      }
      if (overpayApplied > 0) {
        totalApplied += overpayApplied;
        details.push(`Rs.${overpayApplied.toFixed(0)} from overpayments`);
      }
    }

    if (totalApplied > 0) {
      const newPaid = Number(invoice.amountPaid) + totalApplied;
      const newOutstanding = Math.max(0, Number(invoice.grandTotal) - newPaid);
      const newStatus = newOutstanding <= 0 ? "PAID" : newPaid > 0 ? "PARTIALLY_PAID" : invoice.status;

      await prisma.purchaseInvoice.update({
        where: { id },
        data: {
          amountPaid: newPaid,
          outstandingAmount: newOutstanding,
          status: newStatus,
        },
      });

      return NextResponse.json({ message: `Applied: ${details.join(" + ")}. Outstanding: Rs.${newOutstanding.toFixed(0)}` });
    }

    return NextResponse.json({ error: "No pending advances or overpayments available for this supplier" }, { status: 400 });
  }

  // --- Finalize draft ---
  if (action === "finalize") {
    if (invoice.status !== "DRAFT") {
      return NextResponse.json({ error: "Only drafts can be finalized" }, { status: 400 });
    }

    // Set batch qtyRemaining to qtyReceived (make stock available)
    for (const item of invoice.items) {
      if (item.batch) {
        await prisma.batch.update({
          where: { id: item.batch.id },
          data: { qtyRemaining: item.batch.qtyReceived },
        });
      }
    }

    await prisma.purchaseInvoice.update({
      where: { id },
      data: { status: "FINALIZED" },
    });

    return NextResponse.json({ message: "Invoice finalized — stock is now available" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

/**
 * Recalculate purchase invoice totals and redistribute handling charge across all items.
 */
async function recalculateInvoice(invoiceId: string) {
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id: invoiceId },
    include: { items: { include: { batch: true } } },
  });
  if (!invoice) return;

  const totalItemsAmount = invoice.items.reduce((s, i) => s + Number(i.totalCost), 0);
  const handlingCharge = Number(invoice.handlingCharge);
  const grandTotal = totalItemsAmount + handlingCharge;

  // Redistribute handling across batches
  const landedCosts = distributeLandedCost(
    invoice.items.map((i) => ({
      unitCost: i.batch ? Number(i.batch.unitCost) : 0,
      qty: i.batch ? Number(i.batch.qtyReceived) : 0,
    })),
    handlingCharge
  );

  for (let i = 0; i < invoice.items.length; i++) {
    const item = invoice.items[i];
    if (item.batch) {
      await prisma.batch.update({
        where: { id: item.batch.id },
        data: {
          handlingCharge: landedCosts[i].handlingPerUnit * Number(item.batch.qtyReceived),
          landedCostPerUnit: landedCosts[i].landedCostPerUnit,
        },
      });
    }
  }

  // Update invoice totals
  const totalPaid = Number(invoice.amountPaid);
  await prisma.purchaseInvoice.update({
    where: { id: invoiceId },
    data: {
      totalItemsAmount,
      grandTotal,
      outstandingAmount: Math.max(grandTotal - totalPaid, 0),
    },
  });
}
