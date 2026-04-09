import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateExcel } from "@/lib/excel-export";

// GET /api/products/import-template — Download Excel template
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sampleRows = [
    {
      "name": "Door Visor AStar Kartier",
      "category": "Exterior",
      "brand": "Kartier",
      "sellingPrice": 668,
      "mrp": 750,
      "stock": 10,
      "unitPrice": 450,
      "distributor": "Foms Auto",
      "unit": "Piece",
      "bundleSize": 1,
      "hsnCode": "87089900",
      "sku": "",
    },
    {
      "name": "Speaker Cable 2.5mm",
      "category": "Wiring & Cables",
      "brand": "Havells",
      "sellingPrice": 17.55,
      "mrp": 20,
      "stock": 3,
      "unitPrice": 650,
      "distributor": "Electrical Mart",
      "unit": "Meter",
      "bundleSize": 50,
      "hsnCode": "85441100",
      "sku": "",
    },
    {
      "name": "4.5D Mat Swift 2018",
      "category": "Interior",
      "brand": "",
      "sellingPrice": 1485,
      "mrp": 0,
      "stock": 5,
      "unitPrice": 950,
      "distributor": "Mat Supplier",
      "unit": "Piece",
      "bundleSize": 1,
      "hsnCode": "",
      "sku": "",
    },
  ];

  // Add a blank row after samples for user data
  const blankRow: Record<string, unknown> = {};
  for (const key of Object.keys(sampleRows[0])) {
    blankRow[key] = "";
  }

  const rows = [...sampleRows, blankRow];

  const buffer = generateExcel(rows, "Product Import");

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mechify_product_import_template.xlsx"`,
    },
  });
}
