import * as XLSX from "xlsx";

export interface ExcelRow {
  [key: string]: string | number | null | undefined;
}

export interface ColumnMapping {
  excelColumn: string;
  systemField: string;
}

export const SYSTEM_FIELDS = [
  { key: "name", label: "Product Name", required: true },
  { key: "sku", label: "SKU", required: false },
  { key: "hsnCode", label: "HSN Code", required: false },
  { key: "category", label: "Category", required: false },
  { key: "quantity", label: "Quantity", required: false },
  { key: "unit", label: "Unit", required: false },
  { key: "unitPrice", label: "Unit Price (Cost)", required: false },
  { key: "taxPercent", label: "Tax %", required: false },
  { key: "mrp", label: "MRP", required: false },
  { key: "sellingPrice", label: "Selling Price", required: false },
  { key: "distributor", label: "Distributor/Supplier", required: false },
  { key: "stock", label: "Current Stock", required: false },
];

// Known Excel column names from the shop's current spreadsheet
const AUTO_MAP: Record<string, string> = {
  "description of goods": "name",
  "hsn code": "hsnCode",
  category: "category",
  quantity: "quantity",
  unit: "unit",
  "unit price": "unitPrice",
  "tax %": "taxPercent",
  mrp: "mrp",
  "our price": "sellingPrice",
  price: "sellingPrice",
  distributors: "distributor",
  stock: "stock",
  "sold quantity": "skip",
  "si no": "skip",
  "taxable amount": "skip",
  "unit price gst inc": "skip",
  cgst: "skip",
  sgst: "skip",
};

/**
 * Parse an Excel file and return rows + column headers.
 */
export function parseExcelFile(buffer: ArrayBuffer): {
  headers: string[];
  rows: ExcelRow[];
} {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: null });

  if (jsonData.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = Object.keys(jsonData[0]);
  return { headers, rows: jsonData };
}

/**
 * Auto-detect column mappings based on known column names.
 * Shows ALL columns — user can set unmapped ones to "Skip" manually.
 */
export function autoDetectMappings(headers: string[]): ColumnMapping[] {
  return headers.map((header) => {
    const normalized = header.toLowerCase().trim();
    const systemField = AUTO_MAP[normalized];
    // Auto-map known fields, mark "skip" fields as empty, leave unknown as empty
    if (systemField && systemField !== "skip") {
      return { excelColumn: header, systemField };
    }
    return { excelColumn: header, systemField: "" };
  });
}

export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
}

/**
 * Validate mapped data before import.
 */
export function validateImportData(
  rows: ExcelRow[],
  mappings: ColumnMapping[]
): ImportValidationError[] {
  const errors: ImportValidationError[] = [];
  const nameMapping = mappings.find((m) => m.systemField === "name");

  rows.forEach((row, index) => {
    if (nameMapping) {
      const name = row[nameMapping.excelColumn];
      if (!name || String(name).trim() === "") {
        errors.push({
          row: index + 1,
          field: "name",
          message: "Product name is required",
        });
      }
    }
  });

  return errors;
}
