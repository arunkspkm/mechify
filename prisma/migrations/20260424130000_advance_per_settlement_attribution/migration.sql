-- Add per-settlement attribution to AdvancePayment so reversing one weekly settlement
-- doesn't accidentally un-mark advances consumed by other settlements in the same month.
ALTER TABLE "AdvancePayment"
  ADD COLUMN "deductedInSalaryRecordId" TEXT;

ALTER TABLE "AdvancePayment"
  ADD CONSTRAINT "AdvancePayment_deductedInSalaryRecordId_fkey"
  FOREIGN KEY ("deductedInSalaryRecordId") REFERENCES "SalaryRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AdvancePayment_deductedInSalaryRecordId_idx" ON "AdvancePayment"("deductedInSalaryRecordId");
