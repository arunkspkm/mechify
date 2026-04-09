-- AlterEnum
ALTER TYPE "POStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "expectedDate" TIMESTAMP(3),
ADD COLUMN     "poNumber" TEXT,
ALTER COLUMN "totalAmount" SET NOT NULL,
ALTER COLUMN "totalAmount" SET DEFAULT 0;

-- Set defaults for existing rows
UPDATE "PurchaseOrder" SET "poNumber" = 'PO-' || LEFT("id", 8) WHERE "poNumber" IS NULL;
UPDATE "PurchaseOrder" SET "createdById" = (SELECT "id" FROM "User" LIMIT 1) WHERE "createdById" IS NULL;

-- Now make them NOT NULL
ALTER TABLE "PurchaseOrder" ALTER COLUMN "poNumber" SET NOT NULL;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "createdById" SET NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseOrderItem" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "orderedQty" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "receivedQty" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- Copy existing qty to orderedQty
UPDATE "PurchaseOrderItem" SET "orderedQty" = "qty" WHERE "qty" IS NOT NULL;

-- Drop old column
ALTER TABLE "PurchaseOrderItem" DROP COLUMN IF EXISTS "qty";

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
