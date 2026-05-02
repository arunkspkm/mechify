-- AlterTable: Add payment method tracking to AdvancePayment
ALTER TABLE "AdvancePayment" ADD COLUMN "paymentMethodId" TEXT;
ALTER TABLE "AdvancePayment" ADD COLUMN "reference" TEXT;

-- AlterTable: Add payment method tracking to SalaryRecord
ALTER TABLE "SalaryRecord" ADD COLUMN "paymentMethodId" TEXT;
ALTER TABLE "SalaryRecord" ADD COLUMN "paymentReference" TEXT;

-- AddForeignKey
ALTER TABLE "AdvancePayment" ADD CONSTRAINT "AdvancePayment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "MasterData"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryRecord" ADD CONSTRAINT "SalaryRecord_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "MasterData"("id") ON DELETE SET NULL ON UPDATE CASCADE;
