import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface ImportProduct {
  [key: string]: unknown;
}

/**
 * POST /api/products/import — Bulk import products from mapped Excel data.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { products }: { products: ImportProduct[] } = await req.json();

  if (!products || products.length === 0) {
    return NextResponse.json({ error: "No products to import" }, { status: 400 });
  }

  // Load master data for lookups
  const [categories, units, brands] = await Promise.all([
    prisma.masterData.findMany({ where: { type: "CATEGORY", active: true } }),
    prisma.masterData.findMany({ where: { type: "UNIT", active: true } }),
    prisma.masterData.findMany({ where: { type: "BRAND", active: true } }),
  ]);

  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase().trim(), c.id]));
  const unitMap = new Map(units.map((u) => [u.name.toLowerCase().trim(), u.id]));
  const unitCodeMap = new Map(
    units.filter((u) => u.code).map((u) => [u.code!.toLowerCase().trim(), u.id])
  );
  const brandMap = new Map(brands.map((b) => [b.name.toLowerCase().trim(), b.id]));
  const brandCache = new Map<string, string>();

  // Default fallbacks
  const defaultCategoryId = categories[0]?.id;
  const defaultUnitId = units.find((u) => u.code === "pcs")?.id ?? units[0]?.id;

  let imported = 0;
  let skipped = 0;
  const errors: { row: number; name: string; error: string }[] = [];

  // Track SKUs used in this import batch to prevent duplicates within the batch
  const usedSkus = new Set<string>();
  // Cache supplier lookups to avoid duplicate DB queries for the same distributor name
  const supplierCache = new Map<string, string>();

  for (let i = 0; i < products.length; i++) {
    const p = products[i];

    // Get name - try common field names
    const name = toStr(p.name);

    if (!name) {
      errors.push({
        row: i + 1,
        name: "(empty)",
        error: "Product name is empty — check if 'Product Name' column is mapped correctly",
      });
      skipped++;
      continue;
    }

    // Generate SKU if not provided
    let sku = toStr(p.sku);
    if (!sku) {
      // Create SKU: first 3 chars of each word, max 16 chars
      const brandStr = toStr(p.brand);
      const skuParts = [name, brandStr].filter(Boolean).join(" ");
      const words = skuParts.replace(/[^a-zA-Z0-9\s.]/g, "").split(/\s+/).filter((w) => w.length > 0).map((w) => w.toUpperCase().slice(0, 3));
      let baseSku = words.join("-");
      if (baseSku.length > 16) {
        const segments: string[] = [];
        let len = 0;
        for (const word of words) {
          const needed = segments.length > 0 ? word.length + 1 : word.length;
          if (len + needed > 16) break;
          segments.push(word);
          len += needed;
        }
        baseSku = segments.join("-");
      }
      sku = baseSku || name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);

      // Ensure uniqueness by adding suffix if needed
      let suffix = 0;
      let candidateSku = sku;
      while (usedSkus.has(candidateSku)) {
        suffix++;
        candidateSku = `${sku}-${suffix}`;
      }
      sku = candidateSku;
    }

    // Check if SKU already exists in database
    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing || usedSkus.has(sku)) {
      // Try appending a number
      let attempt = 1;
      let newSku = `${sku}-${attempt}`;
      while (
        usedSkus.has(newSku) ||
        (await prisma.product.findUnique({ where: { sku: newSku } }))
      ) {
        attempt++;
        newSku = `${sku}-${attempt}`;
        if (attempt > 10) break;
      }
      if (attempt > 10) {
        errors.push({ row: i + 1, name, error: `Could not generate unique SKU from "${sku}"` });
        skipped++;
        continue;
      }
      sku = newSku;
    }

    usedSkus.add(sku);

    // Resolve category
    const categoryStr = toStr(p.category);
    let categoryId = defaultCategoryId;
    if (categoryStr) {
      const catLower = categoryStr.toLowerCase().trim();
      categoryId = categoryMap.get(catLower) ?? defaultCategoryId;

      // If category doesn't exist, create it
      if (!categoryId) {
        try {
          const newCat = await prisma.masterData.create({
            data: {
              type: "CATEGORY",
              name: categoryStr.trim(),
              displayOrder: categories.length,
            },
          });
          categoryId = newCat.id;
          categoryMap.set(catLower, newCat.id);
        } catch {
          categoryId = defaultCategoryId;
        }
      }
    }

    // Resolve unit
    let unitId = defaultUnitId;
    const unitStr = toStr(p.unit);
    if (unitStr) {
      const unitLower = unitStr.toLowerCase().trim();
      unitId = unitMap.get(unitLower) ?? unitCodeMap.get(unitLower) ?? defaultUnitId;

      // If unit doesn't exist, create it
      if (!unitId) {
        try {
          const newUnit = await prisma.masterData.create({
            data: {
              type: "UNIT",
              name: unitStr.trim(),
              code: unitStr.trim().toLowerCase().slice(0, 10),
              displayOrder: units.length,
            },
          });
          unitId = newUnit.id;
          unitMap.set(unitLower, newUnit.id);
        } catch {
          unitId = defaultUnitId;
        }
      }
    }

    if (!categoryId || !unitId) {
      errors.push({ row: i + 1, name, error: "Could not resolve category or unit — no defaults available" });
      skipped++;
      continue;
    }

    try {
      const mrp = toNum(p.mrp) || toNum(p.sellingPrice) || 0;
      const sellingPrice = toNum(p.sellingPrice) || mrp;
      const hsnCode = toStr(p.hsnCode);
      const bundleSize = toNum(p.bundleSize) || 1;

      // Resolve brand
      let brandId: string | null = null;
      const brandStr = toStr(p.brand);
      if (brandStr) {
        const brandLower = brandStr.toLowerCase().trim();
        if (brandMap.has(brandLower)) {
          brandId = brandMap.get(brandLower)!;
        } else if (brandCache.has(brandLower)) {
          brandId = brandCache.get(brandLower)!;
        } else {
          const newBrand = await prisma.masterData.create({
            data: { type: "BRAND", name: brandStr.trim() },
          });
          brandCache.set(brandLower, newBrand.id);
          brandId = newBrand.id;
        }
      }

      const product = await prisma.product.create({
        data: {
          name: name.trim(),
          sku,
          hsnCode: hsnCode || null,
          categoryId,
          brandId,
          unitId,
          mrp,
          sellingPrice,
          bundleSize,
          installationCharge: 0,
          lowStockThreshold: 1,
        },
      });

      // Resolve supplier/distributor
      let supplierId: string | null = null;
      const distributorName = toStr(p.distributor);
      if (distributorName) {
        const distLower = distributorName.toLowerCase().trim();
        // Check supplier cache first
        if (!supplierCache.has(distLower)) {
          const existing = await prisma.supplier.findFirst({
            where: { name: { equals: distributorName.trim(), mode: "insensitive" } },
          });
          if (existing) {
            supplierCache.set(distLower, existing.id);
          } else {
            const newSupplier = await prisma.supplier.create({
              data: { name: distributorName.trim() },
            });
            supplierCache.set(distLower, newSupplier.id);
          }
        }
        supplierId = supplierCache.get(distLower) ?? null;
      }

      // Create initial batch — always create one even with 0 stock so supplier link is preserved
      const stockBundles = toNum(p.stock) || toNum(p.quantity) || 0;
      const costPerBundle = toNum(p.unitPrice) || toNum(p.costPerBundle) || 0;
      // Stock in selling units = bundles × bundleSize
      const stockUnits = stockBundles * bundleSize;
      // Cost per selling unit
      const costPerUnit = bundleSize > 1 && costPerBundle > 0 ? costPerBundle / bundleSize : costPerBundle;
      await prisma.batch.create({
        data: {
          productId: product.id,
          supplierId,
          batchNumber: "IMPORT",
          bundleQtyReceived: bundleSize > 1 ? stockBundles : undefined,
          qtyReceived: stockUnits,
          qtyRemaining: stockUnits,
          unitCost: costPerUnit,
          landedCostPerUnit: costPerUnit > 0 ? costPerUnit : sellingPrice,
          purchaseDate: new Date(),
        },
      });

      imported++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      errors.push({ row: i + 1, name, error: msg });
      skipped++;
    }
  }

  return NextResponse.json({
    data: { imported, skipped, total: products.length, errors },
  });
}

/** Safely convert a value to a trimmed string, or return empty string. */
function toStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

/** Safely convert a value to a number, or return 0. */
function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}
