import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { formatValidationError } from "@/lib/validation";

const settingsSchema = z.object({
  shopName: z.string().min(1).optional(),
  shopAddress: z.string().optional().nullable(),
  shopPhone: z.string().optional().nullable(),
  gstEnabled: z.boolean().optional(),
  gstNumber: z.string().optional().nullable(),
  loyaltyEnabled: z.boolean().optional(),
  loyaltyPointsPerRupee: z.coerce.number().nonnegative().optional(),
  loyaltyRedemptionValue: z.coerce.number().nonnegative().optional(),
  pointExpiryMonths: z.coerce.number().nonnegative().optional(),
  defaultDiscountMax: z.coerce.number().nonnegative().optional(),
  defaultCreditLimit: z.coerce.number().nonnegative().optional(),
  financialYearStartMonth: z.coerce.number().min(1).max(12).optional(),
  invoicePrefix: z.string().optional(),
  estimatePrefix: z.string().optional(),
  expiryAlertDays: z.coerce.number().nonnegative().optional(),
  backupTime: z.string().optional(),
  backupRetentionDays: z.coerce.number().nonnegative().optional(),
  overridePin: z.string().min(4).max(6).regex(/^\d+$/, "PIN must be digits only").optional().nullable(),
});

// GET /api/settings — Get business config
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await prisma.businessConfig.findUnique({
      where: { id: "default" },
    });
    return NextResponse.json({ data: config });
  } catch (err) {
    console.error("Settings GET error:", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

// PATCH /api/settings — Update business config (Owner only)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = settingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatValidationError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const config = await prisma.businessConfig.upsert({
      where: { id: "default" },
      update: parsed.data,
      create: { id: "default", ...parsed.data },
    });
    return NextResponse.json({ data: config });
  } catch (err) {
    console.error("Settings PATCH error:", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
