import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const updateAdvanceSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: z.string().optional().nullable(),
  paymentMethodId: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
});

// PATCH /api/advances/[id] — Edit advance (only if not yet deducted)
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
  const parsed = updateAdvanceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const advance = await prisma.advancePayment.findUnique({ where: { id } });
  if (!advance) {
    return NextResponse.json({ error: "Advance not found" }, { status: 404 });
  }

  if (advance.deductedInMonth !== null) {
    return NextResponse.json({ error: "Cannot edit — this advance has already been deducted from salary" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.amount !== undefined) data.amount = parsed.data.amount;
  if (parsed.data.reason !== undefined) data.reason = parsed.data.reason;
  if (parsed.data.reference !== undefined) data.reference = parsed.data.reference;
  if (parsed.data.paymentMethodId !== undefined) {
    data.paymentMethodId = parsed.data.paymentMethodId;
  }

  const updated = await prisma.advancePayment.update({
    where: { id },
    data,
    include: { paymentMethod: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ data: updated });
}

// DELETE /api/advances/[id] — Delete advance (only if not yet deducted)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const advance = await prisma.advancePayment.findUnique({ where: { id } });
  if (!advance) {
    return NextResponse.json({ error: "Advance not found" }, { status: 404 });
  }

  if (advance.deductedInMonth !== null) {
    return NextResponse.json({ error: "Cannot delete — this advance has already been deducted from salary" }, { status: 400 });
  }

  await prisma.advancePayment.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
