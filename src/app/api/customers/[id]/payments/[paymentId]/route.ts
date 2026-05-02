import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// DELETE /api/customers/[id]/payments/[paymentId] — Reverse a payment
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, paymentId } = await params;

  const payment = await prisma.customerPayment.findUnique({
    where: { id: paymentId },
    include: { invoice: true },
  });

  if (!payment || payment.customerId !== id) {
    return NextResponse.json({ error: "Payment not found for this customer" }, { status: 404 });
  }

  const amount = Number(payment.amount);

  try {
    if (payment.invoiceId && payment.invoice) {
      // Restore invoice outstanding
      const newPaid = Math.max(0, Number(payment.invoice.amountPaid) - amount);
      const newOutstanding = Number(payment.invoice.grandTotal) - newPaid;
      await prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          amountPaid: newPaid,
          outstandingAmount: Math.max(0, newOutstanding),
        },
      });
    } else {
      // Restore opening balance
      const customer = await prisma.customer.findUnique({ where: { id }, select: { openingBalance: true } });
      await prisma.customer.update({
        where: { id },
        data: { openingBalance: Number(customer?.openingBalance ?? 0) + amount },
      });
    }

    await prisma.customerPayment.delete({ where: { id: paymentId } });

    return NextResponse.json({ success: true, reversed: amount });
  } catch (err) {
    console.error("Payment reversal error:", err);
    return NextResponse.json({ error: "Failed to reverse payment" }, { status: 500 });
  }
}
