import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { MasterDataType, Prisma } from "@prisma/client";
import { formatValidationError } from "@/lib/validation";

const createSchema = z.object({
  type: z.nativeEnum(MasterDataType),
  name: z.string().min(1, "Name is required"),
  code: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  displayOrder: z.number().optional(),
});

const updateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  code: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  displayOrder: z.number().optional(),
  active: z.boolean().optional(),
});

// GET /api/master-data?type=UNIT&includeInactive=true&search=meter
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as MasterDataType | null;
  const includeInactive = searchParams.get("includeInactive") === "true";
  const search = searchParams.get("search");
  const parentId = searchParams.get("parentId");

  const where: Record<string, unknown> = {};

  if (type) {
    where.type = type;
  }

  if (!includeInactive) {
    where.active = true;
  }

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  if (parentId) {
    where.parentId = parentId;
  }

  try {
    const data = await prisma.masterData.findMany({
      where,
      include: {
        parent: true,
        children: { where: { active: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] },
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Master data fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch master data" }, { status: 500 });
  }
}

// POST /api/master-data
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  const { type, name, code, parentId, metadata, displayOrder } = parsed.data;

  try {
    // Check uniqueness
    const existing = await prisma.masterData.findUnique({
      where: { type_name: { type, name } },
    });

    if (existing) {
      return NextResponse.json(
        { error: `${type} with name "${name}" already exists` },
        { status: 409 }
      );
    }

    // Get next display order if not provided
    let order = displayOrder;
    if (order === undefined) {
      const last = await prisma.masterData.findFirst({
        where: { type },
        orderBy: { displayOrder: "desc" },
      });
      order = (last?.displayOrder ?? -1) + 1;
    }

    const data = await prisma.masterData.create({
      data: {
        type,
        name,
        code: code ?? null,
        parentId: parentId ?? null,
        metadata: (metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        displayOrder: order,
      },
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error("Master data create error:", err);
    return NextResponse.json({ error: "Failed to create master data" }, { status: 500 });
  }
}

// PATCH /api/master-data
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  const { id, ...updateData } = parsed.data;

  try {
    // Check name uniqueness if name is being updated
    if (updateData.name) {
      const current = await prisma.masterData.findUnique({ where: { id } });
      if (!current) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      if (updateData.name !== current.name) {
        const existing = await prisma.masterData.findUnique({
          where: { type_name: { type: current.type, name: updateData.name } },
        });
        if (existing) {
          return NextResponse.json(
            { error: `${current.type} with name "${updateData.name}" already exists` },
            { status: 409 }
          );
        }
      }
    }

    const { metadata, ...rest } = updateData;
    const data = await prisma.masterData.update({
      where: { id },
      data: {
        ...rest,
        ...(metadata !== undefined ? { metadata: (metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue } : {}),
      },
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Master data update error:", err);
    return NextResponse.json({ error: "Failed to update master data" }, { status: 500 });
  }
}
