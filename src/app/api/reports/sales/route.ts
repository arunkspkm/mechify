import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateExcel } from "@/lib/excel-export";

// GET /api/reports/sales?from=2026-04-01&to=2026-04-30&format=json|excel
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format") ?? "json";
  const groupBy = searchParams.get("groupBy") ?? "daily"; // daily, weekly, monthly

  const where: Record<string, unknown> = { status: { not: "CANCELLED" } };
  if (from || to) {
    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to + "T23:59:59");
    where.date = dateFilter;
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where,
      select: {
        invoiceNumber: true,
        date: true,
        grandTotal: true,
        subtotal: true,
        discountTotal: true,
        taxTotal: true,
        isCreditSale: true,
        amountPaid: true,
        outstandingAmount: true,
        customer: { select: { name: true } },
        operator: { select: { name: true } },
        items: {
          where: { discountAmount: { gt: 0 } },
          select: {
            qty: true, unitPrice: true, discountAmount: true,
            product: { select: { name: true, sku: true } },
            isCustomItem: true, customItemName: true,
          },
        },
        _count: { select: { items: true } },
      },
      orderBy: { date: "asc" },
    });

    // Summary
    const totalSales = invoices.reduce((s, i) => s + Number(i.grandTotal), 0);
    const totalDiscount = invoices.reduce((s, i) => s + Number(i.discountTotal), 0);
    const totalTax = invoices.reduce((s, i) => s + Number(i.taxTotal), 0);
    const totalCollected = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);
    const totalOutstanding = invoices.reduce((s, i) => s + Number(i.outstandingAmount), 0);

    // Approved customer return refunds in the period
    const returnWhere: Record<string, unknown> = { status: "APPROVED" };
    if (from || to) {
      const retDateFilter: Record<string, unknown> = {};
      if (from) retDateFilter.gte = new Date(from);
      if (to) retDateFilter.lte = new Date(to + "T23:59:59");
      returnWhere.updatedAt = retDateFilter;
    }
    const approvedReturns = await prisma.customerReturn.findMany({
      where: returnWhere,
      select: { returnNumber: true, totalRefund: true, updatedAt: true, customer: { select: { name: true } } },
    });
    const totalRefunds = approvedReturns.reduce((s, r) => s + Number(r.totalRefund), 0);

    // Group by date
    const grouped: Record<string, { date: string; sales: number; invoiceCount: number; discount: number }> = {};
    for (const inv of invoices) {
      let key: string;
      const d = new Date(inv.date);
      if (groupBy === "monthly") {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      } else if (groupBy === "weekly") {
        const startOfWeek = new Date(d);
        const day = startOfWeek.getDay();
        startOfWeek.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        key = startOfWeek.toISOString().slice(0, 10);
      } else {
        key = d.toISOString().slice(0, 10);
      }
      if (!grouped[key]) grouped[key] = { date: key, sales: 0, invoiceCount: 0, discount: 0 };
      grouped[key].sales += Number(inv.grandTotal);
      grouped[key].invoiceCount += 1;
      grouped[key].discount += Number(inv.discountTotal);
    }
    const chartData = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));

    if (format === "excel") {
      const rows = invoices.map((inv) => ({
        "Invoice #": inv.invoiceNumber,
        "Date": new Date(inv.date).toLocaleDateString("en-IN"),
        "Customer": inv.customer?.name ?? "Walk-in",
        "Items": inv._count.items,
        "Subtotal": Number(inv.subtotal).toFixed(2),
        "Discount": Number(inv.discountTotal).toFixed(2),
        "Tax": Number(inv.taxTotal).toFixed(2),
        "Grand Total": Number(inv.grandTotal).toFixed(2),
        "Paid": Number(inv.amountPaid).toFixed(2),
        "Outstanding": Number(inv.outstandingAmount).toFixed(2),
        "Operator": inv.operator.name,
      }));
      const buffer = generateExcel(rows, "Sales Report");
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="sales_report_${from ?? "all"}_${to ?? "all"}.xlsx"`,
        },
      });
    }

    // Discount analysis
    // By product
    const discProductMap: Record<string, { name: string; sku: string; totalDiscount: number; qty: number; count: number }> = {};
    // By operator
    const discOperatorMap: Record<string, { name: string; totalDiscount: number; invoiceCount: number }> = {};

    for (const inv of invoices) {
      if (Number(inv.discountTotal) > 0) {
        const opName = inv.operator.name;
        if (!discOperatorMap[opName]) discOperatorMap[opName] = { name: opName, totalDiscount: 0, invoiceCount: 0 };
        discOperatorMap[opName].totalDiscount += Number(inv.discountTotal);
        discOperatorMap[opName].invoiceCount++;
      }
      for (const item of inv.items) {
        const name = item.isCustomItem ? (item.customItemName ?? "Custom") : (item.product?.name ?? "Unknown");
        const sku = item.product?.sku ?? "—";
        const key = item.product?.sku ?? name;
        if (!discProductMap[key]) discProductMap[key] = { name, sku, totalDiscount: 0, qty: 0, count: 0 };
        discProductMap[key].totalDiscount += Number(item.discountAmount) * Number(item.qty);
        discProductMap[key].qty += Number(item.qty);
        discProductMap[key].count++;
      }
    }

    const discountByProduct = Object.values(discProductMap).sort((a, b) => b.totalDiscount - a.totalDiscount);
    const discountByOperator = Object.values(discOperatorMap).sort((a, b) => b.totalDiscount - a.totalDiscount);

    return NextResponse.json({
      data: {
        summary: {
          totalSales, totalRefunds, netSales: totalSales - totalRefunds,
          totalDiscount, totalTax, totalCollected, totalOutstanding,
          invoiceCount: invoices.length, returnCount: approvedReturns.length,
          discountPercent: totalSales > 0 ? ((totalDiscount / totalSales) * 100) : 0,
        },
        discountAnalysis: {
          byProduct: discountByProduct.slice(0, 20),
          byOperator: discountByOperator,
        },
        chartData,
        invoices: invoices.slice(0, 100),
        returns: approvedReturns,
      },
    });
  } catch (err) {
    console.error("Sales report error:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
