import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { optionalPhoneSchema } from "@/lib/validators";
import { createNotification } from "@/lib/notify";

const createSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: optionalPhoneSchema,
  customerId: z.string().optional().nullable(),
  productDescription: z.string().min(1, "Product description is required"),
  desiredQty: z.coerce.number().int().positive().default(1),
  estimatedBudget: z.coerce.number().nonnegative().optional().nullable(),
  advanceAmount: z.coerce.number().nonnegative().optional().default(0),
  advanceMethodId: z.string().optional().nullable(),
  advanceReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/enquiries?status=&page=&limit=
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (search) {
    where.OR = [
      { customerName: { contains: search, mode: "insensitive" } },
      { customerPhone: { contains: search } },
      { productDescription: { contains: search, mode: "insensitive" } },
    ];
  }

  const [enquiries, total] = await Promise.all([
    prisma.customerEnquiry.findMany({
      where,
      include: {
        operator: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.customerEnquiry.count({ where }),
  ]);

  return NextResponse.json({
    data: enquiries,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/enquiries
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { customerName, customerPhone, customerId, productDescription, desiredQty, estimatedBudget, advanceAmount, advanceMethodId, advanceReference, notes } = parsed.data;

    // Auto-link or create customer by phone
    let resolvedCustomerId = customerId ?? null;
    if (!resolvedCustomerId && customerPhone) {
      const existing = await prisma.customer.findUnique({
        where: { phone: customerPhone },
      });
      if (existing) {
        resolvedCustomerId = existing.id;
      } else if (customerName) {
        // Create new customer so they appear in the customers list
        const newCustomer = await prisma.customer.create({
          data: {
            name: customerName,
            phone: customerPhone,
          },
        });
        resolvedCustomerId = newCustomer.id;
      }
    }

    const enquiry = await prisma.customerEnquiry.create({
      data: {
        customerName,
        customerPhone: customerPhone ?? null,
        customerId: resolvedCustomerId,
        productDescription,
        desiredQty,
        estimatedBudget: estimatedBudget ?? null,
        advanceAmount: advanceAmount ?? 0,
        advanceMethodId: advanceMethodId ?? null,
        advanceReference: advanceReference ?? null,
        notes: notes ?? null,
        operatorId: session.user.id,
      },
      include: {
        operator: { select: { name: true } },
      },
    });

    try {
      await createNotification({
        type: "NEW_ENQUIRY",
        title: "New Enquiry",
        message: `${customerName} enquiring about ${productDescription}`,
        link: `/enquiries`,
        recipientRole: "OWNER",
      });
    } catch {}

    return NextResponse.json({ data: enquiry }, { status: 201 });
  } catch (err) {
    console.error("Enquiry creation error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${message}` }, { status: 500 });
  }
}
