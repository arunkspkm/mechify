-- AlterTable
ALTER TABLE "CustomerEnquiry" ADD COLUMN     "advanceAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "advanceMethodId" TEXT,
ADD COLUMN     "advanceReference" TEXT;
