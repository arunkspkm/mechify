import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { distributeLandedCost } from "@/lib/landed-cost";
import { formatValidationError } from "@/lib/validation";
import { createNotification } from "@/lib/notify";

const lineItemSchema = z.object({
  productId: z.string().min(1),
  batchNumber: z.string().optional().default(""),
  bundleQty: z.coerce.number().positive("Quantity must be positive"),
  unitCost: z.coerce.number().nonnegative("Cost must be non-negative"),
  qualityGradeId: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
});

const stockInwardSchema = z.object({
  supplierName: z.string().min(1, "Supplier name is required"),
  supplierBillNumber: z.string().optional().nullable(),
  handlingCharge: z.coerce.number().nonnegative().default(0),
  items: z.array(lineItemSchema).min(1, "At least one item is required"),
  status: z.enum(["DRAFT", "FINALIZED"]).default("FINALIZED"),
});

/**
 * POST /api/inventory/stock-inward — Record a purchase invoice with multiple items.
 * Now creates a PurchaseInvoice as the parent record.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = stockInwardSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  const { supplierName, supplierBillNumber, handlingCharge, items, status } = parsed.data;

  try {
    // Resolve supplier
    let supplierId: string;
    const existing = await prisma.supplier.findFirst({
      where: { name: { equals: supplierName.trim(), mode: "insensitive" } },
    });
    if (existing) {
      supplierId = existing.id;
    } else {
      const newSupplier = await prisma.supplier.create({
        data: { name: supplierName.trim() },
      });
      supplierId = newSupplier.id;
    }

    // Load all products
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true, name: true, sku: true, bundleSize: true, hasExpiry: true, sellingPrice: true,
        batches: {
          where: { active: true },
          orderBy: { purchaseDate: "desc" },
          take: 1,
          select: { landedCostPerUnit: true },
        },
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Calculate line items
    const lineItems = items.map((item) => {
      const product = productMap.get(item.productId);
      const bundleSize = Number(product?.bundleSize ?? 1);
      const qtyInSellingUnits = item.bundleQty * bundleSize;
      const costPerSellingUnit = bundleSize > 0 ? item.unitCost / bundleSize : item.unitCost;
      const totalCost = item.bundleQty * item.unitCost;
      return { ...item, product, bundleSize, qtyInSellingUnits, costPerSellingUnit, totalCost };
    });

    // Distribute handling
    const landedCosts = distributeLandedCost(
      lineItems.map((li) => ({ unitCost: li.costPerSellingUnit, qty: li.qtyInSellingUnits })),
      handlingCharge
    );

    const totalItemsAmount = lineItems.reduce((s, li) => s + li.totalCost, 0);
    const grandTotal = totalItemsAmount + handlingCharge;

    // Create Purchase Invoice
    const purchaseInvoice = await prisma.purchaseInvoice.create({
      data: {
        supplier: { connect: { id: supplierId } },
        supplierBillNumber: supplierBillNumber ?? null,
        totalItemsAmount,
        handlingCharge,
        grandTotal,
        outstandingAmount: grandTotal,
        status,
        invoiceDate: new Date(),
      },
    });

    // Create batches and purchase invoice items
    const createdBatches = [];
    for (let i = 0; i < lineItems.length; i++) {
      const li = lineItems[i];
      const lc = landedCosts[i];

      if (!li.product) {
        createdBatches.push({ error: `Product not found: ${li.productId}` });
        continue;
      }

      const batch = await prisma.batch.create({
        data: {
          product: { connect: { id: li.productId } },
          supplier: { connect: { id: supplierId } },
          batchNumber: li.batchNumber || `PI-${purchaseInvoice.id.slice(-6)}`,
          bundleQtyReceived: li.bundleQty,
          qtyReceived: li.qtyInSellingUnits,
          qtyRemaining: status === "FINALIZED" ? li.qtyInSellingUnits : 0,
          unitCost: li.costPerSellingUnit,
          handlingCharge: lc.handlingPerUnit * li.qtyInSellingUnits,
          landedCostPerUnit: lc.landedCostPerUnit,
          ...(li.qualityGradeId ? { qualityGrade: { connect: { id: li.qualityGradeId } } } : {}),
          expiryDate: li.expiryDate ? new Date(li.expiryDate) : null,
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
          qualityGradeId: li.qualityGradeId || null,
          expiryDate: li.expiryDate ? new Date(li.expiryDate) : null,
        },
      });

      createdBatches.push({
        product: li.product.name,
        sku: li.product.sku,
        sellingUnitsAdded: li.qtyInSellingUnits,
        costPerUnit: li.costPerSellingUnit.toFixed(2),
        handlingPerUnit: lc.handlingPerUnit.toFixed(2),
        landedCostPerUnit: lc.landedCostPerUnit.toFixed(2),
      });
    }

    // Notify owner if cost increased vs previous batch
    try {
      for (let i = 0; i < lineItems.length; i++) {
        const li = lineItems[i];
        if (!li.product) continue;
        const prevBatch = li.product.batches[0];
        if (!prevBatch) continue;
        const prevCost = Number(prevBatch.landedCostPerUnit);
        const newCost = landedCosts[i].landedCostPerUnit;
        if (newCost > prevCost && prevCost > 0) {
          const sp = Number(li.product.sellingPrice);
          const marginPct = sp > 0 ? Math.round(((sp - newCost) / sp) * 100) : 0;
          await createNotification({
            type: "COST_INCREASE",
            title: "Cost Increased",
            message: `${li.product.name} — cost Rs.${prevCost.toFixed(0)} → Rs.${newCost.toFixed(0)}. Selling Rs.${sp.toFixed(0)}, margin ${marginPct}%`,
            link: `/products/${li.productId}`,
            recipientRole: "OWNER",
          });
        }
      }
    } catch {}

    return NextResponse.json({
      data: {
        purchaseInvoiceId: purchaseInvoice.id,
        supplier: supplierName,
        totalHandlingCharge: handlingCharge,
        itemCount: lineItems.length,
        grandTotal,
        batches: createdBatches,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("Stock inward error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
