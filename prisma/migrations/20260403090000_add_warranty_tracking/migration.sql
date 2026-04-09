-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('SENT_FOR_WARRANTY', 'REPLACEMENT_RECEIVED', 'REPAIRED', 'REJECTED_BY_SUPPLIER');

-- AlterTable
ALTER TABLE "CustomerReturnItem" ADD COLUMN "warrantyStatus" "WarrantyStatus";
ALTER TABLE "CustomerReturnItem" ADD COLUMN "warrantySentAt" TIMESTAMP(3);
ALTER TABLE "CustomerReturnItem" ADD COLUMN "warrantyResolvedAt" TIMESTAMP(3);
ALTER TABLE "CustomerReturnItem" ADD COLUMN "warrantyNotes" TEXT;
