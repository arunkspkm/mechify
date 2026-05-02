"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AsyncSelect } from "@/components/shared/async-select";
import { toast } from "sonner";
import { Check, X, RotateCcw, Plus, Trash2, Search } from "lucide-react";

interface CustomerReturnItem {
  id: string;
  qty: string;
  refundAmount: string;
  resolution: string;
  restockable: boolean;
  isCustomItem: boolean;
  customItemName: string | null;
  warrantyStatus: string | null;
  warrantySentAt: string | null;
  warrantyResolvedAt: string | null;
  warrantyNotes: string | null;
  replacementBatchId: string | null;
  replacementGiven: boolean;
  product: { name: string; sku: string } | null;
  reason: { name: string } | null;
}

interface CustomerReturnData {
  id: string;
  returnNumber: string;
  totalRefund: string;
  status: string;
  createdAt: string;
  notes: string | null;
  invoice: { id: string; invoiceNumber: string };
  customer: { name: string; phone: string | null } | null;
  processedBy: { name: string } | null;
  items: CustomerReturnItem[];
  _count: { items: number };
}

interface SupplierReturnItem {
  id: string;
  qty: string;
  unitCost: string;
  totalCost: string;
  reason: string;
  product: { id: string; name: string; sku: string };
  batch: { id: string; batchNumber: string | null };
}

interface SupplierReturnData {
  id: string;
  returnNumber: string;
  totalAmount: string;
  creditReceived: string;
  status: string;
  createdAt: string;
  notes: string | null;
  supplier: { name: string };
  items: SupplierReturnItem[];
  _count: { items: number };
}

const CRET_COLORS: Record<string, "default" | "secondary" | "destructive"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
};

const SRET_COLORS: Record<string, "default" | "secondary" | "destructive"> = {
  INITIATED: "secondary",
  SHIPPED: "default",
  CREDIT_RECEIVED: "default",
  CANCELLED: "destructive",
};

