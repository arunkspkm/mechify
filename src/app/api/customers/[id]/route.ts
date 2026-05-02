import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  creditLimit: z.coerce.number().nonnegative().optional(),
  openingBalance: z.coerce.number().nonnegative().optional(),
});

// GET /api/customers/[id] — Customer detail with credit info
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
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        vehicles: {
          include: {
            vehicleMake: { select: { name: true } },
            vehicleModel: { select: { name: true } },
          },
        },
        invoices: {
          where: { isCreditSale: true, outstandingAmount: { gt: 0 } },
          orderBy: { date: "desc" },
          select: {
            id: true,
            invoiceNumber: true,
            date: true,
            grandTotal: true,
            amountPaid: true,
            outstandingAmount: true,
          },
        },
        payments: {
          orderBy: { date: "desc" },
          take: 20,
          include: {
            paymentMethod: { select: { name: true } },
            invoice: { select: { invoiceNumber: true } },
          },
        },
        loyaltyTransactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        _count: { select: { invoices: true } },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Calculate total credit stats
    const allCreditInvoices = await prisma.invoice.findMany({
      where: { customerId: id, isCreditSale: true },
      select: { grandTotal: true, amountPaid: true, outstandingAmount: true },
    });

    const invoiceOutstanding = allCreditInvoices.reduce((s, i) => s + Number(i.outstandingAmount), 0);
    const stats = {
      totalCreditSales: allCreditInvoices.reduce((s, i) => s + Number(i.grandTotal), 0),
      totalCollected: allCreditInvoices.reduce((s, i) => s + Number(i.amountPaid), 0),
      totalOutstanding: invoiceOutstanding + Number(customer.openingBalance),
      invoiceCount: allCreditInvoices.length,
    };

    return NextResponse.json({ data: { ...customer, creditStats: stats } });
  } catch (err) {
    console.error("Customer detail error:", err);
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
  }
}

// PATCH /api/customers/[id] — Update customer (Owner only)
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
  const parsed = updateCustomerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  try {
    // Check phone uniqueness if changing phone
    if (parsed.data.phone) {
      const existing = await prisma.customer.findFirst({
        where: { phone: parsed.data.phone, id: { not: id } },
      });
      if (existing) {
        return NextResponse.json({ error: `Phone "${parsed.data.phone}" is already used by another customer` }, { status: 409 });
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ data: customer });
  } catch (err) {
    console.error("Customer update error:", err);
    const message = err instanceof Error ? err.message : "";
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Phone number already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}

const bulkCollectSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentMethodId: z.string().min(1),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// POST /api/customers/[id] — Bulk collect outstanding (opening balance + oldest invoices)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = bulkCollectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  try {
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    let remaining = parsed.data.amount;
    const distributions: { type: string; id?: string; invoiceNumber?: string; amount: number }[] = [];

    // 1. Settle opening balance first (oldest debt)
    const openingBal = Number(customer.openingBalance);
    if (openingBal > 0 && remaining > 0) {
      const applied = Math.min(remaining, openingBal);
      await prisma.customer.update({
        where: { id },
        data: { openingBalance: openingBal - applied },
      });
      // Record as customer payment with no invoice (opening balance settlement)
      await prisma.customerPayment.create({
        data: {
          customer: { connect: { id } },
          amount: applied,
          paymentMethod: { connect: { id: parsed.data.paymentMethodId } },
          receivedBy: { connect: { id: session.user.id } },
          reference: parsed.data.reference ?? null,
          notes: `Opening balance settlement${parsed.data.notes ? ` — ${parsed.data.notes}` : ""}`,
        },
      });
      distributions.push({ type: "opening_balance", amount: applied });
      remaining -= applied;
    }

    // 2. Settle pending credit invoices oldest-first
    if (remaining > 0) {
      const pendingInvoices = await prisma.invoice.findMany({
        where: { customerId: id, isCreditSale: true, status: { not: "CANCELLED" }, outstandingAmount: { gt: 0 } },
        orderBy: { date: "asc" },
        select: { id: true, invoiceNumber: true, outstandingAmount: true, amountPaid: true, grandTotal: true },
      });

      for (const inv of pendingInvoices) {
        if (remaining <= 0) break;
        const outstanding = Number(inv.outstandingAmount);
        if (outstanding <= 0) continue;
        const applied = Math.min(remaining, outstanding);

        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            amountPaid: { increment: applied },
            outstandingAmount: { decrement: applied },
          },
        });

        await prisma.customerPayment.create({
          data: {
            customer: { connect: { id } },
            invoice: { connect: { id: inv.id } },
            amount: applied,
            paymentMethod: { connect: { id: parsed.data.paymentMethodId } },
            receivedBy: { connect: { id: session.user.id } },
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

    if (remaining > 0) {
      return NextResponse.json({
        data: {
          totalPaid: parsed.data.amount - remaining,
          remainingUnapplied: remaining,
          distributions,
          warning: `Rs.${remaining.toFixed(0)} could not be applied (no outstanding balance or invoices to settle).`,
        },
      });
    }

    return NextResponse.json({
      data: {
        totalPaid: parsed.data.amount,
        distributions,
      },
    });
  } catch (err) {
    console.error("Customer bulk collect error:", err);
    return NextResponse.json({ error: "Failed to collect payment" }, { status: 500 });
  }
}
