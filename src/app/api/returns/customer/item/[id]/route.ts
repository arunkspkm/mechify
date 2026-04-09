import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const updateWarrantySchema = z.object({
  warrantyStatus: z.enum(["SENT_FOR_WARRANTY", "REPLACEMENT_RECEIVED", "REPAIRED", "REJECTED_BY_SUPPLIER"]),
  warrantyNotes: z.string().optional().nullable(),
});

// PATCH /api/returns/customer/item/[id] — Update warranty status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateWarrantySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const item = await prisma.customerReturnItem.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: "Return item not found" }, { status: 404 });
    }

    if (item.resolution !== "WARRANTY") {
      return NextResponse.json({ error: "This item is not a warranty return" }, { status: 400 });
    }

    const { warrantyStatus, warrantyNotes } = parsed.data;
    const isResolved = ["REPLACEMENT_RECEIVED", "REPAIRED", "REJECTED_BY_SUPPLIER"].includes(warrantyStatus);

    const updated = await prisma.customerReturnItem.update({
      where: { id },
      data: {
        warrantyStatus,
        warrantySentAt: item.warrantySentAt ?? (warrantyStatus === "SENT_FOR_WARRANTY" ? new Date() : null),
        warrantyResolvedAt: isResolved ? new Date() : null,
        warrantyNotes: warrantyNotes ?? item.warrantyNotes,
      },
    });

    // Stock handling depends on whether replacement was given at return creation
    if (warrantyStatus === "REPLACEMENT_RECEIVED" || warrantyStatus === "REPAIRED") {
      if (item.replacementGiven) {
        // Scenario A: Replacement was given from stock at return time.
        // Supplier now returns the defective/repaired item → add back to inventory as recovered stock.
        if (item.batchId) {
          await prisma.batch.update({
            where: { id: item.batchId },
            data: { qtyRemaining: { increment: Number(item.qty) } },
          });
        }
      } else {
        // Scenario B: No replacement given (sent for repair).
        // Supplier returns repaired/replacement item → this goes to customer directly.
        // No stock change needed — item was already sold, just repaired.
      }
    }

    // Recalculate invoice status
    // Warranty items that are resolved (replaced/repaired) = customer has the product = not "returned"
    if (isResolved) {
      const ret = await prisma.customerReturn.findUnique({
        where: { id: item.returnId },
        select: { invoiceId: true },
      });
      if (ret) {
        const invoiceItems = await prisma.invoiceItem.findMany({
          where: { invoiceId: ret.invoiceId },
          select: { productId: true, qty: true, isCustomItem: true, customItemName: true },
        });
        const allReturnItems = await prisma.customerReturnItem.findMany({
          where: { return_: { invoiceId: ret.invoiceId, status: "APPROVED" } },
          select: { productId: true, qty: true, isCustomItem: true, customItemName: true, resolution: true, warrantyStatus: true, replacementGiven: true },
        });
        // Count effectively returned qty
        const returnedQtyMap = new Map<string, number>();
        for (const ri of allReturnItems) {
          // Warranty resolved (replaced/repaired/replacement given) = customer has product = not returned
          if (ri.resolution === "WARRANTY") {
            const resolved = ri.warrantyStatus === "REPLACEMENT_RECEIVED" || ri.warrantyStatus === "REPAIRED";
            if (resolved || ri.replacementGiven) continue;
          }
          const key = ri.productId ?? ri.customItemName ?? "";
          returnedQtyMap.set(key, (returnedQtyMap.get(key) ?? 0) + Number(ri.qty));
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
      }
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Warranty update error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
