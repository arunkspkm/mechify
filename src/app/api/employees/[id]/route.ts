import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { formatValidationError } from "@/lib/validation";

const updateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  role: z.string().min(1).optional(),
  wageType: z.enum(["DAILY", "MONTHLY"]).optional(),
  dailyWage: z.coerce.number().nonnegative().optional(),
  monthlySalary: z.coerce.number().nonnegative().optional(),
  onCallRate: z.coerce.number().nonnegative().optional(),
  joiningDate: z.string().optional(),
  exitDate: z.string().optional().nullable(),
  idProofType: z.string().optional().nullable(),
  idProofNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankIfsc: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

// GET /api/employees/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        advancePayments: {
          orderBy: { date: "desc" },
          take: 20,
        },
        salaryRecords: {
          orderBy: { periodStart: "desc" },
          take: 20,
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Get current week attendance (Mon-Sat) using UTC to match @db.Date
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monLocal = new Date(now);
    monLocal.setDate(now.getDate() + mondayOffset);
    const weekStart = new Date(Date.UTC(monLocal.getFullYear(), monLocal.getMonth(), monLocal.getDate()));
    const weekEnd = new Date(Date.UTC(monLocal.getFullYear(), monLocal.getMonth(), monLocal.getDate() + 5));

    const attendance = await prisma.attendance.findMany({
      where: {
        employeeId: id,
        date: { gte: weekStart, lte: weekEnd },
      },
      orderBy: { date: "asc" },
    });

    const attendanceSummary = {
      present: attendance.filter((a) => a.status === "PRESENT").length,
      absent: attendance.filter((a) => a.status === "ABSENT").length,
      halfDay: attendance.filter((a) => a.status === "HALF_DAY").length,
      onCall: attendance.filter((a) => a.status === "ON_CALL").length,
      leave: attendance.filter((a) => a.status === "LEAVE").length,
      holiday: attendance.filter((a) => a.status === "HOLIDAY").length,
    };

    // Get total undeducted advances
    const undeductedAdvances = await prisma.advancePayment.findMany({
      where: { employeeId: id, deductedInMonth: null },
    });
    const totalUndeductedAdvances = undeductedAdvances.reduce(
      (s, a) => s + Number(a.amount), 0
    );

    return NextResponse.json({
      data: {
        ...employee,
        currentWeekAttendance: attendance,
        attendanceSummary,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        totalUndeductedAdvances,
      },
    });
  } catch (err) {
    console.error("Employee detail error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}

// PATCH /api/employees/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateEmployeeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  const { joiningDate, exitDate, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (joiningDate !== undefined) data.joiningDate = new Date(joiningDate);
  if (exitDate !== undefined) data.exitDate = exitDate ? new Date(exitDate) : null;

  const employee = await prisma.employee.update({
    where: { id },
    data,
  });

  return NextResponse.json({ data: employee });
}
