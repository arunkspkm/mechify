import { prisma } from "@/lib/prisma";
import { getFinancialYear } from "@/lib/financial-year";

/**
 * Generate the next invoice number.
 * Format: PREFIX/YYYY-YY/NNNN (e.g., MEC/2026-27/0001)
 */
export async function generateInvoiceNumber(
  prefix: string,
  financialYearStartMonth = 4
): Promise<{ invoiceNumber: string; financialYear: string; sequenceNumber: number }> {
  const fy = getFinancialYear(new Date(), financialYearStartMonth);

  const lastInvoice = await prisma.invoice.findFirst({
    where: { financialYear: fy },
    orderBy: { sequenceNumber: "desc" },
    select: { sequenceNumber: true },
  });

  const nextSeq = (lastInvoice?.sequenceNumber ?? 0) + 1;
  const invoiceNumber = `${prefix}/${fy}/${String(nextSeq).padStart(4, "0")}`;

  return { invoiceNumber, financialYear: fy, sequenceNumber: nextSeq };
}

/**
 * Generate the next estimate number.
 */
export async function generateEstimateNumber(
  prefix: string,
  financialYearStartMonth = 4
): Promise<{ estimateNumber: string; financialYear: string; sequenceNumber: number }> {
  const fy = getFinancialYear(new Date(), financialYearStartMonth);

  const lastEstimate = await prisma.estimate.findFirst({
    where: { financialYear: fy },
    orderBy: { sequenceNumber: "desc" },
    select: { sequenceNumber: true },
  });

  const nextSeq = (lastEstimate?.sequenceNumber ?? 0) + 1;
  const estimateNumber = `${prefix}/${fy}/${String(nextSeq).padStart(4, "0")}`;

  return { estimateNumber, financialYear: fy, sequenceNumber: nextSeq };
}
