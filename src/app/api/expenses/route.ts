import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { formatValidationError } from "@/lib/validation";

const createExpenseSchema = z.object({
  date: z.string().optional(),
  categoryId: z.string().min(1),
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  paymentMethodId: z.string().min(1),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/expenses
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const where: Record<string, unknown> = {};
  if (categoryId && categoryId !== "all") where.categoryId = categoryId;
  if (from || to) {
    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    where.date = dateFilter;
  }

  const [expenses, total, summary] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        category: { select: { name: true } },
        paymentMethod: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({
      where,
      _sum: { amount: true },
    }),
  ]);

  return NextResponse.json({
    data: expenses,
    totalAmount: Number(summary._sum.amount ?? 0),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/expenses
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createExpenseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  const expense = await prisma.expense.create({
    data: {
      date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      category: { connect: { id: parsed.data.categoryId } },
      description: parsed.data.description,
      amount: parsed.data.amount,
      paymentMethod: { connect: { id: parsed.data.paymentMethodId } },
      reference: parsed.data.reference ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  return NextResponse.json({ data: expense }, { status: 201 });
}
