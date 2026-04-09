import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

// GET /api/purchase-orders/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      createdBy: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, sku: true, bundleSize: true, sellingPrice: true } },
        },
      },
    },
  });

  if (!po) {
    return NextResponse.json({ error: "PO not found" }, { status: 404 });
  }

  return NextResponse.json({ data: po });
}

// PATCH /api/purchase-orders/[id] — Update status, receive items
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
  const action = body.action as string;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!po) {
    return NextResponse.json({ error: "PO not found" }, { status: 404 });
  }

  try {
    // --- Mark as Sent ---
    if (action === "send") {
      if (po.status !== "DRAFT") {
        return NextResponse.json({ error: "Only drafts can be sent" }, { status: 400 });
      }
      await prisma.purchaseOrder.update({
        where: { id },
        data: { status: "SENT" },
      });
      return NextResponse.json({ message: "PO marked as sent" });
    }

    // --- Receive items (partial or full) ---
    if (action === "receive") {
      if (po.status !== "SENT" && po.status !== "PARTIALLY_RECEIVED") {
        return NextResponse.json({ error: "PO must be in SENT or PARTIALLY_RECEIVED status" }, { status: 400 });
      }

      const receiveSchema = z.object({
        items: z.array(z.object({
          itemId: z.string().min(1),
          receivedQty: z.coerce.number().nonnegative(),
        })),
        handlingCharge: z.coerce.number().nonnegative().default(0),
        supplierBillNumber: z.string().optional().nullable(),
      });

      const parsed = receiveSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed" }, { status: 400 });
      }

      const { items: receivedItems, handlingCharge, supplierBillNumber } = parsed.data;

      // Filter items with qty > 0
      const itemsToReceive = receivedItems.filter((i) => i.receivedQty > 0);
      if (itemsToReceive.length === 0) {
        return NextResponse.json({ error: "No items to receive" }, { status: 400 });
      }

      // Create a Purchase Invoice for the received items
      const piData: { productId: string; bundleQty: number; unitCost: number }[] = [];

      for (const received of itemsToReceive) {
        const poItem = po.items.find((i) => i.id === received.itemId);
        if (!poItem) continue;

        const newReceived = Number(poItem.receivedQty) + received.receivedQty;
        if (newReceived > Number(poItem.orderedQty)) {
          return NextResponse.json({
            error: `Cannot receive more than ordered for item ${received.itemId}`,
          }, { status: 400 });
        }

        // Update received qty on PO item
        await prisma.purchaseOrderItem.update({
          where: { id: received.itemId },
          data: { receivedQty: newReceived },
        });

        piData.push({
          productId: poItem.productId,
          bundleQty: received.receivedQty,
          unitCost: Number(poItem.agreedPrice),
        });
      }

      // Check if fully received
      const updatedItems = await prisma.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
      });

      const allFullyReceived = updatedItems.every(
        (i) => Number(i.receivedQty) >= Number(i.orderedQty)
      );
      const anyReceived = updatedItems.some((i) => Number(i.receivedQty) > 0);

      const newStatus = allFullyReceived ? "CLOSED" : anyReceived ? "PARTIALLY_RECEIVED" : po.status;

      await prisma.purchaseOrder.update({
        where: { id },
        data: { status: newStatus },
      });

      // Create a stock inward (Purchase Invoice) for the received items
      // We'll call the stock inward API logic inline
      const { distributeLandedCost } = await import("@/lib/landed-cost");

      const products = await prisma.product.findMany({
        where: { id: { in: piData.map((i) => i.productId) } },
        select: { id: true, bundleSize: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      const lineItems = piData.map((item) => {
        const product = productMap.get(item.productId);
        const bundleSize = Number(product?.bundleSize ?? 1);
        const qtyInSellingUnits = item.bundleQty * bundleSize;
        const costPerSellingUnit = bundleSize > 0 ? item.unitCost / bundleSize : item.unitCost;
        return { ...item, bundleSize, qtyInSellingUnits, costPerSellingUnit, totalCost: item.bundleQty * item.unitCost };
      });

      const landedCosts = distributeLandedCost(
        lineItems.map((li) => ({ unitCost: li.costPerSellingUnit, qty: li.qtyInSellingUnits })),
        handlingCharge
      );

      const totalItemsAmount = lineItems.reduce((s, li) => s + li.totalCost, 0);

      // Create Purchase Invoice
      const purchaseInvoice = await prisma.purchaseInvoice.create({
        data: {
          supplier: { connect: { id: po.supplierId } },
          supplierBillNumber: supplierBillNumber ?? null,
          totalItemsAmount,
          handlingCharge,
          grandTotal: totalItemsAmount + handlingCharge,
          outstandingAmount: totalItemsAmount + handlingCharge,
          status: "FINALIZED",
          invoiceDate: new Date(),
        },
      });

      // Create batches and PI items
      for (let i = 0; i < lineItems.length; i++) {
        const li = lineItems[i];
        const lc = landedCosts[i];

        const batch = await prisma.batch.create({
          data: {
            product: { connect: { id: li.productId } },
            supplier: { connect: { id: po.supplierId } },
            purchaseOrder: { connect: { id: po.id } },
            batchNumber: `PO-${po.poNumber}`,
            bundleQtyReceived: li.bundleQty,
            qtyReceived: li.qtyInSellingUnits,
            qtyRemaining: li.qtyInSellingUnits,
            unitCost: li.costPerSellingUnit,
            handlingCharge: lc.handlingPerUnit * li.qtyInSellingUnits,
            landedCostPerUnit: lc.landedCostPerUnit,
            purchaseDate: new Date(),
          },
        });

        await prisma.purchaseInvoiceItem.create({
          data: {
            purchaseInvoice: { connect: { id: purchaseInvoice.id } },
            product: { connect: { id: li.productId } },
            batch: { connect: { id: batch.id } },
            bundleQty: li.bundleQty,
            unitCost: li.unitCost,
            totalCost: li.totalCost,
          },
        });
      }

      return NextResponse.json({
        message: allFullyReceived
          ? "All items received — PO closed. Stock updated."
          : "Items received — PO partially fulfilled. Stock updated.",
        purchaseInvoiceId: purchaseInvoice.id,
        poStatus: newStatus,
      });
    }

    // --- Cancel ---
    if (action === "cancel") {
      if (po.status === "CLOSED") {
        return NextResponse.json({ error: "Cannot cancel a closed PO" }, { status: 400 });
      }
      await prisma.purchaseOrder.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      return NextResponse.json({ message: "PO cancelled" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("PO update error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
