import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateExcel } from "@/lib/excel-export";

// GET /api/reports/financial?from=&to=&format=json|excel
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
    // Revenue
    const salesAgg = await prisma.invoice.aggregate({
      where: { status: { not: "CANCELLED" }, ...(from || to ? { date: dateFilter } : {}) },
      _sum: { grandTotal: true, discountTotal: true, taxTotal: true },
      _count: true,
    });

    // Cost of goods sold (from invoice items' landed cost)
    const invoiceItems = await prisma.invoiceItem.findMany({
      where: {
        invoice: { status: { not: "CANCELLED" }, ...(from || to ? { date: dateFilter } : {}) },
      },
      select: { qty: true, landedCostPerUnit: true, lineTotal: true },
    });
    const cogs = invoiceItems.reduce((s, i) => s + Number(i.qty) * Number(i.landedCostPerUnit), 0);
    const grossRevenue = Number(salesAgg._sum.grandTotal ?? 0);

    // Customer return refunds
    const returnWhere: Record<string, unknown> = { status: "APPROVED" };
    if (from || to) {
      const retDateFilter: Record<string, unknown> = {};
      if (from) retDateFilter.gte = new Date(from);
      if (to) retDateFilter.lte = new Date(to + "T23:59:59");
      returnWhere.updatedAt = retDateFilter;
    }
    const returnAgg = await prisma.customerReturn.aggregate({
      where: returnWhere,
      _sum: { totalRefund: true },
      _count: true,
    });
    const totalRefunds = Number(returnAgg._sum.totalRefund ?? 0);
    const totalRevenue = grossRevenue - totalRefunds;

    // Expenses by category
    const expenseWhere: Record<string, unknown> = {};
    if (from || to) expenseWhere.date = dateFilter;

    const expenses = await prisma.expense.findMany({
      where: expenseWhere,
      include: { category: { select: { name: true } } },
      orderBy: { date: "desc" },
    });
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

    // Group expenses by category
    const expenseByCategory: Record<string, number> = {};
    for (const e of expenses) {
      expenseByCategory[e.category.name] = (expenseByCategory[e.category.name] ?? 0) + Number(e.amount);
    }

    // Salary payments in period
    const salaryWhere: Record<string, unknown> = { status: "PAID" };
    if (from || to) {
      const paidFilter: Record<string, unknown> = {};
      if (from) paidFilter.gte = new Date(from);
      if (to) paidFilter.lte = new Date(to + "T23:59:59");
      salaryWhere.paidDate = paidFilter;
    }
    const salaryAgg = await prisma.salaryRecord.aggregate({
      where: salaryWhere,
      _sum: { paidAmount: true },
    });
    const totalSalaries = Number(salaryAgg._sum.paidAmount ?? 0);

    // Supplier payments
    const supplierPayWhere: Record<string, unknown> = {};
    if (from || to) supplierPayWhere.date = dateFilter;
    const supplierPayAgg = await prisma.supplierPayment.aggregate({
      where: supplierPayWhere,
      _sum: { amount: true },
    });
    const totalSupplierPayments = Number(supplierPayAgg._sum.amount ?? 0);

    // Customer collections
    const customerPayWhere: Record<string, unknown> = {};
    if (from || to) customerPayWhere.date = dateFilter;
    const customerPayAgg = await prisma.customerPayment.aggregate({
      where: customerPayWhere,
      _sum: { amount: true },
    });
    const totalCustomerCollections = Number(customerPayAgg._sum.amount ?? 0);

    const grossProfit = totalRevenue - cogs;
    const netProfit = grossProfit - totalExpenses - totalSalaries;

    const expenseCategoryList = Object.entries(expenseByCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    if (format === "excel") {
      const rows = [
        { "Item": "Gross Revenue (Sales)", "Amount": grossRevenue.toFixed(2) },
        { "Item": "Customer Return Refunds", "Amount": (-totalRefunds).toFixed(2) },
        { "Item": "Net Revenue", "Amount": totalRevenue.toFixed(2) },
        { "Item": "Cost of Goods Sold", "Amount": (-cogs).toFixed(2) },
        { "Item": "Gross Profit", "Amount": grossProfit.toFixed(2) },
        { "Item": "", "Amount": "" },
        ...expenseCategoryList.map((e) => ({ "Item": `Expense: ${e.category}`, "Amount": (-e.amount).toFixed(2) })),
        { "Item": "Total Expenses", "Amount": (-totalExpenses).toFixed(2) },
        { "Item": "Staff Salaries", "Amount": (-totalSalaries).toFixed(2) },
        { "Item": "", "Amount": "" },
        { "Item": "Net Profit", "Amount": netProfit.toFixed(2) },
        { "Item": "", "Amount": "" },
        { "Item": "Supplier Payments (Cash Out)", "Amount": totalSupplierPayments.toFixed(2) },
        { "Item": "Customer Collections (Cash In)", "Amount": totalCustomerCollections.toFixed(2) },
      ];
      const buffer = generateExcel(rows, "P&L Report");
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="financial_report_${from ?? "all"}_${to ?? "all"}.xlsx"`,
        },
      });
    }

    return NextResponse.json({
      data: {
        grossRevenue,
        totalRefunds,
        returnCount: returnAgg._count,
        revenue: totalRevenue,
        cogs,
        grossProfit,
        totalExpenses,
        totalSalaries,
        netProfit,
        discountTotal: Number(salesAgg._sum.discountTotal ?? 0),
        taxTotal: Number(salesAgg._sum.taxTotal ?? 0),
        invoiceCount: salesAgg._count,
        expenseByCategory: expenseCategoryList,
        cashFlow: {
          supplierPayments: totalSupplierPayments,
          customerCollections: totalCustomerCollections,
        },
      },
    });
  } catch (err) {
    console.error("Financial report error:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
