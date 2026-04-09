-- AlterTable
ALTER TABLE "ProductPriceChange" ADD COLUMN     "changeType" TEXT NOT NULL DEFAULT 'PRICE',
ADD COLUMN     "newTaxRateId" TEXT,
ADD COLUMN     "newTaxRateName" TEXT,
ADD COLUMN     "oldTaxRateId" TEXT,
ADD COLUMN     "oldTaxRateName" TEXT,
ALTER COLUMN "oldMrp" SET DEFAULT 0,
ALTER COLUMN "newMrp" SET DEFAULT 0,
ALTER COLUMN "oldSellingPrice" SET DEFAULT 0,
ALTER COLUMN "newSellingPrice" SET DEFAULT 0;
