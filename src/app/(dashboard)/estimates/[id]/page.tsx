"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Printer, Send, ShoppingCart, X } from "lucide-react";

interface EstimateData {
  id: string;
  estimateNumber: string;
  date: string;
  validUntil: string;
  grandTotal: string;
  subtotal: string;
  taxTotal: string;
  discountTotal: string;
  gstEnabled: boolean;
  status: string;
  notes: string | null;
  customer: { id: string; name: string; phone: string | null } | null;
  customerName: string | null;
  customerPhone: string | null;
  vehicle: {
    id: string;
    vehicleMake: { name: string };
    vehicleModel: { name: string };
    year: number | null;
    registrationNumber: string | null;
  } | null;
  operator: { name: string };
  invoice: { id: string; invoiceNumber: string } | null;
  items: {
    id: string;
    productId: string | null;
    qty: string;
    unitPrice: string;
    discountAmount: string;
    installationCharge: string;
    lineTotal: string;
    hsnCode: string | null;
    isCustomItem: boolean;
    customItemName: string | null;
    product: { name: string; sku: string; hsnCode: string | null } | null;
  }[];
}

export default function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/estimates/${id}`)
      .then((r) => r.json())
      .then((json) => { setEstimate(json.data); setLoading(false); });
  }, [id]);

  async function updateStatus(status: string) {
    setActionLoading(true);
    const res = await fetch(`/api/estimates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setActionLoading(false);
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed");
      return;
    }
    toast.success(`Status updated to ${status}`);
    // Reload
    const reload = await fetch(`/api/estimates/${id}`);
    const json = await reload.json();
    setEstimate(json.data);
  }

  function convertToInvoice() {
    if (!estimate) return;
    // Build query params with estimate data to pre-fill POS
    const data = {
      estimateId: estimate.id,
      customerId: estimate.customer?.id ?? "",
      vehicleId: estimate.vehicle?.id ?? "",
      items: estimate.items.map((item) => ({
        productId: item.productId,
        isCustomItem: item.isCustomItem ?? !item.productId,
        customItemName: item.customItemName ?? null,
        productName: item.product?.name ?? item.customItemName ?? "Custom Item",
        sku: item.product?.sku ?? "CUSTOM",
        qty: Number(item.qty),
        unitPrice: Number(item.unitPrice),
        discountAmount: Number(item.discountAmount),
        installationCharge: Number(item.installationCharge),
      })),
    };
    // Store in sessionStorage and redirect to billing
    sessionStorage.setItem("estimate_to_invoice", JSON.stringify(data));
    router.push("/billing?fromEstimate=true");
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!estimate) return <p className="text-red-600">Estimate not found</p>;

  const isExpired = (estimate.status === "DRAFT" || estimate.status === "SENT")
    && new Date(estimate.validUntil) < new Date();
  const canSend = estimate.status === "DRAFT";
  const canConvert = estimate.status === "DRAFT" || estimate.status === "SENT";
  const canCancel = estimate.status === "DRAFT" || estimate.status === "SENT";

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <Link href="/estimates" className="text-sm text-blue-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="h-3 w-3" /> Back to Estimates
          </Link>
          <h1 className="text-2xl font-bold">Estimate {estimate.estimateNumber}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={estimate.status === "CONVERTED" ? "default" : estimate.status === "CANCELLED" || estimate.status === "EXPIRED" ? "destructive" : "secondary"}>
              {estimate.status}
            </Badge>
            {isExpired && <Badge variant="destructive">Expired</Badge>}
            {estimate.invoice && (
              <Link href={`/billing/invoices/${estimate.invoice.id}`} className="text-sm text-blue-600">
                → Invoice {estimate.invoice.invoiceNumber}
              </Link>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {canSend && (
            <Button variant="outline" size="sm" disabled={actionLoading} onClick={() => updateStatus("SENT")}>
              <Send className="mr-1 h-4 w-4" /> Mark as Sent
            </Button>
          )}
          {canConvert && (
            <Button size="sm" disabled={actionLoading} onClick={convertToInvoice}>
              <ShoppingCart className="mr-1 h-4 w-4" /> Convert to Invoice
            </Button>
          )}
          {canCancel && (
            <Button variant="destructive" size="sm" disabled={actionLoading} onClick={() => updateStatus("CANCELLED")}>
              <X className="mr-1 h-4 w-4" /> Cancel
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`/api/estimates/${id}/pdf`)}>
            PDF
          </Button>
          {(estimate.customer?.phone || estimate.customerPhone) && (
            <Button variant="outline" size="sm" onClick={() => {
              const link = document.createElement("a");
              link.href = `/api/estimates/${id}/pdf`;
              link.download = `${estimate.estimateNumber}.pdf`;
              link.click();
              setTimeout(() => {
                const phone = (estimate.customer?.phone ?? estimate.customerPhone ?? "").replace(/\D/g, "");
                const fullPhone = phone.startsWith("91") ? phone : `91${phone}`;
                const custName = estimate.customer?.name ?? estimate.customerName ?? "Customer";
                const msg = encodeURIComponent(
                  `Hi ${custName},\n\nHere is your estimate from our shop.\n\nEstimate: ${estimate.estimateNumber}\nAmount: Rs.${Number(estimate.grandTotal).toFixed(0)}\nValid Until: ${new Date(estimate.validUntil).toLocaleDateString("en-IN")}\n\nPlease find the estimate PDF attached.`
                );
                window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
              }, 500);
            }} className="text-green-700 border-green-300 hover:bg-green-50">
              WhatsApp
            </Button>
          )}
        </div>
      </div>

      {/* Estimate Card */}
      <div id="invoice-print">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Mechify — Estimate</CardTitle>
            <Separator className="mt-2" />
            <div className="flex justify-between text-sm mt-2">
              <span>Estimate: <strong>{estimate.estimateNumber}</strong></span>
              <span>Date: {new Date(estimate.date).toLocaleDateString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Valid Until: <strong>{new Date(estimate.validUntil).toLocaleDateString("en-IN")}</strong></span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer + Vehicle */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Customer:</p>
                <p className="font-medium">
                  {estimate.customer?.name ?? estimate.customerName ?? "—"}
                </p>
                {(estimate.customer?.phone ?? estimate.customerPhone) && (
                  <p>{estimate.customer?.phone ?? estimate.customerPhone}</p>
                )}
              </div>
              {estimate.vehicle && (
                <div>
                  <p className="text-gray-500">Vehicle:</p>
                  <p className="font-medium">
                    {estimate.vehicle.vehicleMake.name} {estimate.vehicle.vehicleModel.name}
                    {estimate.vehicle.registrationNumber ? ` (${estimate.vehicle.registrationNumber})` : ""}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Items */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Install</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimate.items.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{item.product?.name ?? "Custom Item"}</p>
                      {item.product && <p className="text-xs text-gray-500">{item.product.sku}</p>}
                    </TableCell>
                    <TableCell className="text-right">{Number(item.qty)}</TableCell>
                    <TableCell className="text-right">Rs.{Number(item.unitPrice).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {Number(item.discountAmount) > 0 ? `Rs.${Number(item.discountAmount).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(item.installationCharge) > 0 ? `Rs.${Number(item.installationCharge).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">Rs.{Number(item.lineTotal).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Separator />

            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>Rs.{Number(estimate.subtotal).toFixed(2)}</span>
                </div>
                {Number(estimate.taxTotal) > 0 && (
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>Rs.{Number(estimate.taxTotal).toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Grand Total:</span>
                  <span>Rs.{Number(estimate.grandTotal).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {estimate.notes && (
              <>
                <Separator />
                <p className="text-sm text-gray-500">Notes: {estimate.notes}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
