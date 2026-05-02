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

    // Get undeducted advances (oldest first)
    const advances = await prisma.advancePayment.findMany({
      where: { employeeId, deductedInMonth: null },
      orderBy: { date: "asc" },
    });

    // Recoverable this week = earnings + bonus - other deductions (bounded)
    const earnings = baseSalary + onCallAmount + bonus - deductions;
    const recoverable = Math.max(0, earnings);

    // Apply advances up to recoverable amount; split the last one if partially consumed
    const month = periodEnd.getMonth() + 1;
    const year = periodEnd.getFullYear();
    let remainingToDeduct = recoverable;
    let actualAdvancesDeducted = 0;
    const consumedAdvanceIds: string[] = [];

    for (const adv of advances) {
      if (remainingToDeduct <= 0) break;
      const advAmount = Number(adv.amount);
      if (advAmount <= remainingToDeduct) {
        // Fully deduct this advance
        await prisma.advancePayment.update({
          where: { id: adv.id },
          data: { deductedInMonth: month, deductedInYear: year },
        });
        consumedAdvanceIds.push(adv.id);
        actualAdvancesDeducted += advAmount;
        remainingToDeduct -= advAmount;
      } else {
        // Partial deduction: split into two records
        const deductedPart = remainingToDeduct;
        const remainingPart = advAmount - deductedPart;
        const origDateStr = new Date(adv.date).toISOString().slice(0, 10);
        // Mark original as the deducted portion
        await prisma.advancePayment.update({
          where: { id: adv.id },
          data: { amount: deductedPart, deductedInMonth: month, deductedInYear: year },
        });
        consumedAdvanceIds.push(adv.id);
        // Create a new advance for the remaining portion (carries forward to next week)
        const carryReason = `Carry-forward Rs.${remainingPart} from Rs.${advAmount} advance on ${origDateStr}${adv.reason ? ` — ${adv.reason}` : ""}`;
        await prisma.advancePayment.create({
          data: {
            employee: { connect: { id: employeeId } },
            amount: remainingPart,
            reason: carryReason,
            date: adv.date,
            paymentMethod: adv.paymentMethodId ? { connect: { id: adv.paymentMethodId } } : undefined,
            reference: adv.reference,
          },
        });
        actualAdvancesDeducted += deductedPart;
        remainingToDeduct = 0;
      }
    }

    const netPayable = Math.max(0, Math.round(earnings - actualAdvancesDeducted));

    // If netPayable is 0 (fully offset by advance), mark as PAID immediately — no cash changes hands
    const status = netPayable === 0 ? "PAID" : "PENDING";

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
        totalAdvances: actualAdvancesDeducted,
        bonus,
        deductions,
        netPayable,
        status,
        paidDate: netPayable === 0 ? new Date() : null,
        notes: notes ?? null,
      },
    });

    // Stamp the settlement ID on the advances we just consumed, so reverse can find them precisely
    if (consumedAdvanceIds.length > 0) {
      await prisma.advancePayment.updateMany({
        where: { id: { in: consumedAdvanceIds } },
        data: { deductedInSalaryRecordId: record.id },
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
