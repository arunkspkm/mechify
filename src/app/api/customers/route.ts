import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { optionalPhoneSchema } from "@/lib/validators";
import { formatValidationError } from "@/lib/validation";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: optionalPhoneSchema,
  email: z.string().optional().nullable(),
});

const vehicleSchema = z.object({
  customerId: z.string().min(1),
  vehicleMakeId: z.string().min(1),
  vehicleModelId: z.string().min(1),
  year: z.coerce.number().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
});

// GET /api/customers?q=search&limit=10
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  const where: Record<string, unknown> = {};
  if (q.length > 0) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    include: {
      vehicles: {
        include: {
          vehicleMake: { select: { name: true } },
          vehicleModel: { select: { name: true } },
        },
      },
      invoices: {
        where: { isCreditSale: true, outstandingAmount: { gt: 0 }, status: { not: "CANCELLED" } },
        select: { outstandingAmount: true },
      },
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  // Compute true outstanding = opening balance + sum of outstanding invoice amounts
  const data = customers.map((c) => {
    const invoiceOutstanding = c.invoices.reduce((s, i) => s + Number(i.outstandingAmount), 0);
    const computed = invoiceOutstanding + Number(c.openingBalance);
    const { invoices: _invoices, ...rest } = c;
    return { ...rest, outstandingBalance: computed };
  });

  return NextResponse.json({ data });
}

// POST /api/customers — Create customer
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Check if it's a vehicle being added
  if (body.customerId && body.vehicleMakeId) {
    const parsed = vehicleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 }
      );
    }

    const vehicle = await prisma.customerVehicle.create({
      data: parsed.data,
      include: {
        vehicleMake: { select: { name: true } },
        vehicleModel: { select: { name: true } },
      },
    });

    return NextResponse.json({ data: vehicle }, { status: 201 });
  }

  // Create customer
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  // Check phone uniqueness — return existing customer if found
  if (parsed.data.phone) {
    const existing = await prisma.customer.findUnique({
      where: { phone: parsed.data.phone },
      include: {
        vehicles: {
          include: {
            vehicleMake: { select: { name: true } },
            vehicleModel: { select: { name: true } },
          },
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: `This mobile number belongs to existing customer "${existing.name}"`,
          existingCustomer: existing,
        },
        { status: 409 }
      );
    }
  }

  const customer = await prisma.customer.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
    },
    include: { vehicles: true },
  });

  return NextResponse.json({ data: customer }, { status: 201 });
}
