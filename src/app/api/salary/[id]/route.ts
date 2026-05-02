import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const paySalarySchema = z.object({
  action: z.literal("pay"),
  amount: z.coerce.number().positive(),
  paymentMethodId: z.string().optional().nullable(),
  paymentReference: z.string().optional().nullable(),
});

// PATCH /api/salary/[id] — Pay salary (partial, full, or overpay)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = paySalarySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const record = await prisma.salaryRecord.findUnique({ where: { id } });
    if (!record) {
      return NextResponse.json({ error: "Salary record not found" }, { status: 404 });
    }

    const net = Number(record.netPayable);
    const alreadyPaid = Number(record.paidAmount);
    const remaining = net - alreadyPaid;
    const payAmount = parsed.data.amount;
    const newPaid = alreadyPaid + payAmount;

    let overpayAdvanceId: string | null = null;

    // If overpaying, create an advance for the excess
    if (newPaid > net) {
      const excess = newPaid - net;
      const advance = await prisma.advancePayment.create({
        data: {
          employee: { connect: { id: record.employeeId } },
          amount: excess,
          reason: `Overpayment from week settlement (paid Rs.${payAmount}, due Rs.${remaining > 0 ? remaining : 0})`,
        },
      });
      overpayAdvanceId = advance.id;
    }

    const status = newPaid >= net ? "PAID" : "PARTIALLY_PAID";

    const updated = await prisma.salaryRecord.update({
      where: { id },
      data: {
        paidAmount: Math.min(newPaid, net), // cap at net for record keeping
        status,
        paidDate: new Date(),
        paymentMethodId: parsed.data.paymentMethodId ?? undefined,
        paymentReference: parsed.data.paymentReference ?? undefined,
      },
    });

    return NextResponse.json({
      data: updated,
      ...(overpayAdvanceId ? {
        overpay: {
          excess: newPaid - net,
          advanceId: overpayAdvanceId,
          message: `Rs.${(newPaid - net).toFixed(0)} excess recorded as advance for next settlement`,
        },
      } : {}),
    });
  } catch (err) {
    console.error("Pay salary error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}

// DELETE /api/salary/[id] — Reverse a settlement (un-mark advances, delete the record)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const record = await prisma.salaryRecord.findUnique({ where: { id } });
    if (!record) {
      return NextResponse.json({ error: "Salary record not found" }, { status: 404 });
    }

    if (Number(record.paidAmount) > 0) {
      return NextResponse.json(
        { error: `Cannot delete — Rs.${Number(record.paidAmount).toFixed(0)} has already been paid. Reverse the payment first.` },
        { status: 400 }
      );
    }

    // Un-mark only the advances stamped to THIS settlement (per-week attribution).
    const result = await prisma.advancePayment.updateMany({
      where: { deductedInSalaryRecordId: id },
      data: { deductedInMonth: null, deductedInYear: null, deductedInSalaryRecordId: null },
    });

    // Legacy fallback: pre-attribution settlements have no salaryRecordId stamp.
    // For those, fall back to the original month+year filter (this preserves the legacy
    // bug for old data — only relevant if reversing a settlement created before v0.13.0).
    if (result.count === 0) {
      const month = new Date(record.periodEnd).getMonth() + 1;
      const year = new Date(record.periodEnd).getFullYear();
      await prisma.advancePayment.updateMany({
        where: {
          employeeId: record.employeeId,
          deductedInMonth: month,
          deductedInYear: year,
          deductedInSalaryRecordId: null,
        },
        data: { deductedInMonth: null, deductedInYear: null },
      });
    }

    // Delete the salary record
    await prisma.salaryRecord.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete salary error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
