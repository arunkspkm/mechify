import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { formatValidationError } from "@/lib/validation";

const markAttendanceSchema = z.object({
  entries: z.array(z.object({
    employeeId: z.string().min(1),
    date: z.string().min(1),
    status: z.enum(["PRESENT", "ABSENT", "HALF_DAY", "ON_CALL", "LEAVE"]),
    notes: z.string().optional().nullable(),
  })).min(1),
});

// GET /api/attendance?month=4&year=2026&employeeId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const employeeId = searchParams.get("employeeId");

  // Use UTC dates to avoid timezone issues with @db.Date fields
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));

  const where: Record<string, unknown> = {
    date: { gte: startDate, lte: endDate },
  };
  if (employeeId) where.employeeId = employeeId;

  try {
    const [attendance, employees] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: { employee: { select: { name: true, role: true } } },
        orderBy: { date: "asc" },
      }),
      prisma.employee.findMany({
        where: { active: true },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({ data: attendance, employees });
  } catch (err) {
    console.error("Attendance GET error:", err);
    return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }
}

// POST /api/attendance — Bulk mark/update attendance
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = markAttendanceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  let upserted = 0;
  for (const entry of parsed.data.entries) {
    // Parse as UTC to avoid timezone shift on @db.Date fields
    const [y, m, d] = entry.date.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    await prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId: entry.employeeId,
          date: dateObj,
        },
      },
      create: {
        employee: { connect: { id: entry.employeeId } },
        date: dateObj,
        status: entry.status,
        notes: entry.notes ?? null,
      },
      update: {
        status: entry.status,
        notes: entry.notes ?? null,
      },
    });
    upserted++;
  }

  return NextResponse.json({ message: `${upserted} attendance records saved` });
}
