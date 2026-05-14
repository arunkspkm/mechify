import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { formatValidationError } from "@/lib/validation";

const updateSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  qualityRating: z.coerce.number().min(1).max(5).optional(),
  paymentTerms: z.string().optional().nullable(),
  creditPeriodDays: z.coerce.number().nonnegative().optional().nullable(),
  openingBalance: z.coerce.number().nonnegative().optional(),
  active: z.boolean().optional(),
});

const bulkPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentMethodId: z.string().min(1),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/suppliers/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseInvoices: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            invoiceNumber: true,
            grandTotal: true,
            amountPaid: true,
            outstandingAmount: true,
            status: true,
            invoiceDate: true,
          },
        },
        supplierReturns: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            returnNumber: true,
            totalAmount: true,
            creditReceived: true,
            status: true,
            createdAt: true,
          },
        },
        _count: {
          select: { batches: true, purchaseInvoices: true, purchaseOrders: true, supplierReturns: true },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Compute actual outstanding from all purchase invoices
    const allInvoices = await prisma.purchaseInvoice.findMany({
      where: { supplierId: id, status: { not: "CANCELLED" } },
      select: { outstandingAmount: true },
    });
    const invoiceOutstanding = allInvoices.reduce(
      (sum, pi) => sum + Number(pi.outstandingAmount), 0
    );
    const computedOutstanding = invoiceOutstanding + Number(supplier.openingBalance);

    // Get advance payment summary
    const advances = await prisma.supplierPayment.findMany({
      where: { supplierId: id, isAdvance: true },
      include: { paymentMethod: { select: { name: true } } },
      orderBy: { date: "desc" },
    });
    const totalAdvance = advances.reduce((s, a) => s + Number(a.amount), 0);
    const totalAdjusted = advances.reduce((s, a) => s + Number(a.adjustedAmount), 0);
    const pendingAdvance = totalAdvance - totalAdjusted;

    // Get all payments for the transaction history ledger (cash + non-cash, advance + applied + regular)
    const allPayments = await prisma.supplierPayment.findMany({
      where: { supplierId: id },
      include: {
        paymentMethod: { select: { name: true } },
        purchaseInvoice: { select: { id: true, invoiceNumber: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({
      data: {
        ...supplier,
        outstandingBalance: computedOutstanding,
        advances,
        advanceSummary: { totalAdvance, totalAdjusted, pendingAdvance },
        allPayments,
      },
    });
  } catch (err) {
    console.error("Supplier detail error:", err);
    return NextResponse.json({ error: "Failed to fetch supplier details" }, { status: 500 });
  }
}

// PATCH /api/suppliers/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSupplierSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const supplier = await prisma.supplier.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ data: supplier });
  } catch (err) {
    console.error("Supplier update error:", err);
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 });
  }
}

// POST /api/suppliers/[id] — Bulk payment (auto-distribute oldest-first)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = bulkPaymentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: formatValidationError(parsed.error) }, { status: 400 });
  }

  try {
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    let remaining = parsed.data.amount;
    const distributions: { type: string; id?: string; invoiceNumber?: string; amount: number }[] = [];

    // 1. Settle opening balance first (oldest debt)
    const openingBal = Number(supplier.openingBalance);
    if (openingBal > 0 && remaining > 0) {
      const applied = Math.min(remaining, openingBal);
      await prisma.supplier.update({
        where: { id },
        data: { openingBalance: openingBal - applied },
      });
      distributions.push({ type: "opening_balance", amount: applied });
      remaining -= applied;
    }

    // 2. Settle pending invoices oldest-first
    if (remaining > 0) {
      const pendingInvoices = await prisma.purchaseInvoice.findMany({
        where: { supplierId: id, status: { not: "CANCELLED" }, outstandingAmount: { gt: 0 } },
        orderBy: { invoiceDate: "asc" },
        select: { id: true, invoiceNumber: true, outstandingAmount: true, amountPaid: true },
      });

      for (const inv of pendingInvoices) {
        if (remaining <= 0) break;
        const outstanding = Number(inv.outstandingAmount);
        if (outstanding <= 0) continue;
        const applied = Math.min(remaining, outstanding);

        await prisma.purchaseInvoice.update({
          where: { id: inv.id },
          data: {
            amountPaid: { increment: applied },
            outstandingAmount: { decrement: applied },
            status: applied >= outstanding ? "PAID" : undefined,
          },
        });

        // Record supplier payment for this invoice
        await prisma.supplierPayment.create({
          data: {
            supplierId: id,
            purchaseInvoiceId: inv.id,
            amount: applied,
            paymentMethodId: parsed.data.paymentMethodId,
            reference: parsed.data.reference ?? null,
            notes: parsed.data.notes ?? null,
          },
        });

        distributions.push({
          type: "invoice",
          id: inv.id,
          invoiceNumber: inv.invoiceNumber ?? inv.id.slice(-6),
          amount: applied,
        });
        remaining -= applied;
      }
    }

    // 3. If anything left over, record as supplier advance
    if (remaining > 0) {
      await prisma.supplierPayment.create({
        data: {
          supplierId: id,
          amount: remaining,
          paymentMethodId: parsed.data.paymentMethodId,
          reference: parsed.data.reference ?? null,
          notes: `Advance from bulk payment${parsed.data.notes ? ` — ${parsed.data.notes}` : ""}`,
          isAdvance: true,
        },
      });
      distributions.push({ type: "advance", amount: remaining });
    }

    return NextResponse.json({
      data: {
        totalPaid: parsed.data.amount,
        distributions,
      },
    });
  } catch (err) {
    console.error("Supplier bulk payment error:", err);
    return NextResponse.json({ error: "Failed to process payment" }, { status: 500 });
  }
}
