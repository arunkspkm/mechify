"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AsyncSelect } from "@/components/shared/async-select";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Printer, ArrowLeft } from "lucide-react";

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  date: string;
  grandTotal: string;
  subtotal: string;
  taxTotal: string;
  discountTotal: string;
  gstEnabled: boolean;
  isCreditSale: boolean;
  amountPaid: string;
  outstandingAmount: string;
  notes: string | null;
  status: string;
  customer: { id: string; name: string; phone: string | null } | null;
  vehicle: {
    vehicleMake: { name: string };
    vehicleModel: { name: string };
    year: number | null;
    registrationNumber: string | null;
  } | null;
  operator: { name: string };
  items: {
    id: string;
    qty: string;
    unitPrice: string;
    discountAmount: string;
    installationCharge: string;
    taxableAmount: string;
    cgstAmount: string;
    sgstAmount: string;
    lineTotal: string;
    hsnCode: string | null;
    isCustomItem: boolean;
    customItemName: string | null;
    batchId: string | null;
    product: { id?: string; name: string; sku: string } | null;
  }[];
  payments: {
    id: string;
    amount: string;
    reference: string | null;
    paymentMethod: { name: string };
  }[];
  returns?: {
    id: string;
    returnNumber: string;
    totalRefund: string;
    status: string;
    createdAt: string;
    processedBy: { name: string } | null;
    items: {
      id: string;
      qty: string;
      productId: string | null;
      unitPrice: string;
      refundAmount: string;
      resolution: string;
      restockable: boolean;
      isCustomItem: boolean;
      customItemName: string | null;
      product: { name: string; sku: string } | null;
      reason: { name: string } | null;
      warrantyStatus: string | null;
      warrantySentAt: string | null;
      warrantyResolvedAt: string | null;
      warrantyNotes: string | null;
      replacementBatchId: string | null;
      replacementGiven: boolean;
    }[];
  }[];
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const router = useRouter();
  const [shopInfo, setShopInfo] = useState({ shopName: "Mechify", shopAddress: "", shopPhone: "" });
  const [loading, setLoading] = useState(true);

  // Return state
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnItems, setReturnItems] = useState<{
    selected: boolean; qty: string; restockable: boolean; resolution: string;
    replacementBatchId: string; replacementBatches: { id: string; name: string; qty: number }[];
    loadingBatches: boolean;
  }[]>([]);
  const [returnReasonId, setReturnReasonId] = useState("");
  const [returnReasons, setReturnReasons] = useState<{ id: string; name: string }[]>([]);
  const [returningItems, setReturningItems] = useState(false);

  // Calculate already-returned qty per invoice item
  function getReturnedQty(itemIndex: number): number {
    if (!invoice?.returns) return 0;
    const item = invoice.items[itemIndex];
    if (!item) return 0;
    let returned = 0;
    for (const ret of invoice.returns) {
      if (ret.status === "REJECTED") continue;
      for (const ri of ret.items) {
        // Warranty items where customer has the product — don't count as returned
        if (ri.resolution === "WARRANTY") {
          const resolved = ri.warrantyStatus === "REPLACEMENT_RECEIVED" || ri.warrantyStatus === "REPAIRED";
          if (resolved || ri.replacementGiven) continue;
        }
        const matchProduct = item.product?.id && ri.productId && item.product.id === ri.productId;
        const matchCustom = item.isCustomItem && ri.isCustomItem && item.customItemName === ri.customItemName;
        if (matchProduct || matchCustom) {
          returned += Number(ri.qty);
        }
      }
    }
    return returned;
  }

  function getReturnableQty(itemIndex: number): number {
    if (!invoice) return 0;
    return Math.max(0, Number(invoice.items[itemIndex].qty) - getReturnedQty(itemIndex));
  }

  useEffect(() => {
    fetch(`/api/billing/invoices/${id}`)
      .then((r) => r.json())
      .then((json) => {
        setInvoice(json.data);
        if (json.data) {
          setReturnItems(json.data.items.map(() => ({
            selected: false, qty: "1", restockable: true, resolution: "REFUND",
            replacementBatchId: "", replacementBatches: [], loadingBatches: false,
          })));
        }
        setLoading(false);
      });
    fetch("/api/master-data?type=RETURN_REASON").then((r) => r.json()).then((j) => setReturnReasons(j.data ?? []));
    fetch("/api/settings").then((r) => r.ok ? r.json() : null).then((json) => {
      if (json?.data) setShopInfo({
        shopName: json.data.shopName ?? "Mechify",
        shopAddress: json.data.shopAddress ?? "",
        shopPhone: json.data.shopPhone ?? "",
      });
    }).catch(() => {});
  }, [id]);

  async function loadReplacementBatches(idx: number, productId: string) {
    const updated = [...returnItems];
    updated[idx] = { ...updated[idx], loadingBatches: true };
    setReturnItems(updated);
    try {
      const res = await fetch(`/api/products/${productId}`);
      const json = await res.json();
      const batches = (json.data?.batches ?? [])
        .filter((b: { qtyRemaining: string }) => Number(b.qtyRemaining) > 0)
        .map((b: { id: string; batchNumber: string | null; qtyRemaining: string }) => ({
          id: b.id,
          name: `${b.batchNumber ?? "No #"} (Qty: ${Number(b.qtyRemaining)})`,
          qty: Number(b.qtyRemaining),
        }));
      const updated2 = [...returnItems];
      updated2[idx] = { ...updated2[idx], replacementBatches: batches, loadingBatches: false };
      setReturnItems(updated2);
    } catch {
      const updated2 = [...returnItems];
      updated2[idx] = { ...updated2[idx], loadingBatches: false };
      setReturnItems(updated2);
    }
  }

  async function handleCreateReturn() {
    if (!invoice) return;
    setReturningItems(true);

    const selectedItems = invoice.items
      .map((item, idx) => ({ item, ri: returnItems[idx] }))
      .filter(({ ri }) => ri?.selected && Number(ri.qty) > 0)
      .map(({ item, ri }) => {
        // Effective price = what customer actually paid per unit (after discount, before tax)
        const qty = Number(item.qty);
        const effectiveUnitPrice = qty > 0
          ? (Number(item.unitPrice) * qty - Number(item.discountAmount)) / qty
          : Number(item.unitPrice);
        return {
          productId: item.isCustomItem ? null : item.product?.id ?? null,
          batchId: item.batchId ?? null,
          qty: Number(ri.qty),
          unitPrice: effectiveUnitPrice,
          reasonId: returnReasonId,
          resolution: ri.resolution as "REFUND" | "REPLACE" | "CREDIT" | "WARRANTY",
          restockable: ri.restockable,
          isCustomItem: item.isCustomItem,
          customItemName: item.customItemName,
          replacementBatchId: (ri.resolution === "WARRANTY" || ri.resolution === "REPLACE") ? (ri.replacementBatchId || null) : null,
        };
      });

    const res = await fetch("/api/returns/customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: id, items: selectedItems }),
    });

    setReturningItems(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to create return");
      return;
    }

    const json = await res.json();
    toast.success(`Return ${json.data.returnNumber} created — pending approval`);
    setReturnOpen(false);
    router.push("/returns");
  }

  if (loading) return <p className="text-gray-500">Loading invoice...</p>;
  if (!invoice) return <p className="text-red-600">Invoice not found</p>;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header — hidden when printing */}
      <div className="flex items-center justify-between no-print">
        <div>
          <Link href="/billing/invoices" className="text-sm text-blue-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="h-3 w-3" /> Back to Invoices
          </Link>
          <h1 className="text-2xl font-bold">Invoice {invoice.invoiceNumber}</h1>
          <p className="text-sm text-gray-500">
            {new Date(invoice.date).toLocaleDateString("en-IN", {
              day: "2-digit", month: "short", year: "numeric",
            })}
            {" • "}Billed by: {invoice.operator.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" onClick={() => window.open(`/api/billing/invoices/${id}/pdf`)}>
            <ArrowLeft className="mr-1 h-4 w-4 rotate-[-90deg]" /> PDF
          </Button>
          {invoice.customer?.phone && (
            <Button variant="outline" onClick={() => {
              // Download PDF first
              const link = document.createElement("a");
              link.href = `/api/billing/invoices/${id}/pdf`;
              link.download = `${invoice.invoiceNumber}.pdf`;
              link.click();
              // Open WhatsApp with pre-filled message after short delay
              setTimeout(() => {
                const phone = invoice.customer!.phone!.replace(/\D/g, "");
                const fullPhone = phone.startsWith("91") ? phone : `91${phone}`;
                const msg = encodeURIComponent(
                  `Hi ${invoice.customer!.name},\n\nThank you for your purchase at ${shopInfo.shopName}!\n\nInvoice: ${invoice.invoiceNumber}\nAmount: Rs.${Number(invoice.grandTotal).toFixed(0)}\nDate: ${new Date(invoice.date).toLocaleDateString("en-IN")}\n\nPlease find the invoice PDF attached.`
                );
                window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
              }, 500);
            }} className="text-green-700 border-green-300 hover:bg-green-50">
              WhatsApp
            </Button>
          )}
        </div>
      </div>

      {/* Print-optimized invoice */}
      <div id="invoice-print" className="print:p-0">
        <Card>
          <CardHeader className="text-center print:pb-2">
            <CardTitle className="text-xl">{shopInfo.shopName}</CardTitle>
            {shopInfo.shopAddress && <p className="text-xs text-gray-500">{shopInfo.shopAddress}</p>}
            {shopInfo.shopPhone && <p className="text-xs text-gray-500">Ph: {shopInfo.shopPhone}</p>}
            <Separator className="mt-2" />
            <div className="flex justify-between text-sm mt-2">
              <span>Invoice: <strong>{invoice.invoiceNumber}</strong></span>
              <span>Date: {new Date(invoice.date).toLocaleDateString("en-IN")}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer + Vehicle Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Customer:</p>
                <p className="font-medium">{invoice.customer?.name ?? "Walk-in Customer"}</p>
                {invoice.customer?.phone && <p>{invoice.customer.phone}</p>}
              </div>
              {invoice.vehicle && (
                <div>
                  <p className="text-gray-500">Vehicle:</p>
                  <p className="font-medium">
                    {invoice.vehicle.vehicleMake.name} {invoice.vehicle.vehicleModel.name}
                    {invoice.vehicle.year ? ` (${invoice.vehicle.year})` : ""}
                  </p>
                  {invoice.vehicle.registrationNumber && (
                    <p>{invoice.vehicle.registrationNumber}</p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Line Items */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Product</TableHead>
                  {invoice.gstEnabled && <TableHead>HSN</TableHead>}
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Install</TableHead>
                  {invoice.gstEnabled && <TableHead className="text-right">Tax</TableHead>}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">
                        {item.isCustomItem ? item.customItemName : item.product?.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.isCustomItem ? "Custom Item" : item.product?.sku}
                      </p>
                    </TableCell>
                    {invoice.gstEnabled && (
                      <TableCell className="text-xs">{item.hsnCode ?? "—"}</TableCell>
                    )}
                    <TableCell className="text-right">{Number(item.qty)}</TableCell>
                    <TableCell className="text-right">Rs.{Number(item.unitPrice).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {Number(item.discountAmount) > 0 ? `Rs.${Number(item.discountAmount).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(item.installationCharge) > 0 ? `Rs.${Number(item.installationCharge).toFixed(2)}` : "—"}
                    </TableCell>
                    {invoice.gstEnabled && (
                      <TableCell className="text-right text-xs">
                        {Number(item.cgstAmount) > 0 && (
                          <span>CGST: {Number(item.cgstAmount).toFixed(2)}<br />SGST: {Number(item.sgstAmount).toFixed(2)}</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-medium">
                      Rs.{Number(item.lineTotal).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Separator />

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>Rs.{Number(invoice.subtotal).toFixed(2)}</span>
                </div>
                {Number(invoice.discountTotal) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span>-Rs.{Number(invoice.discountTotal).toFixed(2)}</span>
                  </div>
                )}
                {invoice.gstEnabled && Number(invoice.taxTotal) > 0 && (
                  <div className="flex justify-between">
                    <span>Tax (GST):</span>
                    <span>Rs.{Number(invoice.taxTotal).toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Grand Total:</span>
                  <span>Rs.{Number(invoice.grandTotal).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <Separator />
            <div className="text-sm">
              <p className="font-medium mb-2">Payment:</p>
              {invoice.payments.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span>{p.paymentMethod.name}{p.reference ? ` (Ref: ${p.reference})` : ""}</span>
                  <span>Rs.{Number(p.amount).toFixed(2)}</span>
                </div>
              ))}
              {invoice.isCreditSale && Number(invoice.outstandingAmount) > 0 && (
                <div className="flex justify-between text-red-600 font-medium mt-1">
                  <span>Outstanding:</span>
                  <span>Rs.{Number(invoice.outstandingAmount).toFixed(2)}</span>
                </div>
              )}
            </div>

            {invoice.notes && (
              <>
                <Separator />
                <p className="text-sm text-gray-500">Notes: {invoice.notes}</p>
              </>
            )}

            {/* Status + Actions */}
            <div className="flex gap-2 items-center no-print">
              <Badge>{invoice.status}</Badge>
              {invoice.isCreditSale && <Badge variant="destructive">Credit Sale</Badge>}
              {invoice.isCreditSale && Number(invoice.outstandingAmount) > 0 && invoice.customer && (
                <Link href={`/customers/${invoice.customer.id}`}>
                  <Button size="sm" variant="outline">
                    Collect Payment → Customer Profile
                  </Button>
                </Link>
              )}
              {(invoice.status === "COMPLETED" || invoice.status === "PARTIALLY_RETURNED") && (
                <Button size="sm" variant="outline" onClick={() => setReturnOpen(true)}>
                  Return Items
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Return History */}
      {invoice.returns && invoice.returns.length > 0 && (
        <Card className="no-print">
          <CardHeader><CardTitle>Return History</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {invoice.returns.map((ret) => (
              <div key={ret.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-sm">{ret.returnNumber}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {new Date(ret.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge variant={ret.status === "APPROVED" ? "default" : ret.status === "REJECTED" ? "destructive" : "secondary"}>
                      {ret.status}
                    </Badge>
                    <span className="text-sm font-medium text-red-600">Rs.{Number(ret.totalRefund).toFixed(0)}</span>
                  </div>
                </div>
                {ret.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={async () => {
                      const res = await fetch(`/api/returns/customer/${ret.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "approve" }),
                      });
                      if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed"); return; }
                      toast.success("Return approved");
                      // Reload invoice
                      const reload = await fetch(`/api/billing/invoices/${id}`);
                      const json = await reload.json();
                      setInvoice(json.data);
                    }}>
                      Approve Return
                    </Button>
                    <Button size="sm" variant="destructive" onClick={async () => {
                      const res = await fetch(`/api/returns/customer/${ret.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "reject" }),
                      });
                      if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed"); return; }
                      toast.success("Return rejected");
                      const reload = await fetch(`/api/billing/invoices/${id}`);
                      const json = await reload.json();
                      setInvoice(json.data);
                    }}>
                      Reject
                    </Button>
                  </div>
                )}
                {ret.processedBy && (
                  <p className="text-xs text-gray-400">Processed by: {ret.processedBy.name}</p>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Refund</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Resolution</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ret.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">
                          {item.isCustomItem ? item.customItemName : item.product?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">{Number(item.qty)}</TableCell>
                        <TableCell className="text-right">
                          {Number(item.refundAmount) > 0
                            ? <span className="text-red-600">Rs.{Number(item.refundAmount).toFixed(0)}</span>
                            : <span className="text-gray-400">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{item.reason?.name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {item.resolution}{item.restockable ? " (Restocked)" : ""}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Warranty tracking for warranty items */}
                {ret.items.some((item) => item.resolution === "WARRANTY") && ret.status === "APPROVED" && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-600">Warranty Tracking</p>
                    {ret.items.filter((item) => item.resolution === "WARRANTY").map((item) => {
                      const statusColors: Record<string, string> = {
                        SENT_FOR_WARRANTY: "bg-amber-100 text-amber-800",
                        REPLACEMENT_RECEIVED: "bg-green-100 text-green-800",
                        REPAIRED: "bg-blue-100 text-blue-800",
                        REJECTED_BY_SUPPLIER: "bg-red-100 text-red-800",
                      };
                      const statusLabels: Record<string, string> = {
                        SENT_FOR_WARRANTY: "Sent for Warranty",
                        REPLACEMENT_RECEIVED: "Replacement Received",
                        REPAIRED: "Repaired & Returned",
                        REJECTED_BY_SUPPLIER: "Rejected by Supplier",
                      };
                      return (
                        <div key={item.id} className="border rounded p-2 space-y-1.5 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{item.product?.name ?? item.customItemName ?? "—"} (×{Number(item.qty)})</span>
                            <div className="flex gap-1.5 items-center">
                              {item.replacementGiven && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                  Replacement Given
                                </span>
                              )}
                              {item.warrantyStatus && (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[item.warrantyStatus] ?? ""}`}>
                                  {statusLabels[item.warrantyStatus] ?? item.warrantyStatus}
                                </span>
                              )}
                            </div>
                          </div>
                          {item.replacementGiven && (
                            <p className="text-xs text-blue-600">
                              Replacement from stock given to customer. Defective item {item.warrantyStatus === "SENT_FOR_WARRANTY" ? "sent to supplier." : item.warrantyStatus ? "resolved." : "pending send to supplier."}
                            </p>
                          )}
                          {!item.replacementGiven && (
                            <p className="text-xs text-amber-600">
                              Sent for repair — no replacement given. Customer waiting.
                            </p>
                          )}
                          {item.warrantySentAt && (
                            <p className="text-xs text-gray-400">
                              Sent: {new Date(item.warrantySentAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              {item.warrantyResolvedAt && (
                                <> — Resolved: {new Date(item.warrantyResolvedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</>
                              )}
                            </p>
                          )}
                          {item.warrantyNotes && (
                            <p className="text-xs text-gray-500">Notes: {item.warrantyNotes}</p>
                          )}
                          {/* Status update buttons — only if not resolved */}
                          {(!item.warrantyStatus || item.warrantyStatus === "SENT_FOR_WARRANTY") && (
                            <div className="flex gap-1 pt-1">
                              {[
                                { status: "REPLACEMENT_RECEIVED", label: "Replacement Received", color: "text-green-700" },
                                { status: "REPAIRED", label: "Repaired", color: "text-blue-700" },
                                { status: "REJECTED_BY_SUPPLIER", label: "Rejected", color: "text-red-700" },
                              ].map((opt) => (
                                <Button key={opt.status} variant="outline" size="sm" className={`text-xs h-7 ${opt.color}`}
                                  onClick={async () => {
                                    const notes = opt.status === "REJECTED_BY_SUPPLIER"
                                      ? prompt("Rejection reason?") ?? ""
                                      : "";
                                    const res = await fetch(`/api/returns/customer/item/${item.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ warrantyStatus: opt.status, warrantyNotes: notes || null }),
                                    });
                                    if (!res.ok) {
                                      const err = await res.json().catch(() => ({}));
                                      toast.error(err.error || "Failed");
                                      return;
                                    }
                                    toast.success(`Warranty status updated: ${opt.label}`);
                                    // Reload invoice
                                    const reload = await fetch(`/api/billing/invoices/${id}`);
                                    const json = await reload.json();
                                    setInvoice(json.data);
                                  }}>
                                  {opt.label}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Return Items Dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Return Items — {invoice.invoiceNumber}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-64 overflow-auto">
            {invoice.items.map((item, idx) => {
              const returnable = getReturnableQty(idx);
              const alreadyReturned = getReturnedQty(idx);
              if (returnable <= 0) {
                return (
                  <div key={item.id} className="flex items-center gap-3 text-sm border rounded p-2 opacity-40">
                    <div className="flex-1">
                      <p className="font-medium line-through">{item.isCustomItem ? item.customItemName : item.product?.name}</p>
                      <p className="text-xs text-gray-500">Fully returned ({alreadyReturned} of {Number(item.qty)})</p>
                    </div>
                  </div>
                );
              }
              return (
                <div key={item.id} className="flex items-center gap-3 text-sm border rounded p-2">
                  <Checkbox
                    checked={returnItems[idx]?.selected ?? false}
                    onCheckedChange={(checked) => {
                      const updated = [...returnItems];
                      updated[idx] = { ...updated[idx], selected: !!checked, qty: String(returnable) };
                      setReturnItems(updated);
                    }}
                  />
                  <div className="flex-1">
                    <p className="font-medium">{item.isCustomItem ? item.customItemName : item.product?.name}</p>
                    <p className="text-xs text-gray-500">
                      {alreadyReturned > 0
                        ? `${returnable} of ${Number(item.qty)} remaining`
                        : `Qty: ${Number(item.qty)}`}
                      {" × Rs."}{Number(item.unitPrice)}
                      {Number(item.discountAmount) > 0 && (
                        <span className="text-green-600"> (disc: Rs.{Number(item.discountAmount)})</span>
                      )}
                    </p>
                  </div>
                  {returnItems[idx]?.selected && (
                    <div className="space-y-1.5">
                      <div className="flex gap-2 items-center">
                        <Input type="number" min="1" max={returnable}
                          value={returnItems[idx]?.qty ?? ""}
                          onChange={(e) => {
                            const updated = [...returnItems];
                            const val = Math.min(Number(e.target.value) || 0, returnable);
                            updated[idx] = { ...updated[idx], qty: String(val || e.target.value) };
                            setReturnItems(updated);
                          }}
                          className="w-16 h-7 text-xs" placeholder="Qty" />
                        {returnItems[idx]?.resolution !== "WARRANTY" && returnItems[idx]?.resolution !== "REPLACE" && (
                          <label className="flex items-center gap-1 text-xs">
                            <Checkbox
                              checked={returnItems[idx]?.restockable ?? false}
                              onCheckedChange={(checked) => {
                                const updated = [...returnItems];
                                updated[idx] = { ...updated[idx], restockable: !!checked };
                                setReturnItems(updated);
                              }}
                            />
                            Restock
                          </label>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {(["REFUND", "WARRANTY", "REPLACE", "CREDIT"] as const).map((r) => (
                          <button key={r} type="button"
                            className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                              returnItems[idx]?.resolution === r
                                ? "bg-gray-900 text-white border-gray-900"
                                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                            }`}
                            onClick={() => {
                              const updated = [...returnItems];
                              // Auto-disable restock for warranty/replace
                              const restockable = (r === "WARRANTY" || r === "REPLACE") ? false : updated[idx].restockable;
                              updated[idx] = { ...updated[idx], resolution: r, restockable };
                              setReturnItems(updated);
                              // Load replacement batches when switching to WARRANTY or REPLACE
                              if ((r === "WARRANTY" || r === "REPLACE") && item.product?.id && updated[idx].replacementBatches.length === 0) {
                                loadReplacementBatches(idx, item.product.id);
                              }
                            }}
                          >
                            {r === "WARRANTY" ? "Warranty" : r === "REFUND" ? "Refund" : r === "REPLACE" ? "Replace" : "Credit"}
                          </button>
                        ))}
                      </div>
                      {/* Pick replacement batch for WARRANTY or REPLACE */}
                      {(returnItems[idx]?.resolution === "WARRANTY" || returnItems[idx]?.resolution === "REPLACE") && !item.isCustomItem && item.product?.id && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-gray-500">
                            {returnItems[idx]?.resolution === "WARRANTY" ? "Give replacement from stock now?" : "Select replacement batch:"}
                          </p>
                          {returnItems[idx].loadingBatches ? (
                            <p className="text-[10px] text-gray-400">Loading batches...</p>
                          ) : returnItems[idx].replacementBatches.length === 0 ? (
                            <p className="text-[10px] text-red-500">No stock available for replacement</p>
                          ) : (
                            <div className="flex gap-1 flex-wrap">
                              {returnItems[idx]?.resolution === "WARRANTY" && (
                                <button type="button"
                                  className={`px-2 py-0.5 rounded text-[10px] border ${
                                    !returnItems[idx].replacementBatchId
                                      ? "bg-amber-100 text-amber-800 border-amber-300"
                                      : "bg-white text-gray-400 border-gray-200"
                                  }`}
                                  onClick={() => {
                                    const updated = [...returnItems];
                                    updated[idx] = { ...updated[idx], replacementBatchId: "" };
                                    setReturnItems(updated);
                                  }}>
                                  Send for repair (no replacement)
                                </button>
                              )}
                              {returnItems[idx].replacementBatches.map((b) => (
                                <button key={b.id} type="button"
                                  className={`px-2 py-0.5 rounded text-[10px] border ${
                                    returnItems[idx].replacementBatchId === b.id
                                      ? "bg-green-100 text-green-800 border-green-300"
                                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                                  }`}
                                  onClick={() => {
                                    const updated = [...returnItems];
                                    updated[idx] = { ...updated[idx], replacementBatchId: b.id };
                                    setReturnItems(updated);
                                  }}>
                                  {b.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Return Reason</Label>
            <AsyncSelect value={returnReasonId} onValueChange={setReturnReasonId}
              options={returnReasons} placeholder="Select reason..." />
          </div>
          {(() => {
            const selectedCount = returnItems.filter((ri) => ri?.selected).length;
            const warrantyCount = returnItems.filter((ri) => ri?.selected && (ri.resolution === "WARRANTY" || ri.resolution === "REPLACE")).length;
            const refundTotal = invoice.items.reduce((sum, item, idx) => {
              const ri = returnItems[idx];
              if (!ri?.selected || Number(ri.qty) <= 0) return sum;
              if (ri.resolution === "WARRANTY" || ri.resolution === "REPLACE") return sum;
              const qty = Number(item.qty);
              const effectiveUnitPrice = qty > 0
                ? (Number(item.unitPrice) * qty - Number(item.discountAmount)) / qty
                : Number(item.unitPrice);
              return sum + effectiveUnitPrice * Number(ri.qty);
            }, 0);
            return selectedCount > 0 ? (
              <div className="border-t pt-3 space-y-1">
                {refundTotal > 0 && (
                  <div className="flex justify-between items-center font-medium">
                    <span>Refund to Customer:</span>
                    <span className="text-lg text-red-600">Rs.{refundTotal.toFixed(2)}</span>
                  </div>
                )}
                {warrantyCount > 0 && (
                  <p className="text-xs text-amber-600">
                    {warrantyCount} item(s) marked for warranty/replacement — no refund
                  </p>
                )}
                {refundTotal === 0 && warrantyCount > 0 && (
                  <p className="text-sm font-medium text-gray-600">No refund — warranty/replacement only</p>
                )}
              </div>
            ) : null;
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateReturn} disabled={returningItems || !returnReasonId || !returnItems.some((i) => i.selected)}>
              {returningItems ? "Processing..." : "Create Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
