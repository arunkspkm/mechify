-- DropForeignKey
ALTER TABLE "EstimateItem" DROP CONSTRAINT "EstimateItem_productId_fkey";

-- AlterTable
ALTER TABLE "EstimateItem" ADD COLUMN     "customItemName" TEXT,
ADD COLUMN     "isCustomItem" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "productId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "EstimateItem" ADD CONSTRAINT "EstimateItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
