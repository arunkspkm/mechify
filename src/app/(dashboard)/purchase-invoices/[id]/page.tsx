"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AsyncSelect } from "@/components/shared/async-select";
import { QuickAddProduct } from "@/components/shared/quick-add-product";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, CreditCard, Check, Tag, Pencil, Trash2 } from "lucide-react";

interface PIDetail {
  id: string;
  invoiceNumber: string | null;
  supplierBillNumber: string | null;
  grandTotal: string;
  totalItemsAmount: string;
  handlingCharge: string;
  amountPaid: string;
  outstandingAmount: string;
  status: string;
  notes: string | null;
  invoiceDate: string;
  dueDate: string | null;
  supplier: { id: string; name: string; phone: string | null };
  items: {
    id: string;
    bundleQty: string;
    unitCost: string;
    totalCost: string;
    product: { name: string; sku: string; bundleSize: string };
    batch: { id: string; qtyReceived: string; qtyRemaining: string; unitCost: string; handlingCharge: string; landedCostPerUnit: string } | null;
  }[];
  payments: {
    id: string;
    amount: string;
    reference: string | null;
    notes: string | null;
    date: string;
    paymentMethod: { name: string };
  }[];
  availableCredit: number;
}

export default function PurchaseInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<PIDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Add item state
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [newItemProductId, setNewItemProductId] = useState("");
  const [newItemProductName, setNewItemProductName] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemCost, setNewItemCost] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // Handling charge edit
  const [editingHandling, setEditingHandling] = useState(false);
  const [handlingInput, setHandlingInput] = useState("");

  // Payment state
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethodId, setPayMethodId] = useState("");
  const [payReference, setPayReference] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string }[]>([]);

  const [actionLoading, setActionLoading] = useState(false);

  async function fetchInvoice() {
    setLoading(true);
    const res = await fetch(`/api/purchase-invoices/${id}`);
    const json = await res.json();
    setInvoice(json.data);
    setLoading(false);
  }

  useEffect(() => { fetchInvoice(); }, [id]);
  useEffect(() => {
    fetch("/api/master-data?type=PAYMENT_METHOD").then((r) => r.json()).then((j) => setPaymentMethods(j.data ?? []));
  }, []);

  // Search products for add item
  useEffect(() => {
    if (productSearch.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(productSearch)}&limit=25`);
      const json = await res.json();
      setSearchResults(json.data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  async function handleAddItem() {
    setActionLoading(true);
    const res = await fetch(`/api/purchase-invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "addItem",
        item: { productId: newItemProductId, bundleQty: Number(newItemQty), unitCost: Number(newItemCost) },
      }),
    });
    setActionLoading(false);
    if (!res.ok) { const err = await res.json(); toast.error(err.error); return; }
    toast.success("Item added — handling redistributed");
    setAddItemOpen(false);
    setNewItemProductId("");
    setNewItemProductName("");
    setNewItemQty("1");
    setNewItemCost("");
    fetchInvoice();
  }

  async function handleRecordPayment() {
    setActionLoading(true);
    const res = await fetch(`/api/purchase-invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "recordPayment",
        payment: { amount: Number(payAmount), paymentMethodId: payMethodId, reference: payReference || null },
      }),
    });
    setActionLoading(false);
    if (!res.ok) { const err = await res.json(); toast.error(err.error); return; }
    toast.success("Payment recorded");
    setPayOpen(false);
    setPayAmount("");
    setPayReference("");
    fetchInvoice();
  }

  async function handleFinalize() {
    setActionLoading(true);
    const res = await fetch(`/api/purchase-invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finalize" }),
    });
    setActionLoading(false);
    if (!res.ok) { const err = await res.json(); toast.error(err.error); return; }
    toast.success("Invoice finalized — stock is now available for sale");
    fetchInvoice();
  }

  async function handleDiscard() {
    if (!confirm("Discard this draft invoice? This permanently deletes all line items and their batches. This cannot be undone.")) return;
    setActionLoading(true);
    const res = await fetch(`/api/purchase-invoices/${id}`, { method: "DELETE" });
    setActionLoading(false);
    if (!res.ok) { const err = await res.json(); toast.error(err.error); return; }
    toast.success("Invoice discarded");
    router.push("/purchase-invoices");
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!invoice) return <p className="text-red-600">Purchase invoice not found</p>;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/purchase-invoices" className="text-sm text-blue-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="h-3 w-3" /> Back to Purchase Invoices
          </Link>
          <h1 className="text-2xl font-bold">
            {invoice.invoiceNumber ?? `PI-${id.slice(-6)}`}
          </h1>
          <p className="text-sm text-gray-500">
            {invoice.supplier.name} | {new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}
            {invoice.supplierBillNumber && ` | Bill: ${invoice.supplierBillNumber}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={invoice.status === "PAID" ? "default" : invoice.status === "DRAFT" ? "secondary" : "destructive"}>
            {invoice.status}
          </Badge>
          {invoice.status === "DRAFT" && (
            <Button size="sm" onClick={handleFinalize} disabled={actionLoading}>
              <Check className="mr-1 h-4 w-4" /> Finalize
            </Button>
          )}
          {invoice.status === "DRAFT" && (
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleDiscard} disabled={actionLoading}>
              <Trash2 className="mr-1 h-4 w-4" /> Discard
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setAddItemOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add Item
          </Button>
          {Number(invoice.outstandingAmount) > 0 && (
            <Button size="sm" onClick={() => { setPayAmount(String(Number(invoice.outstandingAmount).toFixed(2))); setPayOpen(true); }}>
              <CreditCard className="mr-1 h-4 w-4" /> Record Payment
              {invoice.availableCredit > 0 && <span className="ml-1 text-xs opacity-75">(Credit: Rs.{invoice.availableCredit.toFixed(0)})</span>}
            </Button>
          )}
          {invoice.items.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => {
              const labelData = invoice.items.map((item) => ({
                productName: item.product.name,
                productSku: item.product.sku,
                qty: Math.ceil(Number(item.bundleQty) * Number(item.product.bundleSize)),
              }));
              sessionStorage.setItem("label_print_items", JSON.stringify(labelData));
              router.push("/billing/price-labels");
            }}>
              <Tag className="mr-1 h-4 w-4" /> Print Labels
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold">Rs.{Number(invoice.grandTotal).toFixed(0)}</p>
          <p className="text-xs text-gray-500">Grand Total</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          {editingHandling ? (
            <div className="flex items-center gap-1 justify-center">
              <Input type="number" min="0" step="0.01" value={handlingInput}
                onChange={(e) => setHandlingInput(e.target.value)}
                className="w-24 h-8 text-center text-sm" autoFocus
                onKeyDown={(e) => { if (e.key === "Escape") setEditingHandling(false); }}
              />
              <Button size="sm" variant="default" className="h-8" onClick={async () => {
                setActionLoading(true);
                const res = await fetch(`/api/purchase-invoices/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "updateHandlingCharge", handlingCharge: Number(handlingInput) || 0 }),
                });
                setActionLoading(false);
                if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed"); return; }
                toast.success("Handling charge updated");
                setEditingHandling(false);
                fetchInvoice();
              }} disabled={actionLoading}>Save</Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingHandling(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1">
              <p className="text-2xl font-bold">Rs.{Number(invoice.handlingCharge).toFixed(0)}</p>
              <button type="button" className="text-gray-400 hover:text-gray-600" onClick={() => {
                setHandlingInput(String(Number(invoice.handlingCharge)));
                setEditingHandling(true);
              }}><Pencil className="h-3.5 w-3.5" /></button>
            </div>
          )}
          <p className="text-xs text-gray-500">Handling Charge</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold text-green-600">Rs.{Number(invoice.amountPaid).toFixed(0)}</p>
          <p className="text-xs text-gray-500">Paid</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          <p className={`text-2xl font-bold ${Number(invoice.outstandingAmount) > 0 ? "text-red-600" : "text-green-600"}`}>
            Rs.{Number(invoice.outstandingAmount).toFixed(0)}
          </p>
          <p className="text-xs text-gray-500">Outstanding</p>
        </CardContent></Card>
        {invoice.availableCredit > 0 && Number(invoice.outstandingAmount) > 0 && (
          <Card><CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-green-600">Rs.{invoice.availableCredit.toFixed(0)}</p>
            <p className="text-xs text-gray-500">Credit Available</p>
          </CardContent></Card>
        )}
      </div>

      {/* Items */}
      <Card>
        <CardHeader><CardTitle>Line Items ({invoice.items.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Bundle Qty</TableHead>
                <TableHead className="text-right">Cost/Bundle</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead className="text-right">Selling Units</TableHead>
                <TableHead className="text-right">Landed Cost/Unit</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => {
                return (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium text-sm">{item.product.name}</p>
                    <p className="text-xs text-gray-500">{item.product.sku}</p>
                  </TableCell>
                  <TableCell className="text-right">{Number(item.bundleQty)}</TableCell>
                  <TableCell className="text-right">Rs.{Number(item.unitCost).toFixed(2)}</TableCell>
                  <TableCell className="text-right">Rs.{Number(item.totalCost).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{item.batch ? Number(item.batch.qtyReceived) : "—"}</TableCell>
                  <TableCell className="text-right font-medium text-blue-700">
                    {item.batch ? `Rs.${Number(item.batch.landedCostPerUnit).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell>
                    {invoice.items.length > 1 && (
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                        title="Remove item"
                        disabled={actionLoading}
                        onClick={async () => {
                          if (!confirm(`Remove "${item.product.name}" from this invoice?`)) return;
                          setActionLoading(true);
                          const res = await fetch(`/api/purchase-invoices/${id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "removeItem", itemId: item.id }),
                          });
                          setActionLoading(false);
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            toast.error(err.error || "Failed to remove item");
                            return;
                          }
                          toast.success("Item removed");
                          fetchInvoice();
                        }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {invoice.notes && (
        <p className="text-sm text-gray-500">Notes: {invoice.notes}</p>
      )}

      {/* Payment History */}
      {invoice.payments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{new Date(p.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                    <TableCell className="text-right font-medium">Rs.{Number(p.amount).toFixed(0)}</TableCell>
                    <TableCell className="text-sm">{p.paymentMethod.name}</TableCell>
                    <TableCell className="text-sm text-gray-500">{p.reference ?? "—"}</TableCell>
                    <TableCell className="text-sm text-gray-500">{p.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Item Dialog */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Missed Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Search Product</Label>
              <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Type product name..." autoFocus />
            </div>
            {searchResults.length > 0 && !newItemProductId && (
              <div className="border rounded max-h-48 overflow-auto divide-y">
                {searchResults.map((p) => (
                  <button key={p.id} type="button" className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-50"
                    onClick={() => { setNewItemProductId(p.id); setNewItemProductName(`${p.name} (${p.sku})`); setProductSearch(""); setSearchResults([]); }}>
                    {p.name} ({p.sku})
                  </button>
                ))}
                {searchResults.length === 25 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Showing first 25 — keep typing to refine.
                  </div>
                )}
              </div>
            )}
            {productSearch.length >= 2 && searchResults.length === 0 && !newItemProductId && (
              <p className="text-sm text-gray-500">
                No products found.{" "}
                <button type="button" className="text-blue-600 hover:underline" onClick={() => setQuickAddOpen(true)}>
                  + Create new product
                </button>
              </p>
            )}
            {newItemProductId && (
              <div className="p-2 bg-blue-50 rounded text-sm flex justify-between">
                <span>{newItemProductName}</span>
                <Button variant="ghost" size="sm" onClick={() => { setNewItemProductId(""); setNewItemProductName(""); }}>✕</Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantity *</Label><Input type="number" min="1" value={newItemQty} onChange={(e) => setNewItemQty(e.target.value)} /></div>
              <div><Label>Cost per unit/bundle *</Label><Input type="number" min="0" step="0.01" value={newItemCost} onChange={(e) => setNewItemCost(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={actionLoading || !newItemProductId || !newItemCost}>
              {actionLoading ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddProduct
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        defaultName={productSearch}
        submitLabel="Create & Add"
        onProductCreated={(product) => {
          setNewItemProductId(product.id);
          setNewItemProductName(`${product.name} (${product.sku})`);
          setProductSearch("");
          setSearchResults([]);
        }}
      />

      {/* Record Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Payment to Supplier</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Credit info */}
            {invoice.availableCredit > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-green-800">Available Credit (Advances + Overpayments):</span>
                  <span className="font-bold text-green-700">Rs.{invoice.availableCredit.toFixed(0)}</span>
                </div>
                <Button size="sm" variant="outline" className="w-full text-green-700 border-green-300" onClick={async () => {
                  setActionLoading(true);
                  const res = await fetch(`/api/purchase-invoices/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "applyAdvance" }),
                  });
                  setActionLoading(false);
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    toast.error(err.error || "Failed");
                    return;
                  }
                  const json = await res.json();
                  toast.success(json.message);
                  setPayOpen(false);
                  const reload = await fetch(`/api/purchase-invoices/${id}`);
                  const rj = await reload.json();
                  setInvoice(rj.data);
                }} disabled={actionLoading}>
                  Apply Rs.{Math.min(invoice.availableCredit, Number(invoice.outstandingAmount)).toFixed(0)} Credit
                </Button>
              </div>
            )}

            <Separator />

            <div><Label>Amount (Rs.) *</Label><Input type="number" min="0.01" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
            <div>
              <Label>Payment Method *</Label>
              <AsyncSelect value={payMethodId} onValueChange={setPayMethodId} options={paymentMethods} placeholder="Select method..." />
            </div>
            <div><Label>Reference</Label><Input value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="Cheque #, UTR, etc." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={actionLoading || !payAmount || !payMethodId}>
              {actionLoading ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
