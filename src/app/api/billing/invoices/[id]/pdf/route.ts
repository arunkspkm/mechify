import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateInvoicePDF } from "@/lib/pdf-generator";

// GET /api/billing/invoices/[id]/pdf
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
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { name: true, sku: true, hsnCode: true } },
          },
        },
        payments: { include: { paymentMethod: { select: { name: true } } } },
        customer: { select: { name: true, phone: true } },
        vehicle: {
          include: {
            vehicleMake: { select: { name: true } },
            vehicleModel: { select: { name: true } },
          },
        },
        operator: { select: { name: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const config = await prisma.businessConfig.findUnique({ where: { id: "default" } });

    const pdf = generateInvoicePDF(
      {
        shopName: config?.shopName ?? "Mechify",
        shopAddress: config?.shopAddress,
        shopPhone: config?.shopPhone,
        gstNumber: config?.gstNumber,
      },
      {
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date.toISOString(),
        customer: invoice.customer,
        vehicle: invoice.vehicle ? {
          make: invoice.vehicle.vehicleMake.name,
          model: invoice.vehicle.vehicleModel.name,
          regNo: invoice.vehicle.registrationNumber,
        } : null,
        items: invoice.items.map((i) => ({
          name: i.isCustomItem ? (i.customItemName ?? "Custom Item") : (i.product?.name ?? "Unknown"),
          sku: i.product?.sku,
          qty: Number(i.qty),
          unitPrice: Number(i.unitPrice),
          discount: Number(i.discountAmount),
          installCharge: Number(i.installationCharge),
          tax: Number(i.cgstAmount) + Number(i.sgstAmount) + Number(i.igstAmount),
          total: Number(i.lineTotal),
          hsnCode: i.hsnCode,
        })),
        subtotal: Number(invoice.subtotal),
        discountTotal: Number(invoice.discountTotal),
        taxTotal: Number(invoice.taxTotal),
        grandTotal: Number(invoice.grandTotal),
        gstEnabled: invoice.gstEnabled,
        payments: invoice.payments.map((p) => ({
          method: p.paymentMethod.name,
          amount: Number(p.amount),
          reference: p.reference,
        })),
        amountPaid: Number(invoice.amountPaid),
        outstandingAmount: Number(invoice.outstandingAmount),
        isCreditSale: invoice.isCreditSale,
        notes: invoice.notes,
        operator: invoice.operator.name,
      }
    );

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Invoice PDF error:", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
