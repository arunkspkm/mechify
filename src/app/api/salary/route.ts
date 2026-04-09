import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const settleWeekSchema = z.object({
  employeeId: z.string().min(1),
  weekStart: z.string().min(1), // YYYY-MM-DD (Monday)
  weekEnd: z.string().min(1),   // YYYY-MM-DD (Saturday)
  bonus: z.coerce.number().nonnegative().default(0),
  deductions: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
});

// Helper: get previous Saturday (for default week end)
function getLastSaturday(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? 1 : day + 1; // days since last Saturday
  // If today is Saturday (6), diff = 0 but we want current Saturday
  const sat = new Date(now);
  sat.setDate(now.getDate() - (day === 6 ? 0 : diff));
  sat.setHours(0, 0, 0, 0);
  return sat;
}

// GET /api/salary — List salary records
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (from || to) {
    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    where.periodStart = dateFilter;
  }

  try {
    const records = await prisma.salaryRecord.findMany({
      where,
      include: { employee: { select: { name: true, role: true, dailyWage: true } } },
      orderBy: { periodStart: "desc" },
      take: 50,
    });

    return NextResponse.json({ data: records });
  } catch (err) {
    console.error("Salary GET error:", err);
    return NextResponse.json({ error: "Failed to fetch salary records" }, { status: 500 });
  }
}

// POST /api/salary — Settle a week for an employee
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = settleWeekSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { employeeId, weekStart, weekEnd, bonus, deductions, notes } = parsed.data;
  // Parse as UTC to match @db.Date fields
  const [sy, sm, sd] = weekStart.split("-").map(Number);
  const [ey, em, ed] = weekEnd.split("-").map(Number);
  const periodStart = new Date(Date.UTC(sy, sm - 1, sd));
  const periodEnd = new Date(Date.UTC(ey, em - 1, ed));

  try {
    // Check if already exists
    const existing = await prisma.salaryRecord.findUnique({
      where: {
        employeeId_periodStart_periodEnd: { employeeId, periodStart, periodEnd },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Settlement already exists for this week" },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Get attendance for the week
    const attendance = await prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: periodStart, lte: periodEnd },
      },
    });

    const presentDays = attendance.filter((a) => a.status === "PRESENT").length;
    const halfDays = attendance.filter((a) => a.status === "HALF_DAY").length;
    const onCallDays = attendance.filter((a) => a.status === "ON_CALL").length;

    const dailyWage = Number(employee.dailyWage) || 0;
    const onCallRate = Number(employee.onCallRate) || 0;
    const baseSalary = Math.round(dailyWage * (presentDays + halfDays * 0.5));
    const onCallAmount = Math.round(onCallDays * (onCallRate || dailyWage));

    // Get undeducted advances
    const advances = await prisma.advancePayment.findMany({
      where: { employeeId, deductedInMonth: null },
    });
    const totalAdvances = advances.reduce((s, a) => s + Number(a.amount), 0);

    const netPayable = Math.max(0, Math.round(baseSalary + onCallAmount + bonus - totalAdvances - deductions));

    const record = await prisma.salaryRecord.create({
      data: {
        employee: { connect: { id: employeeId } },
        periodType: "WEEKLY",
        periodStart,
        periodEnd,
        dailyWage,
        presentDays,
        halfDays,
        onCallDays,
        onCallAmount,
        baseSalary,
        totalAdvances,
        bonus,
        deductions,
        netPayable,
        notes: notes ?? null,
      },
    });

    // Mark advances as deducted (store period info in the month/year fields)
    const month = periodEnd.getMonth() + 1;
    const year = periodEnd.getFullYear();
    for (const adv of advances) {
      await prisma.advancePayment.update({
        where: { id: adv.id },
        data: { deductedInMonth: month, deductedInYear: year },
      });
    }

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err) {
    console.error("Salary settle error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Settlement already exists for this week" }, { status: 400 });
    }
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
