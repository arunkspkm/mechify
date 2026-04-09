import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateExcel } from "@/lib/excel-export";

// GET /api/reports/ledger?type=supplier|customer&format=json|excel
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "supplier";
  const format = searchParams.get("format") ?? "json";

  try {
    if (type === "supplier") {
      const suppliers = await prisma.supplier.findMany({
        where: { active: true },
        select: {
          id: true, name: true, phone: true, gstNumber: true,
          _count: { select: { purchaseInvoices: true, supplierReturns: true } },
        },
        orderBy: { name: "asc" },
      });

      // Get outstanding per supplier + overpayments + advances
      const ledger = await Promise.all(suppliers.map(async (s) => {
        const agg = await prisma.purchaseInvoice.aggregate({
          where: { supplierId: s.id, status: { not: "CANCELLED" } },
          _sum: { grandTotal: true, amountPaid: true, outstandingAmount: true },
        });
        const totalPurchases = Number(agg._sum.grandTotal ?? 0);
        const totalPaid = Number(agg._sum.amountPaid ?? 0);
        const outstanding = Number(agg._sum.outstandingAmount ?? 0);
        // Overpayment = paid more than invoice total (e.g., price corrected after payment)
        const overpayment = Math.max(0, totalPaid - totalPurchases);

        // Pending advances
        const advances = await prisma.supplierPayment.findMany({
          where: { supplierId: s.id, isAdvance: true },
          select: { amount: true, adjustedAmount: true },
        });
        const totalAdvance = advances.reduce((sum, a) => sum + Number(a.amount), 0);
        const totalAdjusted = advances.reduce((sum, a) => sum + Number(a.adjustedAmount), 0);
        const pendingAdvance = totalAdvance - totalAdjusted;

        // Net balance: positive = we owe them, negative = they owe us
        const netBalance = outstanding - overpayment - pendingAdvance;

        return {
          id: s.id, name: s.name, phone: s.phone, gstNumber: s.gstNumber,
          totalPurchases, totalPaid, outstanding, overpayment, pendingAdvance, netBalance,
          invoiceCount: s._count.purchaseInvoices,
          returnCount: s._count.supplierReturns,
        };
      }));

      const totalOutstanding = ledger.reduce((s, l) => s + l.outstanding, 0);
      const totalPurchases = ledger.reduce((s, l) => s + l.totalPurchases, 0);
      const totalOverpayment = ledger.reduce((s, l) => s + l.overpayment, 0);
      const totalPendingAdvance = ledger.reduce((s, l) => s + l.pendingAdvance, 0);

      if (format === "excel") {
        const rows = ledger.map((l) => ({
          "Supplier": l.name,
          "Phone": l.phone ?? "",
          "GST": l.gstNumber ?? "",
          "Total Purchases": l.totalPurchases.toFixed(2),
          "Total Paid": l.totalPaid.toFixed(2),
          "Outstanding": l.outstanding.toFixed(2),
          "Overpayment": l.overpayment > 0 ? l.overpayment.toFixed(2) : "",
          "Pending Advance": l.pendingAdvance > 0 ? l.pendingAdvance.toFixed(2) : "",
          "Net Balance": l.netBalance.toFixed(2),
          "Invoices": l.invoiceCount,
          "Returns": l.returnCount,
        }));
        const buffer = generateExcel(rows, "Supplier Ledger");
        return new NextResponse(buffer as unknown as BodyInit, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="supplier_ledger.xlsx"`,
          },
        });
      }

      return NextResponse.json({
        data: { summary: { totalOutstanding, totalPurchases, totalOverpayment, totalPendingAdvance, supplierCount: ledger.length }, ledger },
      });
    }

    // Customer ledger
    const customers = await prisma.customer.findMany({
      select: {
        id: true, name: true, phone: true, outstandingBalance: true,
        _count: { select: { invoices: true, returns: true } },
      },
      orderBy: { name: "asc" },
    });

    const customerLedger = await Promise.all(customers.map(async (c) => {
      const agg = await prisma.invoice.aggregate({
        where: { customerId: c.id, status: { not: "CANCELLED" } },
        _sum: { grandTotal: true, amountPaid: true, outstandingAmount: true },
      });
      return {
        id: c.id, name: c.name, phone: c.phone,
        totalSales: Number(agg._sum.grandTotal ?? 0),
        totalPaid: Number(agg._sum.amountPaid ?? 0),
        outstanding: Number(agg._sum.outstandingAmount ?? 0),
        invoiceCount: c._count.invoices,
        returnCount: c._count.returns,
      };
    }));

    const totalReceivable = customerLedger.reduce((s, c) => s + c.outstanding, 0);
    const totalCustomerSales = customerLedger.reduce((s, c) => s + c.totalSales, 0);

    if (format === "excel") {
      const rows = customerLedger.map((c) => ({
        "Customer": c.name,
        "Phone": c.phone ?? "",
        "Total Sales": c.totalSales.toFixed(2),
        "Total Paid": c.totalPaid.toFixed(2),
        "Outstanding": c.outstanding.toFixed(2),
        "Invoices": c.invoiceCount,
        "Returns": c.returnCount,
      }));
      const buffer = generateExcel(rows, "Customer Ledger");
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="customer_ledger.xlsx"`,
        },
      });
    }

    return NextResponse.json({
      data: { summary: { totalReceivable, totalCustomerSales, customerCount: customerLedger.length }, ledger: customerLedger },
    });
  } catch (err) {
    console.error("Ledger report error:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
