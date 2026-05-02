import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/salary/preview — This week's payroll preview for all active employees
export async function GET() {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Calculate current week (Mon-Sat)
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset));
    const saturdayOffset = day === 0 ? -1 : 6 - day;
    const weekEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + saturdayOffset));

    const employees = await prisma.employee.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true, dailyWage: true, onCallRate: true },
      orderBy: { name: "asc" },
    });

    const preview = await Promise.all(employees.map(async (emp) => {
      // Get attendance for this week
      const attendance = await prisma.attendance.findMany({
        where: {
          employeeId: emp.id,
          date: { gte: weekStart, lte: weekEnd },
        },
      });

      const presentDays = attendance.filter((a) => a.status === "PRESENT").length;
      const halfDays = attendance.filter((a) => a.status === "HALF_DAY").length;
      const onCallDays = attendance.filter((a) => a.status === "ON_CALL").length;

      const dailyWage = Number(emp.dailyWage) || 0;
      const onCallRate = Number(emp.onCallRate) || 0;
      const earned = Math.round(dailyWage * (presentDays + halfDays * 0.5) + onCallDays * (onCallRate || dailyWage));

      // Get undeducted advances
      const advances = await prisma.advancePayment.findMany({
        where: { employeeId: emp.id, deductedInMonth: null },
        select: { amount: true },
      });
      const totalAdvances = advances.reduce((s, a) => s + Number(a.amount), 0);

      const netDue = Math.max(0, earned - totalAdvances);

      // Check if already settled
      const existingSettlement = await prisma.salaryRecord.findUnique({
        where: { employeeId_periodStart_periodEnd: { employeeId: emp.id, periodStart: weekStart, periodEnd: weekEnd } },
        select: { id: true, status: true, paidAmount: true },
      });

      return {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        dailyWage,
        presentDays,
        halfDays,
        onCallDays,
        earned,
        advances: totalAdvances,
        netDue,
        settled: !!existingSettlement,
        settlementStatus: existingSettlement?.status ?? null,
        paidAmount: existingSettlement ? Number(existingSettlement.paidAmount) : 0,
      };
    }));

    const totals = {
      totalEarned: preview.reduce((s, p) => s + p.earned, 0),
      totalAdvances: preview.reduce((s, p) => s + p.advances, 0),
      totalNetDue: preview.reduce((s, p) => s + p.netDue, 0),
      unsettledCount: preview.filter((p) => !p.settled).length,
    };

    return NextResponse.json({
      data: {
        weekStart: weekStart.toISOString().slice(0, 10),
        weekEnd: weekEnd.toISOString().slice(0, 10),
        employees: preview,
        totals,
      },
    });
  } catch (err) {
    console.error("Payroll preview error:", err);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
