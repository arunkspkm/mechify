import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/settings/verify-pin — Verify owner override PIN
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pin } = await req.json();
  if (!pin || typeof pin !== "string") {
    return NextResponse.json({ error: "PIN is required" }, { status: 400 });
  }

  const config = await prisma.businessConfig.findUnique({
    where: { id: "default" },
    select: { overridePin: true },
  });

  if (!config?.overridePin) {
    return NextResponse.json({ error: "Override PIN not configured. Set it in Settings." }, { status: 400 });
  }

  if (pin !== config.overridePin) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 403 });
  }

  return NextResponse.json({ valid: true });
}
