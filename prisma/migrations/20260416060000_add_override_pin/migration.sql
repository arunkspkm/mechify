-- AlterTable: Add owner override PIN to BusinessConfig
ALTER TABLE "BusinessConfig" ADD COLUMN "overridePin" TEXT;
