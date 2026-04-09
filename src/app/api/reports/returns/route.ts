import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateExcel } from "@/lib/excel-export";

// GET /api/reports/returns?from=&to=&format=json|excel
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format") ?? "json";

  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to + "T23:59:59");

  try {
    // Customer returns with items
    const customerReturns = await prisma.customerReturn.findMany({
      where: { ...(from || to ? { createdAt: dateFilter } : {}) },
      include: {
        invoice: { select: { invoiceNumber: true } },
        customer: { select: { name: true, phone: true } },
        processedBy: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
            reason: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Supplier returns with items
    const supplierReturns = await prisma.supplierReturn.findMany({
      where: { ...(from || to ? { createdAt: dateFilter } : {}) },
      include: {
        supplier: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Customer return summaries
    const custTotalRefund = customerReturns
      .filter((r) => r.status === "APPROVED")
      .reduce((s, r) => s + Number(r.totalRefund), 0);
    const custPending = customerReturns.filter((r) => r.status === "PENDING").length;

    // Product-level breakdown for customer returns
    const custProductMap: Record<string, { name: string; sku: string; qty: number; refund: number; reasons: Record<string, number> }> = {};
    for (const ret of customerReturns) {
      if (ret.status === "REJECTED") continue;
      for (const item of ret.items) {
        const key = item.productId ?? item.customItemName ?? "unknown";
        if (!custProductMap[key]) {
          custProductMap[key] = {
            name: item.product?.name ?? item.customItemName ?? "Custom Item",
            sku: item.product?.sku ?? "—",
            qty: 0, refund: 0, reasons: {},
          };
        }
        custProductMap[key].qty += Number(item.qty);
        custProductMap[key].refund += Number(item.refundAmount);
        const reason = item.reason?.name ?? "Unknown";
        custProductMap[key].reasons[reason] = (custProductMap[key].reasons[reason] ?? 0) + Number(item.qty);
      }
    }
    const custProductBreakdown = Object.values(custProductMap)
      .sort((a, b) => b.qty - a.qty);

    // Supplier return summaries
    const supTotalAmount = supplierReturns.reduce((s, r) => s + Number(r.totalAmount), 0);
    const supTotalCredit = supplierReturns
      .filter((r) => r.status === "CREDIT_RECEIVED")
      .reduce((s, r) => s + Number(r.creditReceived), 0);

    // Product-level breakdown for supplier returns
    const supProductMap: Record<string, { name: string; sku: string; qty: number; cost: number; reasons: Record<string, number> }> = {};
    for (const ret of supplierReturns) {
      if (ret.status === "CANCELLED") continue;
      for (const item of ret.items) {
        const key = item.productId;
        if (!supProductMap[key]) {
          supProductMap[key] = {
            name: item.product.name,
            sku: item.product.sku,
            qty: 0, cost: 0, reasons: {},
          };
        }
        supProductMap[key].qty += Number(item.qty);
        supProductMap[key].cost += Number(item.totalCost);
        supProductMap[key].reasons[item.reason] = (supProductMap[key].reasons[item.reason] ?? 0) + Number(item.qty);
      }
    }
    const supProductBreakdown = Object.values(supProductMap)
      .sort((a, b) => b.qty - a.qty);

    // Top return reasons (customer)
    const reasonMap: Record<string, number> = {};
    for (const ret of customerReturns) {
      if (ret.status === "REJECTED") continue;
      for (const item of ret.items) {
        const reason = item.reason?.name ?? "Unknown";
        reasonMap[reason] = (reasonMap[reason] ?? 0) + Number(item.qty);
      }
    }
    const topReasons = Object.entries(reasonMap)
      .map(([reason, qty]) => ({ reason, qty }))
      .sort((a, b) => b.qty - a.qty);

    if (format === "excel") {
      const custRows = customerReturns.flatMap((ret) =>
        ret.items.map((item) => ({
          "Type": "Customer Return",
          "Return #": ret.returnNumber,
          "Date": new Date(ret.createdAt).toLocaleDateString("en-IN"),
          "Status": ret.status,
          "Invoice": ret.invoice?.invoiceNumber ?? "—",
          "Customer": ret.customer?.name ?? "Walk-in",
          "Product": item.product?.name ?? item.customItemName ?? "Custom",
          "SKU": item.product?.sku ?? "—",
          "Qty": Number(item.qty),
          "Refund Amount": Number(item.refundAmount).toFixed(2),
          "Reason": item.reason?.name ?? "—",
          "Resolution": item.resolution,
          "Restockable": item.restockable ? "Yes" : "No",
        }))
      );
      const supRows = supplierReturns.flatMap((ret) =>
        ret.items.map((item) => ({
          "Type": "Supplier Return",
          "Return #": ret.returnNumber,
          "Date": new Date(ret.createdAt).toLocaleDateString("en-IN"),
          "Status": ret.status,
          "Supplier": ret.supplier.name,
          "Product": item.product.name,
          "SKU": item.product.sku,
          "Qty": Number(item.qty),
          "Cost": Number(item.totalCost).toFixed(2),
          "Reason": item.reason,
          "Credit Received": ret.status === "CREDIT_RECEIVED" ? Number(ret.creditReceived).toFixed(2) : "—",
        }))
      );
      const allRows: Record<string, unknown>[] = [...custRows, ...supRows];
      if (allRows.length === 0) allRows.push({ "Type": "No returns in this period" });
      const buffer = generateExcel(allRows, "Returns Report");
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="returns_report_${from ?? "all"}_${to ?? "all"}.xlsx"`,
        },
      });
    }

    return NextResponse.json({
      data: {
        customer: {
          summary: {
            totalReturns: customerReturns.length,
            approved: customerReturns.filter((r) => r.status === "APPROVED").length,
            pending: custPending,
            rejected: customerReturns.filter((r) => r.status === "REJECTED").length,
            totalRefund: custTotalRefund,
          },
          productBreakdown: custProductBreakdown,
          topReasons,
          returns: customerReturns,
        },
        supplier: {
          summary: {
            totalReturns: supplierReturns.length,
            totalAmount: supTotalAmount,
            creditReceived: supTotalCredit,
            pendingCredit: supTotalAmount - supTotalCredit,
          },
          productBreakdown: supProductBreakdown,
          returns: supplierReturns,
        },
      },
    });
  } catch (err) {
    console.error("Returns report error:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
