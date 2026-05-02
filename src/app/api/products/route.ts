import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { productCreateSchema } from "@/types/product";
import { formatValidationError } from "@/lib/validation";

// GET /api/products?search=&category=&brand=&active=true&page=1&limit=20
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const categoryId = searchParams.get("category");
  const brandId = searchParams.get("brand");
  const active = searchParams.get("active") !== "false";
  const inStock = searchParams.get("inStock") === "true";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  const where: Record<string, unknown> = {};

  if (active) where.active = true;
  if (categoryId) where.categoryId = categoryId;
  if (brandId) where.brandId = brandId;
  if (inStock) {
    where.batches = {
      some: {
        active: true,
        qtyRemaining: { gt: 0 },
        OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
      },
    };
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, code: true } },
        taxRate: { select: { id: true, name: true, metadata: true } },
        images: { where: { isPrimary: true }, take: 1 },
        batches: {
          where: { supplierId: { not: null } },
          orderBy: { purchaseDate: "desc" },
          take: 1,
          select: { supplier: { select: { name: true } } },
        },
        _count: { select: { batches: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/products
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = productCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  const { companionProductIds, ...productData } = parsed.data;

  // Auto-generate SKU from name + brand if not provided
  if (!productData.sku) {
    let brandName = "";
    if (productData.brandId) {
      const brand = await prisma.masterData.findUnique({ where: { id: productData.brandId }, select: { name: true } });
      brandName = brand?.name ?? "";
    }
    const { generateSku } = await import("@/lib/sku-generator");
    const baseSku = generateSku(productData.name, brandName);
    let sku = baseSku;
    let suffix = 1;
    while (await prisma.product.findUnique({ where: { sku } })) {
      sku = `${baseSku.slice(0, 27)}-${suffix}`;
      suffix++;
      if (suffix > 100) break;
    }
    productData.sku = sku;
  }

  // Check SKU uniqueness
  const existing = await prisma.product.findUnique({
    where: { sku: productData.sku },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Product with SKU "${productData.sku}" already exists` },
      { status: 409 }
    );
  }

  // Check barcode uniqueness
  if (productData.barcode) {
    const existingBarcode = await prisma.product.findUnique({
      where: { barcode: productData.barcode },
    });
    if (existingBarcode) {
      return NextResponse.json(
        { error: `Product with barcode "${productData.barcode}" already exists` },
        { status: 409 }
      );
    }
  }

  const product = await prisma.product.create({
    data: {
      ...productData,
      barcode: productData.barcode ?? null,
      description: productData.description ?? null,
      hsnCode: productData.hsnCode ?? null,
      brandId: productData.brandId ?? null,
      taxRateId: productData.taxRateId ?? null,
      maxDiscountPercent: productData.maxDiscountPercent ?? null,
      companionProducts: companionProductIds.length > 0
        ? {
            create: companionProductIds.map((id) => ({
              companionProductId: id,
            })),
          }
        : undefined,
    },
    include: {
      category: true,
      brand: true,
      unit: true,
      images: true,
      companionProducts: { include: { companionProduct: true } },
    },
  });

  return NextResponse.json({ data: product }, { status: 201 });
}
