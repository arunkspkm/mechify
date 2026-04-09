import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface ShopInfo {
  shopName: string;
  shopAddress?: string | null;
  shopPhone?: string | null;
  gstNumber?: string | null;
}

interface InvoicePDFData {
  invoiceNumber: string;
  date: string;
  customer: { name: string; phone?: string | null } | null;
  vehicle?: { make: string; model: string; regNo?: string | null } | null;
  items: {
    name: string; sku?: string; qty: number; unitPrice: number;
    discount: number; installCharge: number; tax: number; total: number;
    hsnCode?: string | null;
  }[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  gstEnabled: boolean;
  payments: { method: string; amount: number; reference?: string | null }[];
  amountPaid: number;
  outstandingAmount: number;
  isCreditSale: boolean;
  notes?: string | null;
  operator: string;
}

export function generateInvoicePDF(shop: ShopInfo, data: InvoicePDFData): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(shop.shopName, pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  if (shop.shopAddress) { doc.text(shop.shopAddress, pageWidth / 2, y, { align: "center" }); y += 4; }
  if (shop.shopPhone) { doc.text(`Ph: ${shop.shopPhone}`, pageWidth / 2, y, { align: "center" }); y += 4; }
  if (shop.gstNumber) { doc.text(`GSTIN: ${shop.gstNumber}`, pageWidth / 2, y, { align: "center" }); y += 4; }

  // Line
  y += 2;
  doc.setDrawColor(200);
  doc.line(15, y, pageWidth - 15, y);
  y += 5;

  // Invoice info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Invoice: ${data.invoiceNumber}`, 15, y);
  doc.text(`Date: ${new Date(data.date).toLocaleDateString("en-IN")}`, pageWidth - 15, y, { align: "right" });
  y += 6;

  // Customer
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Customer: ${data.customer?.name ?? "Walk-in Customer"}`, 15, y);
  if (data.customer?.phone) {
    doc.text(data.customer.phone, pageWidth - 15, y, { align: "right" });
  }
  y += 5;
  if (data.vehicle) {
    doc.text(`Vehicle: ${data.vehicle.make} ${data.vehicle.model}${data.vehicle.regNo ? ` (${data.vehicle.regNo})` : ""}`, 15, y);
    y += 5;
  }
  y += 2;

  // Items table
  const headers = data.gstEnabled
    ? [["#", "Product", "HSN", "Qty", "Price", "Disc", "Tax", "Total"]]
    : [["#", "Product", "Qty", "Price", "Discount", "Install", "Total"]];

  const body = data.items.map((item, idx) => {
    if (data.gstEnabled) {
      return [
        String(idx + 1), item.name, item.hsnCode ?? "—",
        String(item.qty), `Rs.${item.unitPrice.toFixed(0)}`,
        item.discount > 0 ? `Rs.${item.discount.toFixed(0)}` : "—",
        item.tax > 0 ? `Rs.${item.tax.toFixed(0)}` : "—",
        `Rs.${item.total.toFixed(0)}`,
      ];
    }
    return [
      String(idx + 1), item.name,
      String(item.qty), `Rs.${item.unitPrice.toFixed(0)}`,
      item.discount > 0 ? `Rs.${item.discount.toFixed(0)}` : "—",
      item.installCharge > 0 ? `Rs.${item.installCharge.toFixed(0)}` : "—",
      `Rs.${item.total.toFixed(0)}`,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: headers,
    body,
    theme: "grid",
    headStyles: { fillColor: [50, 50, 50], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: data.gstEnabled
      ? { 0: { cellWidth: 8 }, 1: { cellWidth: 45 }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } }
      : { 0: { cellWidth: 8 }, 1: { cellWidth: 50 }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
    margin: { left: 15, right: 15 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Totals — use right-aligned label + right-aligned value with proper spacing
  const totalsX = pageWidth - 15;
  const labelX = totalsX - 55;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", labelX, y, { align: "right" });
  doc.text(`Rs.${data.subtotal.toFixed(2)}`, totalsX, y, { align: "right" });
  y += 5;

  if (data.discountTotal > 0) {
    doc.setTextColor(0, 128, 0);
    doc.text("Discount:", labelX, y, { align: "right" });
    doc.text(`-Rs.${data.discountTotal.toFixed(2)}`, totalsX, y, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 5;
  }

  if (data.gstEnabled && data.taxTotal > 0) {
    doc.text("Tax (GST):", labelX, y, { align: "right" });
    doc.text(`Rs.${data.taxTotal.toFixed(2)}`, totalsX, y, { align: "right" });
    y += 5;
  }

  doc.line(labelX - 5, y, totalsX, y);
  y += 5;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Grand Total:", labelX, y, { align: "right" });
  doc.text(`Rs.${data.grandTotal.toFixed(2)}`, totalsX, y, { align: "right" });
  y += 8;

  // Payments
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Payment:", 15, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  for (const p of data.payments) {
    doc.text(`${p.method}${p.reference ? ` (Ref: ${p.reference})` : ""}`, 15, y);
    doc.text(`Rs.${p.amount.toFixed(2)}`, totalsX, y, { align: "right" });
    y += 4;
  }

  if (data.isCreditSale && data.outstandingAmount > 0) {
    doc.setTextColor(200, 0, 0);
    doc.text(`Outstanding:`, 15, y);
    doc.text(`Rs.${data.outstandingAmount.toFixed(2)}`, totalsX, y, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 5;
  }

  if (data.notes) {
    y += 3;
    doc.setFontSize(8);
    doc.text(`Notes: ${data.notes}`, 15, y);
    y += 5;
  }

  // Footer
  y += 5;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Billed by: ${data.operator}`, 15, y);
  doc.text("Thank you for your business!", pageWidth / 2, y, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}

interface EstimatePDFData {
  estimateNumber: string;
  date: string;
  validUntil: string;
  customer: { name: string; phone?: string | null } | null;
  customerName?: string | null;
  customerPhone?: string | null;
  items: {
    name: string; qty: number; unitPrice: number;
    discount: number; installCharge: number; tax: number; total: number;
  }[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  gstEnabled: boolean;
  notes?: string | null;
  operator: string;
}

export function generateEstimatePDF(shop: ShopInfo, data: EstimatePDFData): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(shop.shopName, pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  if (shop.shopAddress) { doc.text(shop.shopAddress, pageWidth / 2, y, { align: "center" }); y += 4; }
  if (shop.shopPhone) { doc.text(`Ph: ${shop.shopPhone}`, pageWidth / 2, y, { align: "center" }); y += 4; }

  y += 2;
  doc.setDrawColor(200);
  doc.line(15, y, pageWidth - 15, y);
  y += 5;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("ESTIMATE", pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setFontSize(10);
  doc.text(`Estimate: ${data.estimateNumber}`, 15, y);
  doc.text(`Date: ${new Date(data.date).toLocaleDateString("en-IN")}`, pageWidth - 15, y, { align: "right" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Valid Until: ${new Date(data.validUntil).toLocaleDateString("en-IN")}`, pageWidth - 15, y, { align: "right" });

  const custName = data.customer?.name ?? data.customerName ?? "—";
  const custPhone = data.customer?.phone ?? data.customerPhone ?? "";
  doc.text(`Customer: ${custName}${custPhone ? ` (${custPhone})` : ""}`, 15, y);
  y += 7;

  // Items table
  const body = data.items.map((item, idx) => [
    String(idx + 1), item.name, String(item.qty), `Rs.${item.unitPrice.toFixed(0)}`,
    item.discount > 0 ? `Rs.${item.discount.toFixed(0)}` : "—",
    item.installCharge > 0 ? `Rs.${item.installCharge.toFixed(0)}` : "—",
    `Rs.${item.total.toFixed(0)}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Product", "Qty", "Price", "Discount", "Install", "Total"]],
    body,
    theme: "grid",
    headStyles: { fillColor: [50, 50, 50], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 55 }, 6: { halign: "right" } },
    margin: { left: 15, right: 15 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  const totalsX = pageWidth - 15;
  doc.setFontSize(9);
  doc.text(`Subtotal:`, totalsX - 40, y);
  doc.text(`Rs.${data.subtotal.toFixed(2)}`, totalsX, y, { align: "right" });
  y += 5;

  if (data.discountTotal > 0) {
    doc.text(`Discount:`, totalsX - 40, y);
    doc.text(`-Rs.${data.discountTotal.toFixed(2)}`, totalsX, y, { align: "right" });
    y += 5;
  }

  if (data.gstEnabled && data.taxTotal > 0) {
    doc.text(`Tax:`, totalsX - 40, y);
    doc.text(`Rs.${data.taxTotal.toFixed(2)}`, totalsX, y, { align: "right" });
    y += 5;
  }

  doc.line(totalsX - 45, y, totalsX, y);
  y += 4;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Total:`, totalsX - 40, y);
  doc.text(`Rs.${data.grandTotal.toFixed(2)}`, totalsX, y, { align: "right" });

  if (data.notes) {
    y += 10;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Notes: ${data.notes}`, 15, y);
  }

  y += 10;
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(`Prepared by: ${data.operator}`, 15, y);
  doc.text("This is an estimate. Prices may vary.", pageWidth / 2, y, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}
