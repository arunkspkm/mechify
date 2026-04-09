import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notify";

// GET /api/returns/customer/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const ret = await prisma.customerReturn.findUnique({
    where: { id },
    include: {
      invoice: { select: { invoiceNumber: true, date: true } },
      customer: { select: { name: true, phone: true } },
      processedBy: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, sku: true } },
          reason: { select: { name: true } },
        },
      },
    },
  });

  if (!ret) {
    return NextResponse.json({ error: "Return not found" }, { status: 404 });
  }

  return NextResponse.json({ data: ret });
}

// PATCH /api/returns/customer/[id] — Approve or reject
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden — Owner only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const action = body.action as string;

  const ret = await prisma.customerReturn.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!ret) {
    return NextResponse.json({ error: "Return not found" }, { status: 404 });
  }

  if (ret.status !== "PENDING") {
    return NextResponse.json({ error: `Return is already ${ret.status}` }, { status: 400 });
  }

  try {
    if (action === "approve") {
      // Restock items marked as restockable
      for (const item of ret.items) {
        if (item.restockable && item.batchId) {
          await prisma.batch.update({
            where: { id: item.batchId },
            data: { qtyRemaining: { increment: Number(item.qty) } },
          });
        }
        // Auto-set warranty status for warranty items
        if (item.resolution === "WARRANTY") {
          await prisma.customerReturnItem.update({
            where: { id: item.id },
            data: { warrantyStatus: "SENT_FOR_WARRANTY", warrantySentAt: new Date() },
          });
        }
      }

      // Mark return as approved FIRST, then calculate invoice status
      await prisma.customerReturn.update({
        where: { id },
        data: {
          status: "APPROVED",
          processedBy: { connect: { id: session.user.id } },
        },
      });

      // Now calculate invoice status from ALL approved returns (including this one)
      const invoiceItems = await prisma.invoiceItem.findMany({
        where: { invoiceId: ret.invoiceId },
        select: { productId: true, qty: true, isCustomItem: true, customItemName: true },
      });
      const allApprovedReturns = await prisma.customerReturn.findMany({
        where: { invoiceId: ret.invoiceId, status: "APPROVED" },
        include: { items: true },
      });
      const returnedQtyMap = new Map<string, number>();
      for (const ar of allApprovedReturns) {
        for (const ri of ar.items) {
          if (ri.replacementGiven) continue;
          if (ri.resolution === "WARRANTY" && (ri.warrantyStatus === "REPLACEMENT_RECEIVED" || ri.warrantyStatus === "REPAIRED")) continue;
          const key = ri.productId ?? ri.customItemName ?? ri.id;
          returnedQtyMap.set(key, (returnedQtyMap.get(key) ?? 0) + Number(ri.qty));
        }
      }
      const anyReturned = invoiceItems.some((ii) => {
        const key = ii.productId ?? ii.customItemName ?? "";
        return (returnedQtyMap.get(key) ?? 0) > 0;
      });
      const allFullyReturned = invoiceItems.every((ii) => {
        const key = ii.productId ?? ii.customItemName ?? "";
        return (returnedQtyMap.get(key) ?? 0) >= Number(ii.qty);
      });

      const newStatus = allFullyReturned ? "RETURNED" : anyReturned ? "PARTIALLY_RETURNED" : "COMPLETED";
      await prisma.invoice.update({
        where: { id: ret.invoiceId },
        data: { status: newStatus },
      });

      try {
        await createNotification({
          type: "RETURN_APPROVED",
          title: "Return Approved",
          message: `${ret.returnNumber} has been approved`,
          link: `/billing/returns`,
          recipientRole: "COUNTER_OPERATOR",
        });
      } catch {}

      return NextResponse.json({ message: "Return approved. Restockable items added back to inventory." });
    }

    if (action === "reject") {
      await prisma.customerReturn.update({
        where: { id },
        data: {
          status: "REJECTED",
          processedBy: { connect: { id: session.user.id } },
        },
      });

      try {
        await createNotification({
          type: "RETURN_REJECTED",
          title: "Return Rejected",
          message: `${ret.returnNumber} has been rejected`,
          link: `/billing/returns`,
          recipientRole: "COUNTER_OPERATOR",
        });
      } catch {}

      return NextResponse.json({ message: "Return rejected." });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Return approval error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
