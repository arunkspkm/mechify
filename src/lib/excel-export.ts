import * as XLSX from "xlsx";

/**
 * Generate an Excel workbook from an array of objects and return as a Buffer.
 */
export function generateExcel(
  data: Record<string, unknown>[],
  sheetName = "Sheet1"
): Buffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto-size columns
  const colWidths = Object.keys(data[0] ?? {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...data.map((row) => String(row[key] ?? "").length)
    ),
  }));
  worksheet["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}
