-- Add flag to distinguish "application of an existing advance/overpayment" from a real cash outflow.
-- Without this flag, applying an advance to an invoice double-counts in shift cash.
ALTER TABLE "SupplierPayment"
  ADD COLUMN "isAdvanceApplication" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: historical rows created by the applyAdvance action have these exact note prefixes.
UPDATE "SupplierPayment"
   SET "isAdvanceApplication" = true
 WHERE "notes" LIKE 'Adjusted from advance%'
    OR "notes" LIKE 'Transferred from overpayment%';
