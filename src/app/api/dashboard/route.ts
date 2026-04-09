import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/dashboard — KPI metrics
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const todayEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1));

    // This week (Mon-Sun)
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    // This month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Parallel queries
    const [
      todaySales,
      weekSales,
      monthSales,
      todayInvoiceCount,
      monthInvoiceCount,
      lowStockProducts,
      pendingReturns,
      pendingWriteOffs,
      openEnquiries,
      totalCustomers,
      totalProducts,
      recentInvoices,
      topProducts,
      dailySalesData,
      monthlyExpenses,
      pendingPayables,
      pendingReceivables,
    ] = await Promise.all([
      // Today's sales
      prisma.invoice.aggregate({
        where: { date: { gte: todayStart, lt: todayEnd }, status: { not: "CANCELLED" } },
        _sum: { grandTotal: true },
      }),
      // This week's sales
      prisma.invoice.aggregate({
        where: { date: { gte: weekStart }, status: { not: "CANCELLED" } },
        _sum: { grandTotal: true },
      }),
      // This month's sales
      prisma.invoice.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd }, status: { not: "CANCELLED" } },
        _sum: { grandTotal: true },
      }),
      // Today's invoice count
      prisma.invoice.count({
        where: { date: { gte: todayStart, lt: todayEnd }, status: { not: "CANCELLED" } },
      }),
      // Month's invoice count
      prisma.invoice.count({
        where: { date: { gte: monthStart, lte: monthEnd }, status: { not: "CANCELLED" } },
      }),
      // Low stock products
      prisma.product.findMany({
        where: { active: true },
        select: {
          id: true, name: true, sku: true, lowStockThreshold: true,
          batches: { where: { active: true }, select: { qtyRemaining: true } },
        },
      }),
      // Pending customer returns
      prisma.customerReturn.count({ where: { status: "PENDING" } }),
      // Pending write-offs
      prisma.stockWriteOff.count({ where: { status: "PENDING" } }),
      // Open enquiries
      prisma.customerEnquiry.count({
        where: { status: { in: ["ENQUIRY_RECORDED", "ORDER_PLACED", "IN_TRANSIT", "RECEIVED", "CUSTOMER_NOTIFIED"] } },
      }),
      // Total customers
      prisma.customer.count(),
      // Total active products
      prisma.product.count({ where: { active: true } }),
      // Recent invoices (last 5)
      prisma.invoice.findMany({
        where: { status: { not: "CANCELLED" } },
        select: {
          id: true, invoiceNumber: true, grandTotal: true, date: true,
          customer: { select: { name: true } },
        },
        orderBy: { date: "desc" },
        take: 5,
      }),
      // Top selling products this month (by qty)
      prisma.invoiceItem.groupBy({
        by: ["productId"],
        where: {
          invoice: { date: { gte: monthStart, lte: monthEnd }, status: { not: "CANCELLED" } },
          productId: { not: null },
        },
        _sum: { qty: true, lineTotal: true },
        orderBy: { _sum: { lineTotal: "desc" } },
        take: 5,
      }),
      // Last 30 days daily sales for chart
      (() => {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 29);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        return prisma.invoice.findMany({
          where: { date: { gte: thirtyDaysAgo }, status: { not: "CANCELLED" } },
          select: { date: true, grandTotal: true },
          orderBy: { date: "asc" },
        });
      })(),
      // This month's expenses
      prisma.expense.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      // Pending supplier payables
      prisma.purchaseInvoice.aggregate({
        where: { status: { not: "CANCELLED" }, outstandingAmount: { gt: 0 } },
        _sum: { outstandingAmount: true },
      }),
      // Pending customer receivables
      prisma.invoice.aggregate({
        where: { status: { not: "CANCELLED" }, isCreditSale: true, outstandingAmount: { gt: 0 } },
        _sum: { outstandingAmount: true },
      }),
    ]);

    // Approved customer return refunds
    const [todayRefunds, weekRefunds, monthRefunds] = await Promise.all([
      prisma.customerReturn.aggregate({
        where: { status: "APPROVED", updatedAt: { gte: todayStart, lt: todayEnd } },
        _sum: { totalRefund: true },
      }),
      prisma.customerReturn.aggregate({
        where: { status: "APPROVED", updatedAt: { gte: weekStart } },
        _sum: { totalRefund: true },
      }),
      prisma.customerReturn.aggregate({
        where: { status: "APPROVED", updatedAt: { gte: monthStart, lte: monthEnd } },
        _sum: { totalRefund: true },
      }),
    ]);
    const todayRefundAmt = Number(todayRefunds._sum.totalRefund ?? 0);
    const weekRefundAmt = Number(weekRefunds._sum.totalRefund ?? 0);
    const monthRefundAmt = Number(monthRefunds._sum.totalRefund ?? 0);

    // Process low stock
    const lowStockList = lowStockProducts
      .map((p) => {
        const totalQty = p.batches.reduce((s, b) => s + Number(b.qtyRemaining), 0);
        return { id: p.id, name: p.name, sku: p.sku, stock: totalQty, threshold: p.lowStockThreshold };
      })
      .filter((p) => p.stock <= p.threshold)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);

    // Process top products — fetch product names
    const topProductIds = topProducts.map((t) => t.productId).filter(Boolean) as string[];
    const productNames = topProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameMap = new Map(productNames.map((p) => [p.id, p.name]));
    const topProductsList = topProducts.map((t) => ({
      productId: t.productId,
      name: nameMap.get(t.productId!) ?? "Unknown",
      totalQty: Number(t._sum.qty ?? 0),
      totalRevenue: Number(t._sum.lineTotal ?? 0),
    }));

    // Process daily sales for chart (aggregate by date)
    const dailyMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - 29 + i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, 0);
    }
    for (const inv of dailySalesData) {
      const key = new Date(inv.date).toISOString().slice(0, 10);
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + Number(inv.grandTotal));
    }
    const salesChart = Array.from(dailyMap.entries()).map(([date, total]) => ({
      date,
      label: new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      total,
    }));

    // ========== Business Health Metrics ==========

    // Last month for comparison
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [lastMonthSales, lastMonthInvoiceCount, lastMonthExpenses] = await Promise.all([
      prisma.invoice.aggregate({
        where: { date: { gte: lastMonthStart, lte: lastMonthEnd }, status: { not: "CANCELLED" } },
        _sum: { grandTotal: true },
      }),
      prisma.invoice.count({
        where: { date: { gte: lastMonthStart, lte: lastMonthEnd }, status: { not: "CANCELLED" } },
      }),
      prisma.expense.aggregate({
        where: { date: { gte: lastMonthStart, lte: lastMonthEnd } },
        _sum: { amount: true },
      }),
    ]);

    const thisMonthRevenue = Number(monthSales._sum.grandTotal ?? 0) - monthRefundAmt;
    const lastMonthRevenue = Number(lastMonthSales._sum.grandTotal ?? 0);
    const revenueGrowth = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

    // Average bill value
    const avgBillValue = monthInvoiceCount > 0 ? thisMonthRevenue / monthInvoiceCount : 0;
    const lastAvgBill = lastMonthInvoiceCount > 0 ? lastMonthRevenue / lastMonthInvoiceCount : 0;

    // Gross margin (this month)
    const monthCOGS = await prisma.invoiceItem.findMany({
      where: { invoice: { date: { gte: monthStart, lte: monthEnd }, status: { not: "CANCELLED" } } },
      select: { qty: true, landedCostPerUnit: true },
    });
    const totalCOGS = monthCOGS.reduce((s, i) => s + Number(i.qty) * Number(i.landedCostPerUnit), 0);
    const grossMarginPct = thisMonthRevenue > 0 ? ((thisMonthRevenue - totalCOGS) / thisMonthRevenue) * 100 : 0;

    // Discount leakage
    const monthDiscounts = await prisma.invoice.aggregate({
      where: { date: { gte: monthStart, lte: monthEnd }, status: { not: "CANCELLED" } },
      _sum: { discountTotal: true },
    });
    const totalDiscounts = Number(monthDiscounts._sum.discountTotal ?? 0);
    const discountPct = thisMonthRevenue > 0 ? (totalDiscounts / (thisMonthRevenue + totalDiscounts)) * 100 : 0;

    // New vs returning customers this month
    const monthCustomerIds = await prisma.invoice.findMany({
      where: { date: { gte: monthStart, lte: monthEnd }, status: { not: "CANCELLED" }, customerId: { not: null } },
      select: { customerId: true },
      distinct: ["customerId"],
    });
    const newCustomersThisMonth = await prisma.customer.count({
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
    });
    const uniqueCustomersThisMonth = monthCustomerIds.length;
    const returningCustomers = uniqueCustomersThisMonth - newCustomersThisMonth;

    // Dead stock (no sales in 60+ days)
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);
    const allActiveProducts = await prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, sellingPrice: true, batches: { where: { active: true }, select: { qtyRemaining: true } } },
    });
    const recentlySoldProductIds = await prisma.invoiceItem.findMany({
      where: { invoice: { date: { gte: sixtyDaysAgo }, status: { not: "CANCELLED" } }, productId: { not: null } },
      select: { productId: true },
      distinct: ["productId"],
    });
    const soldIds = new Set(recentlySoldProductIds.map((i) => i.productId));
    const deadStock = allActiveProducts
      .filter((p) => !soldIds.has(p.id))
      .map((p) => {
        const stock = p.batches.reduce((s, b) => s + Number(b.qtyRemaining), 0);
        return { name: p.name, stock, value: stock * Number(p.sellingPrice) };
      })
      .filter((p) => p.stock > 0)
      .sort((a, b) => b.value - a.value);
    const deadStockValue = deadStock.reduce((s, p) => s + p.value, 0);

    // Return rate
    const monthReturns = await prisma.customerReturn.count({
      where: { status: "APPROVED", createdAt: { gte: monthStart, lte: monthEnd } },
    });
    const returnRate = monthInvoiceCount > 0 ? (monthReturns / monthInvoiceCount) * 100 : 0;

    // Enquiry conversion
    const monthEnquiries = await prisma.customerEnquiry.count({
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
    });
    const convertedEnquiries = await prisma.customerEnquiry.count({
      where: { createdAt: { gte: monthStart, lte: monthEnd }, status: "DELIVERED" },
    });
    const enquiryConversion = monthEnquiries > 0 ? (convertedEnquiries / monthEnquiries) * 100 : 0;

    // Receivables aging
    const overdueReceivables = await prisma.invoice.findMany({
      where: { isCreditSale: true, outstandingAmount: { gt: 0 }, status: { not: "CANCELLED" } },
      select: { date: true, outstandingAmount: true, customer: { select: { name: true } } },
    });
    const aging = { under30: 0, under60: 0, over60: 0 };
    for (const inv of overdueReceivables) {
      const daysDue = Math.floor((now.getTime() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24));
      const amt = Number(inv.outstandingAmount);
      if (daysDue < 30) aging.under30 += amt;
      else if (daysDue < 60) aging.under60 += amt;
      else aging.over60 += amt;
    }

    const businessHealth = {
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      lastMonthRevenue,
      avgBillValue: Math.round(avgBillValue),
      lastAvgBill: Math.round(lastAvgBill),
      grossMarginPct: Math.round(grossMarginPct * 10) / 10,
      discountPct: Math.round(discountPct * 10) / 10,
      totalDiscounts,
      newCustomersThisMonth,
      returningCustomers,
      uniqueCustomersThisMonth,
      deadStockValue,
      deadStockCount: deadStock.length,
      deadStockTop5: deadStock.slice(0, 5),
      returnRate: Math.round(returnRate * 10) / 10,
      monthReturns,
      enquiryConversion: Math.round(enquiryConversion),
      monthEnquiries,
      convertedEnquiries,
      receivablesAging: aging,
    };

    return NextResponse.json({
      data: {
        todaySales: Number(todaySales._sum.grandTotal ?? 0) - todayRefundAmt,
        weekSales: Number(weekSales._sum.grandTotal ?? 0) - weekRefundAmt,
        monthSales: Number(monthSales._sum.grandTotal ?? 0) - monthRefundAmt,
        todayRefunds: todayRefundAmt,
        monthRefunds: monthRefundAmt,
        todayInvoiceCount,
        monthInvoiceCount,
        monthExpenses: Number(monthlyExpenses._sum.amount ?? 0),
        pendingPayables: Number(pendingPayables._sum.outstandingAmount ?? 0),
        pendingReceivables: Number(pendingReceivables._sum.outstandingAmount ?? 0),
        pendingReturns,
        pendingWriteOffs,
        openEnquiries,
        totalCustomers,
        totalProducts,
        lowStockList,
        topProductsList,
        recentInvoices,
        salesChart,
        businessHealth,
      },
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