export default function ReturnsPage() {
  const [customerReturns, setCustomerReturns] = useState<CustomerReturnData[]>([]);
  const [supplierReturns, setSupplierReturns] = useState<SupplierReturnData[]>([]);
  const [loading, setLoading] = useState(true);
  const [custStatusFilter, setCustStatusFilter] = useState("all");
  const [supStatusFilter, setSupStatusFilter] = useState("all");
  const [expandedReturn, setExpandedReturn] = useState<string | null>(null);

  // Invoice search for warranty
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceResults, setInvoiceResults] = useState<{
    id: string; invoiceNumber: string; date: string; grandTotal: string;
    customer: { name: string; phone: string | null } | null;
    status: string;
  }[]>([]);
  const [searchingInvoice, setSearchingInvoice] = useState(false);

  // Supplier return creation state
  const [sretOpen, setSretOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [sretSupplierId, setSretSupplierId] = useState("");
  const [sretNotes, setSretNotes] = useState("");
  const [sretProductSearch, setSretProductSearch] = useState("");
  const [sretSearchResults, setSretSearchResults] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [sretItems, setSretItems] = useState<{
    key: number; productId: string; productName: string; batchId: string; batchLabel: string;
    qty: string; unitCost: string; reason: string; supplierId: string; supplierName: string;
  }[]>([]);
  const [sretBatches, setSretBatches] = useState<{ id: string; name: string; qtyRemaining: number; unitCost: number; supplierId: string; supplierName: string }[]>([]);
  const [sretSelectedProductId, setSretSelectedProductId] = useState("");
  const [sretSubmitting, setSretSubmitting] = useState(false);

  let sretKeyCounter = 0;

  function fetchAll() {
    const custParams = custStatusFilter !== "all" ? `?status=${custStatusFilter}` : "";
    const supParams = supStatusFilter !== "all" ? `?status=${supStatusFilter}` : "";
    Promise.all([
      fetch(`/api/returns/customer${custParams}`).then((r) => r.ok ? r.json() : { data: [] }),
      fetch(`/api/returns/supplier${supParams}`).then((r) => r.ok ? r.json() : { data: [] }),
    ]).then(([cr, sr]) => {
      setCustomerReturns(cr.data ?? []);
      setSupplierReturns(sr.data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, [custStatusFilter, supStatusFilter]);

  useEffect(() => {
    fetch("/api/suppliers?limit=50").then((r) => r.json()).then((j) => setSuppliers(j.data ?? []));
  }, []);

  // Search invoices by phone or invoice number
  useEffect(() => {
    if (invoiceSearch.length < 3) { setInvoiceResults([]); setSearchingInvoice(false); return; }
    setSearchingInvoice(true);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/billing/invoices?search=${encodeURIComponent(invoiceSearch)}&limit=5`, { signal: controller.signal });
        if (res.ok) {
          const json = await res.json();
          setInvoiceResults(json.data ?? []);
        }
      } catch { /* aborted */ }
      setSearchingInvoice(false);
    }, 300);
    return () => { clearTimeout(t); controller.abort(); };
  }, [invoiceSearch]);

  // Search products for supplier return
  useEffect(() => {
    if (sretProductSearch.length < 2) { setSretSearchResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(sretProductSearch)}&limit=25`);
      const json = await res.json();
      setSretSearchResults(json.data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [sretProductSearch]);

  async function loadBatchesForProduct(productId: string) {
    setSretSelectedProductId(productId);
    const res = await fetch(`/api/products/${productId}`);
    const json = await res.json();
    const batches = (json.data?.batches ?? []).map((b: { id: string; batchNumber: string | null; qtyRemaining: string; unitCost: string; landedCostPerUnit: string; supplierId: string | null; supplier: { id: string; name: string } | null }) => ({
      id: b.id,
      name: `${b.batchNumber ?? "No #"} — Qty: ${Number(b.qtyRemaining)} — Rs.${Number(b.unitCost).toFixed(2)}${b.supplier ? ` (${b.supplier.name})` : ""}`,
      qtyRemaining: Number(b.qtyRemaining),
      unitCost: Number(b.unitCost),
      supplierId: b.supplierId ?? b.supplier?.id ?? "",
      supplierName: b.supplier?.name ?? "Unknown",
    }));
    setSretBatches(batches);
  }

  function addSretItem(batchId: string) {
    const batch = sretBatches.find((b) => b.id === batchId);
    const product = sretSearchResults.find((p) => p.id === sretSelectedProductId);
    if (!batch || !product) return;

    // Auto-set supplier from first item
    if (!sretSupplierId && batch.supplierId) {
      setSretSupplierId(batch.supplierId);
    }

    // Warn if different supplier than existing items
    if (sretSupplierId && batch.supplierId && batch.supplierId !== sretSupplierId) {
      toast.error("This batch is from a different supplier. Create a separate return for each supplier.");
      return;
    }

    setSretItems((prev) => [...prev, {
      key: ++sretKeyCounter,
      productId: product.id,
      productName: product.name,
      batchId: batch.id,
      batchLabel: batch.name,
      qty: "1",
      unitCost: String(batch.unitCost),
      reason: "Defective",
      supplierId: batch.supplierId,
      supplierName: batch.supplierName,
    }]);
    setSretProductSearch("");
    setSretSearchResults([]);
    setSretBatches([]);
    setSretSelectedProductId("");
  }

  async function handleCreateSupplierReturn() {
    if (!sretSupplierId || sretItems.length === 0) return;
    setSretSubmitting(true);

    const res = await fetch("/api/returns/supplier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId: sretSupplierId,
        items: sretItems.map((i) => ({
          productId: i.productId,
          batchId: i.batchId,
          qty: Number(i.qty),
          unitCost: Number(i.unitCost),
          reason: i.reason,
        })),
        notes: sretNotes || null,
      }),
    });

    setSretSubmitting(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed");
      return;
    }

    const json = await res.json();
    toast.success(`Supplier return ${json.data.returnNumber} created — stock deducted`);
    setSretOpen(false);
    setSretItems([]);
    setSretSupplierId("");
    setSretNotes("");
    fetchAll();
  }

  async function handleCustomerReturnAction(id: string, action: "approve" | "reject") {
    const res = await fetch(`/api/returns/customer/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) { const err = await res.json(); toast.error(err.error); return; }
    const json = await res.json();
    toast.success(json.message);
    // Reload
    fetchAll();
  }

  async function handleSupplierReturnStatus(id: string, status: string, creditAmount?: number) {
    const res = await fetch(`/api/returns/supplier/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateStatus", status, creditAmount }),
    });
    if (!res.ok) { const err = await res.json(); toast.error(err.error); return; }
    const json = await res.json();
    toast.success(json.message);
    fetchAll();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Returns</h1>
          <p className="mt-1 text-sm text-gray-500">Customer and supplier returns</p>
        </div>
      </div>

      {/* Quick Invoice Search */}
      <div className="relative">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Find invoice by phone, name, or invoice number..."
            value={invoiceSearch}
            onChange={(e) => setInvoiceSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {invoiceResults.length > 0 && (
          <div className="absolute z-20 mt-1 w-full max-w-md bg-white border rounded-lg shadow-lg">
            {invoiceResults.map((inv) => (
              <Link key={inv.id} href={`/billing/invoices/${inv.id}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 border-b last:border-b-0"
                onClick={() => { setInvoiceSearch(""); setInvoiceResults([]); }}>
                <div>
                  <p className="font-medium text-sm">{inv.invoiceNumber}</p>
                  <p className="text-xs text-gray-500">
                    {inv.customer?.name ?? "Walk-in"}
                    {inv.customer?.phone && ` · ${inv.customer.phone}`}
                    {" · "}
                    {new Date(inv.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">Rs.{Number(inv.grandTotal).toFixed(0)}</p>
                  <Badge variant={inv.status === "COMPLETED" ? "default" : "secondary"} className="text-[10px]">{inv.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
        {searchingInvoice && <p className="text-xs text-gray-400 mt-1">Searching...</p>}
      </div>

      <Tabs defaultValue="customer">
        <TabsList>
          <TabsTrigger value="customer">
            Customer Returns ({customerReturns.length})
          </TabsTrigger>
          <TabsTrigger value="supplier">
            Supplier Returns ({supplierReturns.length})
          </TabsTrigger>
        </TabsList>

        {/* Customer Returns */}
        <TabsContent value="customer" className="mt-4 space-y-4">
          <AsyncSelect
            value={custStatusFilter}
            onValueChange={(v) => setCustStatusFilter(v ?? "")}
            options={[
              { id: "all", name: "All Statuses" },
              { id: "PENDING", name: "Pending" },
              { id: "APPROVED", name: "Approved" },
              { id: "REJECTED", name: "Rejected" },
            ]}
            placeholder="All Statuses"
            className="w-48"
          />
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Refund</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">Loading...</TableCell></TableRow>
                ) : customerReturns.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    <RotateCcw className="mx-auto h-8 w-8 mb-2 text-gray-300" />
                    No customer returns. Create returns from the Invoice detail page.
                  </TableCell></TableRow>
                ) : customerReturns.map((ret) => {
                  const hasWarranty = ret.items.some((i) => i.resolution === "WARRANTY" || i.resolution === "REPLACE");
                  const isExpanded = expandedReturn === ret.id;
                  return (
                    <React.Fragment key={ret.id}>
                      <TableRow className={hasWarranty ? "cursor-pointer" : ""} onClick={() => hasWarranty && setExpandedReturn(isExpanded ? null : ret.id)}>
                        <TableCell className="font-medium">
                          {ret.returnNumber}
                          {hasWarranty && <Badge variant="secondary" className="ml-1 text-[10px]">W</Badge>}
                        </TableCell>
                        <TableCell className="text-sm">{new Date(ret.createdAt).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell>
                          <Link href={`/billing/invoices/${ret.invoice.id}`} className="text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}>
                            {ret.invoice.invoiceNumber}
                          </Link>
                        </TableCell>
                        <TableCell>{ret.customer?.name ?? "Walk-in"}</TableCell>
                        <TableCell className="text-center">{ret._count.items}</TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(ret.totalRefund) > 0 ? `Rs.${Number(ret.totalRefund).toFixed(0)}` : <span className="text-gray-400">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={CRET_COLORS[ret.status] ?? "secondary"}>{ret.status}</Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {ret.status === "PENDING" && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="text-green-600"
                                onClick={() => handleCustomerReturnAction(ret.id, "approve")}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-600"
                                onClick={() => handleCustomerReturnAction(ret.id, "reject")}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                      {/* Expanded warranty tracking */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-gray-50 p-4">
                            <div className="space-y-3">
                              {ret.items.map((item) => {
                                const isWarranty = item.resolution === "WARRANTY";
                                const statusColors: Record<string, string> = {
                                  SENT_FOR_WARRANTY: "bg-amber-100 text-amber-800",
                                  REPLACEMENT_RECEIVED: "bg-green-100 text-green-800",
                                  REPAIRED: "bg-blue-100 text-blue-800",
                                  REJECTED_BY_SUPPLIER: "bg-red-100 text-red-800",
                                };
                                const statusLabels: Record<string, string> = {
                                  SENT_FOR_WARRANTY: "Sent for Warranty",
                                  REPLACEMENT_RECEIVED: "Replacement Received",
                                  REPAIRED: "Repaired",
                                  REJECTED_BY_SUPPLIER: "Rejected by Supplier",
                                };
                                return (
                                  <div key={item.id} className="flex items-center justify-between border rounded p-2 bg-white text-sm">
                                    <div className="flex-1">
                                      <p className="font-medium">
                                        {item.isCustomItem ? item.customItemName : item.product?.name ?? "—"}
                                        <span className="text-gray-400 ml-1">×{Number(item.qty)}</span>
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {item.reason?.name ?? "—"}
                                        {" · "}
                                        <Badge variant="secondary" className="text-[10px]">{item.resolution}</Badge>
                                        {Number(item.refundAmount) > 0 && ` · Rs.${Number(item.refundAmount).toFixed(0)}`}
                                        {item.replacementGiven && <Badge variant="default" className="text-[10px] ml-1">Replacement Given</Badge>}
                                      </p>
                                      {isWarranty && item.warrantySentAt && (
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                          Sent: {new Date(item.warrantySentAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                          {item.warrantyResolvedAt && <> · Resolved: {new Date(item.warrantyResolvedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</>}
                                          {item.warrantyNotes && <> · {item.warrantyNotes}</>}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isWarranty && item.warrantyStatus && (
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[item.warrantyStatus] ?? "bg-gray-100"}`}>
                                          {statusLabels[item.warrantyStatus] ?? item.warrantyStatus}
                                        </span>
                                      )}
                                      {isWarranty && (!item.warrantyStatus || item.warrantyStatus === "SENT_FOR_WARRANTY") && ret.status === "APPROVED" && (
                                        <div className="flex gap-1">
                                          {[
                                            { s: "REPLACEMENT_RECEIVED", l: "Replaced" },
                                            { s: "REPAIRED", l: "Repaired" },
                                            { s: "REJECTED_BY_SUPPLIER", l: "Rejected" },
                                          ].map((opt) => (
                                            <Button key={opt.s} variant="outline" size="sm" className="text-xs h-6 px-2"
                                              onClick={async () => {
                                                const notes = opt.s === "REJECTED_BY_SUPPLIER" ? prompt("Rejection reason?") ?? "" : "";
                                                const res = await fetch(`/api/returns/customer/item/${item.id}`, {
                                                  method: "PATCH",
                                                  headers: { "Content-Type": "application/json" },
                                                  body: JSON.stringify({ warrantyStatus: opt.s, warrantyNotes: notes || null }),
                                                });
                                                if (!res.ok) { toast.error("Failed to update"); return; }
                                                toast.success(`Updated: ${opt.l}`);
                                                fetchAll();
                                              }}>
                                              {opt.l}
                                            </Button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Supplier Returns */}
        <TabsContent value="supplier" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <AsyncSelect
              value={supStatusFilter}
              onValueChange={(v) => setSupStatusFilter(v ?? "")}
              options={[
                { id: "all", name: "All Statuses" },
                { id: "INITIATED", name: "Initiated" },
                { id: "SHIPPED", name: "Shipped" },
                { id: "CREDIT_RECEIVED", name: "Credit Received" },
                { id: "CANCELLED", name: "Cancelled" },
              ]}
              placeholder="All Statuses"
              className="w-48"
            />
            <Button size="sm" onClick={() => setSretOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> New Supplier Return
            </Button>
          </div>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Credit Received</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">Loading...</TableCell></TableRow>
                ) : supplierReturns.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    <RotateCcw className="mx-auto h-8 w-8 mb-2 text-gray-300" />
                    No supplier returns.
                  </TableCell></TableRow>
                ) : supplierReturns.map((ret) => {
                  const isExpanded = expandedReturn === ret.id;
                  return (
                    <React.Fragment key={ret.id}>
                      <TableRow className="cursor-pointer" onClick={() => setExpandedReturn(isExpanded ? null : ret.id)}>
                        <TableCell className="font-medium">{ret.returnNumber}</TableCell>
                        <TableCell className="text-sm">{new Date(ret.createdAt).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell>{ret.supplier.name}</TableCell>
                        <TableCell className="text-center">{ret._count.items}</TableCell>
                        <TableCell className="text-right">Rs.{Number(ret.totalAmount).toFixed(0)}</TableCell>
                        <TableCell className="text-right text-green-600">
                          {Number(ret.creditReceived) > 0 ? `Rs.${Number(ret.creditReceived).toFixed(0)}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={SRET_COLORS[ret.status] ?? "secondary"}>{ret.status}</Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            {ret.status === "INITIATED" && (
                              <Button size="sm" variant="ghost"
                                onClick={() => handleSupplierReturnStatus(ret.id, "SHIPPED")}>
                                Mark Shipped
                              </Button>
                            )}
                            {ret.status === "SHIPPED" && (
                              <Button size="sm" variant="ghost" className="text-green-600"
                                onClick={() => {
                                  const credit = prompt("Credit amount received:", String(Number(ret.totalAmount)));
                                  if (credit) handleSupplierReturnStatus(ret.id, "CREDIT_RECEIVED", Number(credit));
                                }}>
                                Credit Received
                              </Button>
                            )}
                            {(ret.status === "INITIATED" || ret.status === "SHIPPED") && (
                              <Button size="sm" variant="ghost" className="text-red-600"
                                onClick={() => handleSupplierReturnStatus(ret.id, "CANCELLED")}>
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-gray-50 p-4">
                            <div className="space-y-2">
                              {ret.items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between border rounded p-2 bg-white text-sm">
                                  <div className="flex-1">
                                    <p className="font-medium">
                                      {item.product.name}
                                      <span className="text-gray-400 ml-1">({item.product.sku})</span>
                                      <span className="text-gray-500 ml-2">×{Number(item.qty)}</span>
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Batch: {item.batch.batchNumber ?? "—"}
                                      {" · "}
                                      Rs.{Number(item.unitCost).toFixed(2)}/unit
                                      {" · "}
                                      Reason: {item.reason}
                                    </p>
                                  </div>
                                  <p className="text-sm font-medium">Rs.{Number(item.totalCost).toFixed(0)}</p>
                                </div>
                              ))}
                              {ret.notes && (
                                <p className="text-xs text-gray-500 italic pt-1">Notes: {ret.notes}</p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* New Supplier Return Dialog */}
      <Dialog open={sretOpen} onOpenChange={setSretOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Supplier Return</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Auto-detected supplier */}
            {sretSupplierId ? (
              <div className="p-2 bg-blue-50 rounded-lg border border-blue-200 text-sm">
                <span className="text-blue-800">Supplier: <strong>{sretItems[0]?.supplierName ?? "Detected from batch"}</strong></span>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Supplier will be auto-detected from the batch you select.</p>
            )}

            {/* Search and add products */}
            <div className="space-y-2">
              <Label>Add Product</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input value={sretProductSearch} onChange={(e) => setSretProductSearch(e.target.value)}
                  placeholder="Search product..." className="pl-10 h-8 text-sm" />
              </div>
              {sretSearchResults.length > 0 && !sretSelectedProductId && (
                <div className="border rounded max-h-48 overflow-auto divide-y">
                  {sretSearchResults.map((p) => (
                    <button key={p.id} type="button" className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-50"
                      onClick={() => loadBatchesForProduct(p.id)}>
                      {p.name} ({p.sku})
                    </button>
                  ))}
                  {sretSearchResults.length === 25 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Showing first 25 — keep typing to refine.
                    </div>
                  )}
                </div>
              )}
              {sretBatches.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Select batch:</p>
                  {sretBatches.filter((b) => b.qtyRemaining > 0).map((b) => (
                    <button key={b.id} type="button"
                      className="w-full text-left px-2 py-1.5 text-xs border rounded hover:bg-gray-50"
                      onClick={() => addSretItem(b.id)}>
                      {b.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {sretItems.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                Refund uses base unit cost only. Handling charge is not refundable by supplier.
              </p>
            )}

            {/* Items list */}
            {sretItems.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-auto">
                {sretItems.map((item, idx) => (
                  <div key={item.key} className="flex items-center gap-2 text-sm border rounded p-2">
                    <div className="flex-1">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-xs text-gray-500">{item.batchLabel}</p>
                    </div>
                    <Input type="number" min="1" value={item.qty}
                      onChange={(e) => {
                        const u = [...sretItems]; u[idx] = { ...u[idx], qty: e.target.value }; setSretItems(u);
                      }}
                      className="w-16 h-7 text-xs" />
                    <Input value={item.reason}
                      onChange={(e) => {
                        const u = [...sretItems]; u[idx] = { ...u[idx], reason: e.target.value }; setSretItems(u);
                      }}
                      placeholder="Reason" className="w-28 h-7 text-xs" />
                    <Button variant="ghost" size="sm" onClick={() => {
                      setSretItems((prev) => {
                        const next = prev.filter((_, i) => i !== idx);
                        if (next.length === 0) setSretSupplierId("");
                        return next;
                      });
                    }}>
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={sretNotes} onChange={(e) => setSretNotes(e.target.value)} placeholder="Optional" className="h-8 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSretOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateSupplierReturn}
              disabled={sretSubmitting || !sretSupplierId || sretItems.length === 0}>
              {sretSubmitting ? "Creating..." : `Return ${sretItems.length} Item${sretItems.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
