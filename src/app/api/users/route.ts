import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hashSync } from "bcryptjs";
import { z } from "zod";
import { formatValidationError } from "@/lib/validation";

const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string().min(4, "Password must be at least 4 characters"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["OWNER", "MANAGER", "COUNTER_OPERATOR"]),
});

const updateUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Name is required").optional(),
  password: z.string().min(4, "Password must be at least 4 characters").optional(),
  role: z.enum(["OWNER", "MANAGER", "COUNTER_OPERATOR"]).optional(),
  active: z.boolean().optional(),
});


// GET /api/users — List all users (Owner only)
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ data: users });
  } catch (err) {
    console.error("Users list error:", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// POST /api/users — Create user (Owner only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { username: parsed.data.username },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Username "${parsed.data.username}" is already taken` },
        { status: 409 }
      );
    }

    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        passwordHash: hashSync(parsed.data.password, 10),
        name: parsed.data.name,
        role: parsed.data.role,
      },
      select: { id: true, username: true, name: true, role: true, active: true },
    });

    return NextResponse.json({ data: user }, { status: 201 });
  } catch (err) {
    console.error("User create error:", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

// PATCH /api/users — Update user (Owner only)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const { id, password, ...updateData } = parsed.data;

    const data: Record<string, unknown> = { ...updateData };
    if (password) {
      data.passwordHash = hashSync(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, name: true, role: true, active: true },
    });

    return NextResponse.json({ data: user });
  } catch (err) {
    console.error("User update error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("Record to update not found")) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
