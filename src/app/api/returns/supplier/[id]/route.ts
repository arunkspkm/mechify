import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// PATCH /api/returns/supplier/[id] — Update status
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
  const action = body.action as string;

  const ret = await prisma.supplierReturn.findUnique({ where: { id } });
  if (!ret) {
    return NextResponse.json({ error: "Return not found" }, { status: 404 });
  }

  const transitions: Record<string, string[]> = {
    INITIATED: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["CREDIT_RECEIVED", "CANCELLED"],
  };

  if (action === "updateStatus") {
    const newStatus = body.status as string;
    const allowed = transitions[ret.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json({ error: `Cannot change from ${ret.status} to ${newStatus}` }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { status: newStatus };

    if (newStatus === "CREDIT_RECEIVED") {
      const creditAmount = body.creditAmount ? Number(body.creditAmount) : Number(ret.totalAmount);
      updateData.creditReceived = creditAmount;

      // Record as a supplier payment (credit/adjustment)
      // Find a payment method for the credit
      const creditMethod = await prisma.masterData.findFirst({
        where: { type: "PAYMENT_METHOD", name: { contains: "Credit", mode: "insensitive" } },
      }) ?? await prisma.masterData.findFirst({
        where: { type: "PAYMENT_METHOD" },
      });

      if (creditMethod) {
        await prisma.supplierPayment.create({
          data: {
            supplierId: ret.supplierId,
            amount: creditAmount,
            paymentMethod: { connect: { id: creditMethod.id } },
            reference: `Return credit: ${ret.returnNumber}`,
            notes: `Credit from supplier return ${ret.returnNumber}`,
          },
        });
      }

      // Update outstanding on any open purchase invoices from this supplier
      // Apply credit to the oldest outstanding invoice first
      let remainingCredit = creditAmount;
      const openInvoices = await prisma.purchaseInvoice.findMany({
        where: { supplierId: ret.supplierId, outstandingAmount: { gt: 0 }, status: { not: "CANCELLED" } },
        orderBy: { invoiceDate: "asc" },
      });

      for (const inv of openInvoices) {
        if (remainingCredit <= 0) break;
        const outstanding = Number(inv.outstandingAmount);
        const applyAmount = Math.min(remainingCredit, outstanding);

        await prisma.purchaseInvoice.update({
          where: { id: inv.id },
          data: {
            amountPaid: { increment: applyAmount },
            outstandingAmount: { decrement: applyAmount },
            status: outstanding - applyAmount <= 0 ? "PAID" : "PARTIALLY_PAID",
          },
        });

        remainingCredit -= applyAmount;
      }
    }

    if (newStatus === "CANCELLED") {
      // Restock the items
      const items = await prisma.supplierReturnItem.findMany({ where: { returnId: id } });
      for (const item of items) {
        await prisma.batch.update({
          where: { id: item.batchId },
          data: { qtyRemaining: { increment: Number(item.qty) } },
        });
      }
    }

    await prisma.supplierReturn.update({ where: { id }, data: updateData });
    return NextResponse.json({ message: `Status updated to ${newStatus}` });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
