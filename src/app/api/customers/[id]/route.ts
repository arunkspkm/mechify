import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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

    const stats = {
      totalCreditSales: allCreditInvoices.reduce((s, i) => s + Number(i.grandTotal), 0),
      totalCollected: allCreditInvoices.reduce((s, i) => s + Number(i.amountPaid), 0),
      totalOutstanding: allCreditInvoices.reduce((s, i) => s + Number(i.outstandingAmount), 0),
      invoiceCount: allCreditInvoices.length,
    };

    return NextResponse.json({ data: { ...customer, creditStats: stats } });
  } catch (err) {
    console.error("Customer detail error:", err);
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
  }
}
