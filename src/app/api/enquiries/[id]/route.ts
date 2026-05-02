import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const statusTransitions: Record<string, string[]> = {
  ENQUIRY_RECORDED: ["CONFIRMED", "ORDER_PLACED", "CANCELLED"],
  CONFIRMED: ["ORDER_PLACED", "CANCELLED"],
  ORDER_PLACED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["RECEIVED", "CANCELLED"],
  RECEIVED: ["CUSTOMER_NOTIFIED"],
  CUSTOMER_NOTIFIED: ["DELIVERED", "CANCELLED"],
};

const updateSchema = z.object({
  status: z.enum([
    "ENQUIRY_RECORDED", "CONFIRMED", "ORDER_PLACED", "IN_TRANSIT",
    "RECEIVED", "CUSTOMER_NOTIFIED", "DELIVERED", "CANCELLED",
  ]).optional(),
  notes: z.string().optional().nullable(),
  cancelledReason: z.string().optional().nullable(),
  advanceAmount: z.coerce.number().nonnegative().optional(),
  advanceMethodId: z.string().optional().nullable(),
  advanceReference: z.string().optional().nullable(),
  purchaseOrderId: z.string().optional().nullable(),
  invoiceId: z.string().optional().nullable(),
});

// GET /api/enquiries/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const enquiry = await prisma.customerEnquiry.findUnique({
    where: { id },
    include: {
      operator: { select: { name: true } },
      customer: { select: { name: true, phone: true } },
      notesLog: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!enquiry) {
    return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
  }

  return NextResponse.json({ data: enquiry });
}

// PATCH /api/enquiries/[id] — Update status or notes
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const enquiry = await prisma.customerEnquiry.findUnique({ where: { id } });
  if (!enquiry) {
    return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (parsed.data.status) {
    const allowed = statusTransitions[enquiry.status] ?? [];
    if (!allowed.includes(parsed.data.status)) {
      return NextResponse.json(
        { error: `Cannot change from ${enquiry.status} to ${parsed.data.status}` },
        { status: 400 }
      );
    }
    updateData.status = parsed.data.status;

    // Set timestamps and status-specific data
    if (parsed.data.status === "CONFIRMED") {
      if (parsed.data.advanceAmount != null) updateData.advanceAmount = parsed.data.advanceAmount;
      if (parsed.data.advanceMethodId) updateData.advanceMethodId = parsed.data.advanceMethodId;
      if (parsed.data.advanceReference !== undefined) updateData.advanceReference = parsed.data.advanceReference || null;
    }
    if (parsed.data.status === "ORDER_PLACED" && parsed.data.purchaseOrderId) {
      updateData.purchaseOrderId = parsed.data.purchaseOrderId;
    }
    if (parsed.data.status === "CUSTOMER_NOTIFIED") {
      updateData.notifiedAt = new Date();
    }
    if (parsed.data.status === "DELIVERED") {
      updateData.deliveredAt = new Date();
      if (parsed.data.invoiceId) updateData.invoiceId = parsed.data.invoiceId;
    }
    if (parsed.data.status === "CANCELLED") {
      updateData.cancelledReason = parsed.data.cancelledReason || null;
    }
  }

  if (parsed.data.notes !== undefined) {
    updateData.notes = parsed.data.notes;
  }

  const updated = await prisma.customerEnquiry.update({
    where: { id },
    data: updateData,
    include: {
      operator: { select: { name: true } },
      customer: { select: { name: true, phone: true } },
    },
  });

  return NextResponse.json({ data: updated });
}
