import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const updateExpenseSchema = z.object({
  date: z.string().optional(),
  categoryId: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  amount: z.coerce.number().positive().optional(),
  paymentMethodId: z.string().min(1).optional(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// PATCH /api/expenses/[id] — Edit expense
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
  const parsed = updateExpenseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  try {
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.date) {
      const d = new Date(parsed.data.date);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
      }
      data.date = d;
    }

    const expense = await prisma.expense.update({
      where: { id },
      data,
      include: { category: { select: { name: true } }, paymentMethod: { select: { name: true } } },
    });

    return NextResponse.json({ data: expense });
  } catch (err) {
    console.error("Expense update error:", err);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}

// DELETE /api/expenses/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  await prisma.expense.delete({ where: { id } });

  return NextResponse.json({ message: "Expense deleted" });
}
