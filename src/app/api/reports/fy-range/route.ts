import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/reports/fy-range — Earliest date with data (for FY dropdown)
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [firstInvoice, firstExpense, firstPurchase] = await Promise.all([
      prisma.invoice.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
      prisma.expense.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
      prisma.purchaseInvoice.findFirst({ orderBy: { invoiceDate: "asc" }, select: { invoiceDate: true } }),
    ]);

    const dates = [firstInvoice?.date, firstExpense?.date, firstPurchase?.invoiceDate].filter(Boolean) as Date[];
    if (dates.length === 0) {
      // No data yet — return current FY start
      const now = new Date();
      const fyStart = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
      return NextResponse.json({ data: { earliestFyYear: fyStart } });
    }

    const earliestDate = dates.reduce((a, b) => (a < b ? a : b));
    const month = earliestDate.getMonth() + 1;
    const year = earliestDate.getFullYear();
    const earliestFyYear = month >= 4 ? year : year - 1;

    return NextResponse.json({ data: { earliestFyYear } });
  } catch (err) {
    console.error("FY range error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
