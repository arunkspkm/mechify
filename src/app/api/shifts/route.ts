import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { formatValidationError } from "@/lib/validation";
import { createNotification } from "@/lib/notify";

const openShiftSchema = z.object({
  openingBalance: z.coerce.number().nonnegative("Opening balance must be non-negative"),
});

const closeShiftSchema = z.object({
  shiftId: z.string().min(1),
  actualCash: z.coerce.number().nonnegative(),
  varianceReason: z.string().optional().default(""),
});

// GET /api/shifts — List shifts
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

  // Non-owners can only see their own shifts
  if (session.user.role !== "OWNER") {
    where.operatorId = session.user.id;
  }

  const [shifts, total] = await Promise.all([
    prisma.shift.findMany({
      where,
      include: {
        operator: { select: { name: true } },
        _count: { select: { invoices: true } },
      },
      orderBy: { startTime: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.shift.count({ where }),
  ]);

  return NextResponse.json({
    data: shifts,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/shifts — Open a new shift
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = openShiftSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  // Check if operator already has an open shift
  const existingOpen = await prisma.shift.findFirst({
    where: { operatorId: session.user.id, status: "OPEN" },
  });

  if (existingOpen) {
    return NextResponse.json(
      { error: "You already have an open shift. Close it before opening a new one." },
      { status: 400 }
    );
  }

  const shift = await prisma.shift.create({
    data: {
      operatorId: session.user.id,
      openingBalance: parsed.data.openingBalance,
      date: new Date(),
      startTime: new Date(),
    },
    include: { operator: { select: { name: true } } },
  });

  return NextResponse.json({ data: shift }, { status: 201 });
}

// PATCH /api/shifts — Close a shift
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = closeShiftSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  const { shiftId, actualCash, varianceReason } = parsed.data;

  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      invoices: {
        include: {
          payments: {
            include: { paymentMethod: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  if (shift.status !== "OPEN") {
    return NextResponse.json({ error: "Shift is already closed" }, { status: 400 });
  }

  // Only the shift operator or owner can close the shift
  if (shift.operatorId !== session.user.id && session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Only the shift operator or owner can close this shift" }, { status: 403 });
  }

  // Calculate expected totals by payment method
  const paymentTotals: Record<string, number> = {};
  let totalSales = 0;

  for (const invoice of shift.invoices) {
    for (const payment of invoice.payments) {
      const methodName = payment.paymentMethod.name;
      paymentTotals[methodName] = (paymentTotals[methodName] ?? 0) + Number(payment.amount);
      totalSales += Number(payment.amount);
    }
  }

  // Deduct approved customer return refunds processed during this shift
  const approvedReturns = await prisma.customerReturn.findMany({
    where: {
      status: "APPROVED",
      updatedAt: { gte: shift.startTime },
    },
  });
  const totalRefunds = approvedReturns.reduce((s, r) => s + Number(r.totalRefund), 0);

  // Deduct cash advances given during this shift
  const cashAdvances = await prisma.advancePayment.findMany({
    where: {
      createdAt: { gte: shift.startTime },
      paymentMethod: { name: "Cash" },
    },
    select: { amount: true },
  });
  const totalCashAdvances = cashAdvances.reduce((s, a) => s + Number(a.amount), 0);

  // Deduct cash expenses recorded during this shift (cash physically left the drawer at createdAt time)
  const cashExpenses = await prisma.expense.findMany({
    where: {
      createdAt: { gte: shift.startTime },
      paymentMethod: { name: "Cash" },
    },
    select: { amount: true },
  });
  const totalCashExpenses = cashExpenses.reduce((s, e) => s + Number(e.amount), 0);

  // Add cash received from customer credit payments during this shift
  const customerCashPayments = await prisma.customerPayment.findMany({
    where: {
      date: { gte: shift.startTime },
      paymentMethod: { name: "Cash" },
    },
    select: { amount: true },
  });
  const totalCashCollections = customerCashPayments.reduce((s, p) => s + Number(p.amount), 0);

  // Deduct cash paid to suppliers during this shift
  // Exclude isAdvanceApplication rows — those are audit entries; the cash already left the drawer when the advance was originally recorded.
  const supplierCashPayments = await prisma.supplierPayment.findMany({
    where: {
      createdAt: { gte: shift.startTime },
      paymentMethod: { name: "Cash" },
      isAdvanceApplication: false,
    },
    select: { amount: true },
  });
  const totalSupplierPayments = supplierCashPayments.reduce((s, p) => s + Number(p.amount), 0);

  const expectedCash = Number(shift.openingBalance) + (paymentTotals["Cash"] ?? 0) + totalCashCollections - totalRefunds - totalCashAdvances - totalCashExpenses - totalSupplierPayments;
  const variance = actualCash - expectedCash;

  // Require reason if there's a variance
  if (Math.abs(variance) > 0.01 && !varianceReason.trim()) {
    return NextResponse.json(
      { error: "Variance reason is required when actual cash doesn't match expected cash" },
      { status: 400 }
    );
  }

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      status: "CLOSED",
      closingBalance: actualCash,
      expectedCash,
      actualCash,
      variance,
      varianceReason: varianceReason || null,
      endTime: new Date(),
    },
    include: { operator: { select: { name: true } } },
  });

  if (Math.abs(variance) > 0.01) {
    try {
      await createNotification({
        type: "SHIFT_VARIANCE",
        title: "Shift Variance",
        message: `Shift closed by ${updated.operator.name} with Rs.${Math.abs(variance).toFixed(2)} variance`,
        link: `/shifts/${shiftId}`,
        recipientRole: "OWNER",
      });
    } catch {}
  }

  return NextResponse.json({
    data: {
      ...updated,
      summary: {
        totalSales,
        totalRefunds,
        totalCashAdvances,
        totalCashCollections,
        totalCashExpenses,
        totalSupplierPayments,
        returnCount: approvedReturns.length,
        invoiceCount: shift.invoices.length,
        paymentTotals,
        openingBalance: Number(shift.openingBalance),
        expectedCash,
        actualCash,
        variance,
      },
    },
  });
}
