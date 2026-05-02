import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { formatValidationError } from "@/lib/validation";

const createAdvanceSchema = z.object({
  employeeId: z.string().min(1),
  amount: z.coerce.number().positive(),
  reason: z.string().optional().nullable(),
  date: z.string().optional(),
  paymentMethodId: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
});

// GET /api/advances?employeeId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const pending = searchParams.get("pending");

  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (pending === "true") where.deductedInMonth = null;

  const advances = await prisma.advancePayment.findMany({
    where,
    include: { employee: { select: { name: true } }, paymentMethod: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ data: advances });
}

// POST /api/advances
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createAdvanceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  const advance = await prisma.advancePayment.create({
    data: {
      employee: { connect: { id: parsed.data.employeeId } },
      amount: parsed.data.amount,
      reason: parsed.data.reason ?? null,
      date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      paymentMethod: parsed.data.paymentMethodId
        ? { connect: { id: parsed.data.paymentMethodId } }
        : undefined,
      reference: parsed.data.reference ?? null,
    },
  });

  return NextResponse.json({ data: advance }, { status: 201 });
}
