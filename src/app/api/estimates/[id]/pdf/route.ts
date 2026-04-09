import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateEstimatePDF } from "@/lib/pdf-generator";

// GET /api/estimates/[id]/pdf
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
    const estimate = await prisma.estimate.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { name: true, sku: true } } } },
        customer: { select: { name: true, phone: true } },
        operator: { select: { name: true } },
      },
    });

    if (!estimate) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    const config = await prisma.businessConfig.findUnique({ where: { id: "default" } });

    const pdf = generateEstimatePDF(
      {
        shopName: config?.shopName ?? "Mechify",
        shopAddress: config?.shopAddress,
        shopPhone: config?.shopPhone,
      },
      {
        estimateNumber: estimate.estimateNumber,
        date: estimate.date.toISOString(),
        validUntil: estimate.validUntil.toISOString(),
        customer: estimate.customer,
        customerName: estimate.customerName,
        customerPhone: estimate.customerPhone,
        items: estimate.items.map((i) => ({
          name: i.isCustomItem ? (i.customItemName ?? "Custom Item") : (i.product?.name ?? "Unknown"),
          qty: Number(i.qty),
          unitPrice: Number(i.unitPrice),
          discount: Number(i.discountAmount),
          installCharge: Number(i.installationCharge),
          tax: Number(i.cgstAmount) + Number(i.sgstAmount),
          total: Number(i.lineTotal),
        })),
        subtotal: Number(estimate.subtotal),
        discountTotal: Number(estimate.discountTotal),
        taxTotal: Number(estimate.taxTotal),
        grandTotal: Number(estimate.grandTotal),
        gstEnabled: estimate.gstEnabled,
        notes: estimate.notes,
        operator: estimate.operator.name,
      }
    );

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${estimate.estimateNumber}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Estimate PDF error:", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
