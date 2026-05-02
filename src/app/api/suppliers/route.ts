import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { formatValidationError } from "@/lib/validation";

const createSupplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required"),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  qualityRating: z.coerce.number().min(1).max(5).default(3),
  paymentTerms: z.string().optional().nullable(),
  creditPeriodDays: z.coerce.number().nonnegative().optional().nullable(),
});

// GET /api/suppliers?q=abc&limit=10&full=true
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const full = searchParams.get("full") === "true";
  const includeInactive = searchParams.get("includeInactive") === "true";

  const where: Record<string, unknown> = {};
  if (!includeInactive) where.active = true;
  if (q.length > 0) {
    where.name = { contains: q, mode: "insensitive" };
  }

  if (!full) {
    // Quick autocomplete mode
    const suppliers = await prisma.supplier.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: limit,
    });
    return NextResponse.json({ data: suppliers });
  }

  // Full list with details + computed outstanding from purchase invoices
  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      include: {
        _count: { select: { batches: true, purchaseInvoices: true } },
        purchaseInvoices: {
          where: { outstandingAmount: { gt: 0 }, status: { not: "CANCELLED" } },
          select: { outstandingAmount: true },
        },
      },
      orderBy: { name: "asc" },
      take: limit,
    }),
    prisma.supplier.count({ where }),
  ]);

  // Compute actual outstanding from purchase invoices + opening balance
  const data = suppliers.map((s) => {
    const invoiceOutstanding = s.purchaseInvoices.reduce(
      (sum, pi) => sum + Number(pi.outstandingAmount), 0
    );
    const { purchaseInvoices, ...rest } = s;
    return { ...rest, outstandingBalance: invoiceOutstanding + Number(s.openingBalance) };
  });

  return NextResponse.json({ data, total });
}

// POST /api/suppliers — Create supplier
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSupplierSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  const supplier = await prisma.supplier.create({
    data: parsed.data,
  });

  return NextResponse.json({ data: supplier }, { status: 201 });
}
