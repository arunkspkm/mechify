import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { formatValidationError } from "@/lib/validation";

const createEmployeeSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  role: z.string().min(1),
  wageType: z.enum(["DAILY", "MONTHLY"]).default("DAILY"),
  dailyWage: z.coerce.number().nonnegative().default(0),
  monthlySalary: z.coerce.number().nonnegative().default(0),
  onCallRate: z.coerce.number().nonnegative().default(0),
  joiningDate: z.string().optional(),
  idProofType: z.string().optional().nullable(),
  idProofNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankIfsc: z.string().optional().nullable(),
});

// GET /api/employees
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const active = searchParams.get("active");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (active !== null) where.active = active !== "false";
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { role: { contains: search, mode: "insensitive" } },
    ];
  }

  const employees = await prisma.employee.findMany({
    where,
    include: {
      _count: { select: { attendance: true, advancePayments: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: employees });
}

// POST /api/employees
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createEmployeeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  const { joiningDate, ...rest } = parsed.data;

  try {
    const employee = await prisma.employee.create({
      data: {
        ...rest,
        joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      },
    });

    return NextResponse.json({ data: employee }, { status: 201 });
  } catch (err) {
    console.error("Employee create error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "An employee with this phone number already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
