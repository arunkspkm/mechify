import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateExcel } from "@/lib/excel-export";

// GET /api/reports/gst?from=&to=&format=json|excel&sheet=b2c|hsn|summary
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "OWNER" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format") ?? "json";
  const sheet = searchParams.get("sheet") ?? "all";

  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to + "T23:59:59");

  try {
    // Fetch GST-enabled invoices with items
    const invoices = await prisma.invoice.findMany({
      where: {
        gstEnabled: true,
        status: { not: "CANCELLED" },
        ...(from || to ? { date: dateFilter } : {}),
      },
      include: {
        customer: { select: { name: true, phone: true } },
        items: {
          select: {
            qty: true, unitPrice: true, discountAmount: true,
            taxableAmount: true,
            cgstRate: true, cgstAmount: true,
            sgstRate: true, sgstAmount: true,
            igstRate: true, igstAmount: true,
            lineTotal: true, hsnCode: true,
            isCustomItem: true, customItemName: true,
            product: { select: { name: true, sku: true } },
          },
        },
      },
      orderBy: { date: "asc" },
    });

    // ========== B2C Summary (GSTR-1 Table 7) ==========
    // Group by tax rate slab
    const b2cMap: Record<string, {
      taxRate: number; taxableValue: number;
      cgst: number; sgst: number; igst: number; totalTax: number;
      invoiceCount: number;
    }> = {};

    for (const inv of invoices) {
      for (const item of inv.items) {
        const totalRate = Number(item.cgstRate) + Number(item.sgstRate) + Number(item.igstRate);
        const key = String(totalRate);
        if (!b2cMap[key]) {
          b2cMap[key] = { taxRate: totalRate, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, invoiceCount: 0 };
        }
        b2cMap[key].taxableValue += Number(item.taxableAmount);
        b2cMap[key].cgst += Number(item.cgstAmount);
        b2cMap[key].sgst += Number(item.sgstAmount);
        b2cMap[key].igst += Number(item.igstAmount);
        b2cMap[key].totalTax += Number(item.cgstAmount) + Number(item.sgstAmount) + Number(item.igstAmount);
      }
    }

    // Count unique invoices per slab
    for (const inv of invoices) {
      const rates = new Set(inv.items.map((i) => String(Number(i.cgstRate) + Number(i.sgstRate) + Number(i.igstRate))));
      for (const r of rates) {
        if (b2cMap[r]) b2cMap[r].invoiceCount++;
      }
    }

    const b2cSummary = Object.values(b2cMap).sort((a, b) => a.taxRate - b.taxRate);

    // ========== HSN Summary (GSTR-1 Table 12) ==========
    const hsnMap: Record<string, {
      hsnCode: string; description: string;
      qty: number; taxableValue: number; totalValue: number;
      cgst: number; sgst: number; igst: number; totalTax: number;
      taxRate: number;
    }> = {};

    for (const inv of invoices) {
      for (const item of inv.items) {
        const hsn = item.hsnCode ?? "N/A";
        const desc = item.isCustomItem ? (item.customItemName ?? "Custom") : (item.product?.name ?? "Unknown");
        const totalRate = Number(item.cgstRate) + Number(item.sgstRate) + Number(item.igstRate);
        const key = `${hsn}-${totalRate}`;

        if (!hsnMap[key]) {
          hsnMap[key] = {
            hsnCode: hsn, description: desc,
            qty: 0, taxableValue: 0, totalValue: 0,
            cgst: 0, sgst: 0, igst: 0, totalTax: 0,
            taxRate: totalRate,
          };
        }
        hsnMap[key].qty += Number(item.qty);
        hsnMap[key].taxableValue += Number(item.taxableAmount);
        hsnMap[key].totalValue += Number(item.lineTotal);
        hsnMap[key].cgst += Number(item.cgstAmount);
        hsnMap[key].sgst += Number(item.sgstAmount);
        hsnMap[key].igst += Number(item.igstAmount);
        hsnMap[key].totalTax += Number(item.cgstAmount) + Number(item.sgstAmount) + Number(item.igstAmount);
      }
    }

    const hsnSummary = Object.values(hsnMap).sort((a, b) => a.hsnCode.localeCompare(b.hsnCode));

    // ========== Overall Summary ==========
    const totalTaxableValue = b2cSummary.reduce((s, r) => s + r.taxableValue, 0);
    const totalCGST = b2cSummary.reduce((s, r) => s + r.cgst, 0);
    const totalSGST = b2cSummary.reduce((s, r) => s + r.sgst, 0);
    const totalIGST = b2cSummary.reduce((s, r) => s + r.igst, 0);
    const totalTax = totalCGST + totalSGST + totalIGST;
    const totalInvoices = invoices.length;

    // ========== Invoice-level detail ==========
    const invoiceDetails = invoices.map((inv) => {
      const itemTax = inv.items.reduce((s, i) => s + Number(i.cgstAmount) + Number(i.sgstAmount) + Number(i.igstAmount), 0);
      const taxable = inv.items.reduce((s, i) => s + Number(i.taxableAmount), 0);
      return {
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        customer: inv.customer?.name ?? "Walk-in",
        taxableValue: taxable,
        cgst: inv.items.reduce((s, i) => s + Number(i.cgstAmount), 0),
        sgst: inv.items.reduce((s, i) => s + Number(i.sgstAmount), 0),
        igst: inv.items.reduce((s, i) => s + Number(i.igstAmount), 0),
        totalTax: itemTax,
        grandTotal: Number(inv.grandTotal),
      };
    });

    // ========== Excel Export ==========
    if (format === "excel") {
      const rows: Record<string, unknown>[] = [];

      // Sheet: Summary
      if (sheet === "all" || sheet === "summary") {
        rows.push({ "Section": "=== GST SUMMARY ===" });
        rows.push({ "Section": "Total Invoices", "Value": totalInvoices });
        rows.push({ "Section": "Taxable Value", "Value": totalTaxableValue.toFixed(2) });
        rows.push({ "Section": "CGST", "Value": totalCGST.toFixed(2) });
        rows.push({ "Section": "SGST", "Value": totalSGST.toFixed(2) });
        rows.push({ "Section": "IGST", "Value": totalIGST.toFixed(2) });
        rows.push({ "Section": "Total Tax", "Value": totalTax.toFixed(2) });
        rows.push({ "Section": "" });
      }

      // Sheet: B2C
      if (sheet === "all" || sheet === "b2c") {
        rows.push({ "Section": "=== B2C SUMMARY (GSTR-1 Table 7) ===" });
        for (const r of b2cSummary) {
          rows.push({
            "Tax Rate (%)": r.taxRate,
            "Taxable Value": r.taxableValue.toFixed(2),
            "CGST": r.cgst.toFixed(2),
            "SGST": r.sgst.toFixed(2),
            "IGST": r.igst.toFixed(2),
            "Total Tax": r.totalTax.toFixed(2),
            "Invoices": r.invoiceCount,
          });
        }
        rows.push({ "Section": "" });
      }

      // Sheet: HSN
      if (sheet === "all" || sheet === "hsn") {
        rows.push({ "Section": "=== HSN SUMMARY (GSTR-1 Table 12) ===" });
        for (const h of hsnSummary) {
          rows.push({
            "HSN Code": h.hsnCode,
            "Description": h.description,
            "Qty": h.qty,
            "Tax Rate (%)": h.taxRate,
            "Taxable Value": h.taxableValue.toFixed(2),
            "CGST": h.cgst.toFixed(2),
            "SGST": h.sgst.toFixed(2),
            "IGST": h.igst.toFixed(2),
            "Total Tax": h.totalTax.toFixed(2),
            "Total Value": h.totalValue.toFixed(2),
          });
        }
        rows.push({ "Section": "" });
      }

      // Sheet: Invoice details
      if (sheet === "all") {
        rows.push({ "Section": "=== INVOICE DETAILS ===" });
        for (const inv of invoiceDetails) {
          rows.push({
            "Invoice #": inv.invoiceNumber,
            "Date": new Date(inv.date).toLocaleDateString("en-IN"),
            "Customer": inv.customer,
            "Taxable Value": inv.taxableValue.toFixed(2),
            "CGST": inv.cgst.toFixed(2),
            "SGST": inv.sgst.toFixed(2),
            "IGST": inv.igst.toFixed(2),
            "Total Tax": inv.totalTax.toFixed(2),
            "Grand Total": inv.grandTotal.toFixed(2),
          });
        }
      }

      const buffer = generateExcel(rows, "GST Report");
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="gst_report_${from ?? "all"}_${to ?? "all"}.xlsx"`,
        },
      });
    }

    return NextResponse.json({
      data: {
        summary: { totalInvoices, totalTaxableValue, totalCGST, totalSGST, totalIGST, totalTax },
        b2cSummary,
        hsnSummary,
        invoiceDetails,
      },
    });
  } catch (err) {
    console.error("GST report error:", err);
    return NextResponse.json({ error: "Failed to generate GST report" }, { status: 500 });
  }
}
