import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const paymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  paymentMethodId: z.string().min(1, "Payment method is required"),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// POST /api/customers/[id]/payments — Collect payment against a credit invoice
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = paymentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { invoiceId, amount, paymentMethodId, reference, notes } = parsed.data;

  // Verify invoice belongs to this customer and has outstanding
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice || invoice.customerId !== id) {
    return NextResponse.json({ error: "Invoice not found for this customer" }, { status: 404 });
  }

  const outstanding = Number(invoice.outstandingAmount);
  if (outstanding <= 0) {
    return NextResponse.json({ error: "This invoice is already fully paid" }, { status: 400 });
  }

  if (amount > outstanding) {
    return NextResponse.json(
      { error: `Amount Rs.${amount} exceeds outstanding Rs.${outstanding.toFixed(2)}` },
      { status: 400 }
    );
  }

  try {
    // Create payment record
    await prisma.customerPayment.create({
      data: {
        customer: { connect: { id } },
        invoice: { connect: { id: invoiceId } },
        amount,
        paymentMethod: { connect: { id: paymentMethodId } },
        receivedBy: { connect: { id: session.user.id } },
        reference: reference ?? null,
        notes: notes ?? null,
      },
    });

    // Update invoice
    const newPaid = Number(invoice.amountPaid) + amount;
    const newOutstanding = Number(invoice.grandTotal) - newPaid;

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newPaid,
        outstandingAmount: Math.max(newOutstanding, 0),
      },
    });

    // Update customer outstanding balance (clamp to 0 minimum)
    const customer = await prisma.customer.findUnique({ where: { id }, select: { outstandingBalance: true } });
    const newCustBalance = Math.max(0, Number(customer?.outstandingBalance ?? 0) - amount);
    await prisma.customer.update({
      where: { id },
      data: { outstandingBalance: newCustBalance },
    });

    return NextResponse.json({
      data: {
        message: "Payment collected",
        invoiceNumber: invoice.invoiceNumber,
        amountCollected: amount,
        remainingOnInvoice: Math.max(newOutstanding, 0),
      },
    }, { status: 201 });
  } catch (err) {
    console.error("Payment collection error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
