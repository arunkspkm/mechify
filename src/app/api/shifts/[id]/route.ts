import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/shifts/[id] — Shift detail with sales breakdown
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
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        operator: { select: { name: true } },
        invoices: {
          include: {
            customer: { select: { name: true } },
            payments: {
              include: { paymentMethod: { select: { name: true } } },
            },
            _count: { select: { items: true } },
          },
          orderBy: { date: "asc" },
        },
      },
    });

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    // Calculate summary
    const paymentTotals: Record<string, number> = {};
    let totalSales = 0;
    let totalItems = 0;

    for (const invoice of shift.invoices) {
      totalItems += invoice._count.items;
      for (const payment of invoice.payments) {
        const methodName = payment.paymentMethod.name;
        paymentTotals[methodName] = (paymentTotals[methodName] ?? 0) + Number(payment.amount);
        totalSales += Number(payment.amount);
      }
    }

    // Deduct approved customer return refunds processed during this shift
    const returnTimeFilter: Record<string, unknown> = { gte: shift.startTime };
    if (shift.endTime) returnTimeFilter.lte = shift.endTime;
    const approvedReturns = await prisma.customerReturn.findMany({
      where: {
        status: "APPROVED",
        updatedAt: returnTimeFilter,
      },
      include: {
        invoice: { select: { invoiceNumber: true } },
        customer: { select: { name: true } },
      },
    });
    const totalRefunds = approvedReturns.reduce((s, r) => s + Number(r.totalRefund), 0);

    return NextResponse.json({
      data: {
        ...shift,
        approvedReturns,
        summary: {
          totalSales,
          totalRefunds,
          returnCount: approvedReturns.length,
          invoiceCount: shift.invoices.length,
          totalItems,
          paymentTotals,
          openingBalance: Number(shift.openingBalance),
          expectedCash: Number(shift.openingBalance) + (paymentTotals["Cash"] ?? 0) - totalRefunds,
          actualCash: shift.actualCash ? Number(shift.actualCash) : null,
          variance: shift.variance ? Number(shift.variance) : null,
        },
      },
    });
  } catch (err) {
    console.error("Shift detail error:", err);
    return NextResponse.json({ error: "Failed to fetch shift details" }, { status: 500 });
  }
}
