import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

// GET /api/estimates/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      customer: true,
      vehicle: {
        include: {
          vehicleMake: { select: { name: true } },
          vehicleModel: { select: { name: true } },
        },
      },
      operator: { select: { name: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
  });

  if (!estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  return NextResponse.json({ data: estimate });
}

// PATCH /api/estimates/[id] — Update status
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

  const statusSchema = z.object({
    status: z.enum(["DRAFT", "SENT", "CONVERTED", "EXPIRED", "CANCELLED"]),
  });

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid status", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const estimate = await prisma.estimate.findUnique({ where: { id } });
  if (!estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  // Validate status transitions
  const validTransitions: Record<string, string[]> = {
    DRAFT: ["SENT", "CANCELLED"],
    SENT: ["CONVERTED", "EXPIRED", "CANCELLED"],
  };

  const allowed = validTransitions[estimate.status] ?? [];
  if (!allowed.includes(parsed.data.status)) {
    return NextResponse.json(
      { error: `Cannot change status from ${estimate.status} to ${parsed.data.status}` },
      { status: 400 }
    );
  }

  const updated = await prisma.estimate.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ data: updated });
}
