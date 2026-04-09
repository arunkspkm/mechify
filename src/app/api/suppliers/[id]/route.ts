import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { formatValidationError } from "@/lib/validation";

const updateSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  qualityRating: z.coerce.number().min(1).max(5).optional(),
  paymentTerms: z.string().optional().nullable(),
  creditPeriodDays: z.coerce.number().nonnegative().optional().nullable(),
  active: z.boolean().optional(),
});

// GET /api/suppliers/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseInvoices: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            invoiceNumber: true,
            grandTotal: true,
            outstandingAmount: true,
            status: true,
            invoiceDate: true,
          },
        },
        supplierReturns: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            returnNumber: true,
            totalAmount: true,
            creditReceived: true,
            status: true,
            createdAt: true,
          },
        },
        _count: {
          select: { batches: true, purchaseInvoices: true, purchaseOrders: true, supplierReturns: true },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Compute actual outstanding from all purchase invoices
    const allInvoices = await prisma.purchaseInvoice.findMany({
      where: { supplierId: id, status: { not: "CANCELLED" } },
      select: { outstandingAmount: true },
    });
    const computedOutstanding = allInvoices.reduce(
      (sum, pi) => sum + Number(pi.outstandingAmount), 0
    );

    // Get advance payment summary
    const advances = await prisma.supplierPayment.findMany({
      where: { supplierId: id, isAdvance: true },
      include: { paymentMethod: { select: { name: true } } },
      orderBy: { date: "desc" },
    });
    const totalAdvance = advances.reduce((s, a) => s + Number(a.amount), 0);
    const totalAdjusted = advances.reduce((s, a) => s + Number(a.adjustedAmount), 0);
    const pendingAdvance = totalAdvance - totalAdjusted;

    return NextResponse.json({
      data: {
        ...supplier,
        outstandingBalance: computedOutstanding,
        advances,
        advanceSummary: { totalAdvance, totalAdjusted, pendingAdvance },
      },
    });
  } catch (err) {
    console.error("Supplier detail error:", err);
    return NextResponse.json({ error: "Failed to fetch supplier details" }, { status: 500 });
  }
}

// PATCH /api/suppliers/[id]
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
  const parsed = updateSupplierSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const supplier = await prisma.supplier.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ data: supplier });
  } catch (err) {
    console.error("Supplier update error:", err);
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 });
  }
}
