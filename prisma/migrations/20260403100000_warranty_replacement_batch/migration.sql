-- AlterTable
ALTER TABLE "CustomerReturnItem" ADD COLUMN "replacementBatchId" TEXT;
ALTER TABLE "CustomerReturnItem" ADD COLUMN "replacementGiven" BOOLEAN NOT NULL DEFAULT false;
