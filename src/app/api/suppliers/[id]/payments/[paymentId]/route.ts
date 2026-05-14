import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";

// Group window: bulk-payment endpoint creates multiple SupplierPayment rows in quick succession
// sharing supplierId + paymentMethodId + reference. Use a ±5s createdAt window as the group key.
const GROUP_WINDOW_MS = 5000;

async function findGroup(paymentId: string) {
  const source = await prisma.supplierPayment.findUnique({ where: { id: paymentId } });
  if (!source) return null;
  const start = new Date(source.createdAt.getTime() - GROUP_WINDOW_MS);
  const end = new Date(source.createdAt.getTime() + GROUP_WINDOW_MS);
  const group = await prisma.supplierPayment.findMany({
    where: {
      supplierId: source.supplierId,
      paymentMethodId: source.paymentMethodId,
      reference: source.reference,
      createdAt: { gte: start, lte: end },
    },
  });
  return { source, group };
}

// DELETE — remove a payment group (the whole user-action). Reverses invoice paid/outstanding
// and refuses if any row is unsafe to remove.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden — Owner only" }, { status: 403 });
  }

  const { paymentId } = await params;
  const result = await findGroup(paymentId);
  if (!result) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  const { group } = result;

  // Safety checks
  for (const row of group) {
    if (row.isAdvanceApplication) {
      return NextResponse.json(
        { error: "Cannot delete an advance-application audit row directly. Reverse via the invoice or contact admin." },
        { status: 400 }
      );
    }
    if (row.isAdvance && Number(row.adjustedAmount) > 0) {
      return NextResponse.json(
        { error: `Cannot delete advance — Rs.${Number(row.adjustedAmount).toFixed(0)} of it has already been applied to invoices. Reverse those first.` },
        { status: 400 }
      );
    }
    if (row.reference?.startsWith("Return credit:")) {
      return NextResponse.json(
        { error: "Cannot delete return-credit payment directly. Cancel the supplier return instead." },
        { status: 400 }
      );
    }
  }

  // Build atomic reversal
  const ops: Prisma.PrismaPromise<unknown>[] = [];

  for (const row of group) {
    if (row.purchaseInvoiceId) {
      // Revert invoice amountPaid and outstandingAmount
      ops.push(
        prisma.purchaseInvoice.update({
          where: { id: row.purchaseInvoiceId },
          data: {
            amountPaid: { decrement: Number(row.amount) },
            outstandingAmount: { increment: Number(row.amount) },
            status: "FINALIZED", // re-open if it had become PAID
          },
        })
      );
    }
    ops.push(prisma.supplierPayment.delete({ where: { id: row.id } }));
  }

  await prisma.$transaction(ops);

  return NextResponse.json({ success: true, deletedCount: group.length, totalAmount: group.reduce((s, r) => s + Number(r.amount), 0) });
}

// PATCH — change payment method across the whole group (for "marked wrong method" fix)
const patchSchema = z.object({ paymentMethodId: z.string().min(1) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden — Owner only" }, { status: 403 });
  }

  const { paymentId } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const result = await findGroup(paymentId);
  if (!result) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  const { group } = result;

  // Verify the new method exists
  const newMethod = await prisma.masterData.findUnique({ where: { id: parsed.data.paymentMethodId } });
  if (!newMethod || newMethod.type !== "PAYMENT_METHOD") {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }

  await prisma.supplierPayment.updateMany({
    where: { id: { in: group.map((r) => r.id) } },
    data: { paymentMethodId: parsed.data.paymentMethodId },
  });

  return NextResponse.json({ success: true, updatedCount: group.length });
}
