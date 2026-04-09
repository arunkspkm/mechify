import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const paySalarySchema = z.object({
  action: z.literal("pay"),
  amount: z.coerce.number().positive(),
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
