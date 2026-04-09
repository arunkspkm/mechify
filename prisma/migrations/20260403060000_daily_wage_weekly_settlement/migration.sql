-- CreateEnum
CREATE TYPE "WageType" AS ENUM ('DAILY', 'MONTHLY');
CREATE TYPE "PeriodType" AS ENUM ('WEEKLY', 'MONTHLY');

-- AlterTable Employee: add wageType and dailyWage
ALTER TABLE "Employee" ADD COLUMN "wageType" "WageType" NOT NULL DEFAULT 'DAILY';
ALTER TABLE "Employee" ADD COLUMN "dailyWage" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- Drop old SalaryRecord constraints and columns, add new ones
-- First drop the old unique constraint
ALTER TABLE "SalaryRecord" DROP CONSTRAINT IF EXISTS "SalaryRecord_employeeId_month_year_key";

-- Add new columns
ALTER TABLE "SalaryRecord" ADD COLUMN "periodType" "PeriodType" NOT NULL DEFAULT 'WEEKLY';
ALTER TABLE "SalaryRecord" ADD COLUMN "periodStart" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SalaryRecord" ADD COLUMN "periodEnd" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SalaryRecord" ADD COLUMN "dailyWage" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- Drop old columns
ALTER TABLE "SalaryRecord" DROP COLUMN IF EXISTS "month";
ALTER TABLE "SalaryRecord" DROP COLUMN IF EXISTS "year";

-- Add new constraints
CREATE UNIQUE INDEX "SalaryRecord_employeeId_periodStart_periodEnd_key" ON "SalaryRecord"("employeeId", "periodStart", "periodEnd");
CREATE INDEX "SalaryRecord_periodStart_idx" ON "SalaryRecord"("periodStart");
