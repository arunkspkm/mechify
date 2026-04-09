import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * POST /api/upload — Upload a product image.
 * Accepts multipart form data with fields: file, productId, isPrimary
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const productId = formData.get("productId") as string | null;
  const isPrimary = formData.get("isPrimary") === "true";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Allowed: JPEG, PNG, WebP" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum 5MB" },
      { status: 400 }
    );
  }

  // Verify product exists
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Create upload directory
  const uploadDir = path.join(process.cwd(), "public", "uploads", "products", productId);
  await mkdir(uploadDir, { recursive: true });

  // Generate unique filename
  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = path.join(uploadDir, filename);

  // Write file
  const bytes = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));

  // If setting as primary, unset existing primary
  if (isPrimary) {
    await prisma.productImage.updateMany({
      where: { productId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  // Save to database
  const image = await prisma.productImage.create({
    data: {
      productId,
      url: `/uploads/products/${productId}/${filename}`,
      isPrimary,
    },
  });

  return NextResponse.json({ data: image }, { status: 201 });
}
