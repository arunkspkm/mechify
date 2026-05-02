-- AlterTable: Add opening balance to Supplier for legacy payables
ALTER TABLE "Supplier" ADD COLUMN "openingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable: Add opening balance to Customer for legacy receivables
ALTER TABLE "Customer" ADD COLUMN "openingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0;
