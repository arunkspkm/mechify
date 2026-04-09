-- AlterTable
ALTER TABLE "SupplierPayment" ADD COLUMN "isAdvance" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SupplierPayment" ADD COLUMN "adjustedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");
