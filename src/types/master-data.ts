import { MasterDataType } from "@prisma/client";

export interface MasterDataItem {
  id: string;
  type: MasterDataType;
  name: string;
  code: string | null;
  parentId: string | null;
  parent?: MasterDataItem | null;
  children?: MasterDataItem[];
  metadata: Record<string, unknown> | null;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const MASTER_DATA_TYPE_LABELS: Record<MasterDataType, string> = {
  UNIT: "Units of Measurement",
  CATEGORY: "Product Categories",
  BRAND: "Brands",
  EXPENSE_CATEGORY: "Expense Categories",
  PAYMENT_METHOD: "Payment Methods",
  RETURN_REASON: "Return Reasons",
  QUALITY_GRADE: "Quality Grades",
  LOYALTY_TIER: "Loyalty Tiers",
  TAX_RATE: "Tax Rates",
  INSTALLATION_CHARGE_TYPE: "Installation Charge Types",
  VEHICLE_MAKE: "Vehicle Makes",
  VEHICLE_MODEL: "Vehicle Models",
  STOCK_ADJUSTMENT_REASON: "Stock Adjustment Reasons",
  ESTIMATE_VALIDITY_PERIOD: "Estimate Validity Periods",
};

// Fields that have metadata with specific keys
export const METADATA_FIELDS: Partial<
  Record<MasterDataType, { key: string; label: string; type: "number" }[]>
> = {
  TAX_RATE: [{ key: "rate", label: "Rate (%)", type: "number" }],
  ESTIMATE_VALIDITY_PERIOD: [{ key: "days", label: "Days", type: "number" }],
};

// Types that use parent-child hierarchy
export const HIERARCHICAL_TYPES: Partial<Record<MasterDataType, MasterDataType>> = {
  VEHICLE_MODEL: "VEHICLE_MAKE",
};
