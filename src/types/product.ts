import { z } from "zod";

export const productCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional().default(""),
  barcode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  hsnCode: z.string().optional().nullable(),
  categoryId: z.string().min(1, "Category is required"),
  brandId: z.string().optional().nullable(),
  unitId: z.string().min(1, "Unit is required"),
  bundleSize: z.coerce.number().positive().default(1),
  mrp: z.coerce.number().nonnegative("MRP must be non-negative").default(0),
  sellingPrice: z.coerce.number().nonnegative("Selling price must be non-negative"),
  taxRateId: z.string().optional().nullable(),
  installationCharge: z.coerce.number().nonnegative().default(0),
  maxDiscountPercent: z.coerce.number().nonnegative().optional().nullable(),
  lowStockThreshold: z.coerce.number().int().nonnegative().default(1),
  hasExpiry: z.boolean().default(false),
  companionProductIds: z.array(z.string()).optional().default([]),
});

export const productUpdateSchema = productCreateSchema.partial().extend({
  active: z.boolean().optional(),
});

export type ProductCreate = z.infer<typeof productCreateSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;
