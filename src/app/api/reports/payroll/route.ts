import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateExcel } from "@/lib/excel-export";

// GET /api/reports/payroll?from=&to=&format=json|excel
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format") ?? "json";

  try {
    const where: Record<string, unknown> = {};
    if (from || to) {
      // Include settlements that overlap with the date range
      // A settlement overlaps if periodEnd >= from AND periodStart <= to
      if (from) {
        const [y, m, d] = from.split("-").map(Number);
        where.periodEnd = { gte: new Date(Date.UTC(y, m - 1, d)) };
      }
      if (to) {
        const [y, m, d] = to.split("-").map(Number);
        where.periodStart = { lte: new Date(Date.UTC(y, m - 1, d)) };
      }
    }

    const records = await prisma.salaryRecord.findMany({
      where,
      include: { employee: { select: { name: true, role: true, dailyWage: true } } },
      orderBy: { periodStart: "desc" },
    });

    const totalBaseSalary = records.reduce((s, r) => s + Number(r.baseSalary), 0);
    const totalOnCall = records.reduce((s, r) => s + Number(r.onCallAmount), 0);
    const totalAdvances = records.reduce((s, r) => s + Number(r.totalAdvances), 0);
    const totalNetPayable = records.reduce((s, r) => s + Number(r.netPayable), 0);
    const totalPaid = records.reduce((s, r) => s + Number(r.paidAmount), 0);

    // Get pending advances
    const pendingAdvances = await prisma.advancePayment.findMany({
      where: { deductedInMonth: null },
      include: { employee: { select: { name: true } } },
      orderBy: { date: "desc" },
    });
    const totalPendingAdvances = pendingAdvances.reduce((s, a) => s + Number(a.amount), 0);

    if (format === "excel") {
      const rows = records.map((r) => ({
        "Employee": r.employee.name,
        "Role": r.employee.role,
        "Period": `${new Date(r.periodStart).toLocaleDateString("en-IN")} - ${new Date(r.periodEnd).toLocaleDateString("en-IN")}`,
        "Present Days": r.presentDays,
        "Half Days": r.halfDays,
        "On-Call Days": r.onCallDays,
        "Daily Wage": Number(r.dailyWage).toFixed(0),
        "Base Salary": Number(r.baseSalary).toFixed(2),
        "On-Call Amount": Number(r.onCallAmount).toFixed(2),
        "Advances Deducted": Number(r.totalAdvances).toFixed(2),
        "Bonus": Number(r.bonus).toFixed(2),
        "Deductions": Number(r.deductions).toFixed(2),
        "Net Payable": Number(r.netPayable).toFixed(2),
        "Paid": Number(r.paidAmount).toFixed(2),
        "Status": r.status,
      }));
      const buffer = generateExcel(rows, "Payroll Report");
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="payroll_report.xlsx"`,
        },
      });
    }

    return NextResponse.json({
      data: {
        summary: { totalBaseSalary, totalOnCall, totalAdvances, totalNetPayable, totalPaid, totalPendingAdvances, recordCount: records.length },
        records,
        pendingAdvances,
      },
    });
  } catch (err) {
    console.error("Payroll report error:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
