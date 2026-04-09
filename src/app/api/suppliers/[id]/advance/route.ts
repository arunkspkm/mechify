import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { formatValidationError } from "@/lib/validation";

const advanceSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  paymentMethodId: z.string().min(1, "Payment method is required"),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  date: z.string().optional(),
});

// GET /api/suppliers/[id]/advance — List advances for a supplier
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const advances = await prisma.supplierPayment.findMany({
      where: { supplierId: id, isAdvance: true },
      include: { paymentMethod: { select: { name: true } } },
      orderBy: { date: "desc" },
    });

    const totalAdvance = advances.reduce((s, a) => s + Number(a.amount), 0);
    const totalAdjusted = advances.reduce((s, a) => s + Number(a.adjustedAmount), 0);
    const pendingAdvance = totalAdvance - totalAdjusted;

    return NextResponse.json({
      data: advances,
      summary: { totalAdvance, totalAdjusted, pendingAdvance },
    });
  } catch (err) {
    console.error("Supplier advance GET error:", err);
    return NextResponse.json({ error: "Failed to fetch advances" }, { status: 500 });
  }
}

// POST /api/suppliers/[id]/advance — Record an advance payment
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = advanceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    const advance = await prisma.supplierPayment.create({
      data: {
        supplierId: id,
        amount: parsed.data.amount,
        paymentMethod: { connect: { id: parsed.data.paymentMethodId } },
        reference: parsed.data.reference ?? null,
        notes: parsed.data.notes ?? null,
        isAdvance: true,
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      },
      include: { paymentMethod: { select: { name: true } } },
    });

    return NextResponse.json({ data: advance }, { status: 201 });
  } catch (err) {
    console.error("Supplier advance POST error:", err);
    return NextResponse.json({ error: "Failed to record advance" }, { status: 500 });
  }
}
