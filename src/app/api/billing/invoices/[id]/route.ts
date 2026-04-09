import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/billing/invoices/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, sku: true, hsnCode: true },
          },
          batch: {
            select: { batchNumber: true, landedCostPerUnit: true },
          },
        },
      },
      payments: {
        include: { paymentMethod: { select: { name: true } } },
      },
      customer: { select: { id: true, name: true, phone: true } },
      vehicle: {
        include: {
          vehicleMake: { select: { name: true } },
          vehicleModel: { select: { name: true } },
        },
      },
      operator: { select: { name: true } },
      returns: {
        include: {
          processedBy: { select: { name: true } },
          items: {
            include: {
              product: { select: { name: true, sku: true } },
              reason: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json({ data: invoice });
}
