"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AsyncSelect } from "@/components/shared/async-select";
import { QuickAddProduct } from "@/components/shared/quick-add-product";
import { toast } from "sonner";
import { Plus, Trash2, Search, Zap } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
}

interface POLineItem {
  key: number;
  productId: string;
  productName: string;
  sku: string;
  orderedQty: string;
  agreedPrice: string;
}

let lineKey = 0;

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading...</p>}>
      <NewPurchaseOrderContent />
    </Suspense>
  );
}

function NewPurchaseOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAuto = searchParams.get("auto") === "true";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<POLineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Product search
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{
    id: string; name: string; sku: string;
    lastBatch?: { supplierId: string | null; supplierName: string | null; unitCost: number };
  }[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // Auto-generate state
  const [autoData, setAutoData] = useState<{
    lowStockCount: number;
    supplierGroups: {
      supplierId: string;
      supplierName: string;
      items: { id: string; name: string; sku: string; currentStock: number; threshold: number; suggestedQty: number; lastCost: number }[];
      totalEstimatedCost: number;
    }[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/suppliers?full=true&limit=50").then((r) => r.json()).then((j) => setSuppliers(j.data ?? []));
  }, []);

  // Load auto-generate data
  useEffect(() => {
    if (!isAuto) return;
    fetch("/api/purchase-orders/auto-generate")
      .then((r) => r.json())
      .then((json) => setAutoData(json.data));
  }, [isAuto]);

  // Search products
  useEffect(() => {
    if (productSearch.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(productSearch)}&limit=25`);
      const json = await res.json();
      setSearchResults(json.data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  function addProduct(p: typeof searchResults[0]) {
    if (items.some((i) => i.productId === p.id)) { toast.error("Already added"); return; }

    const productSupplierId = p.lastBatch?.supplierId;
    const productSupplierName = p.lastBatch?.supplierName;
    const lastCost = p.lastBatch?.unitCost ?? 0;

    // Auto-set supplier from first product
    if (!supplierId && productSupplierId) {
      setSupplierId(productSupplierId);
    }

    // Warn if product is from a different supplier
    if (supplierId && productSupplierId && productSupplierId !== supplierId) {
      const currentSupplier = suppliers.find((s) => s.id === supplierId)?.name ?? "selected supplier";
      toast.error(`${p.name} is usually from "${productSupplierName}" but this PO is for "${currentSupplier}". You can still add it.`, { duration: 5000 });
    }

    setItems((prev) => [...prev, {
      key: ++lineKey,
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      orderedQty: "1",
      agreedPrice: lastCost > 0 ? String(lastCost) : "",
    }]);
    setProductSearch("");
    setSearchResults([]);
  }

  function loadAutoGroup(group: typeof autoData extends { supplierGroups: (infer T)[] } | null ? T : never) {
    setSupplierId(group.supplierId);
    setItems(group.items.map((item) => ({
      key: ++lineKey,
      productId: item.id,
      productName: item.name,
      sku: item.sku,
      orderedQty: String(item.suggestedQty),
      agreedPrice: String(item.lastCost),
    })));
    setAutoData(null);
  }

  async function handleSubmit() {
    if (!supplierId) { toast.error("Select a supplier"); return; }
    if (items.length === 0) { toast.error("Add at least one item"); return; }

    setSubmitting(true);
    const res = await fetch("/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        items: items.map((i) => ({
          productId: i.productId,
          orderedQty: Number(i.orderedQty),
          agreedPrice: Number(i.agreedPrice),
        })),
        notes: notes || null,
        expectedDate: expectedDate || null,
      }),
    });

    setSubmitting(false);
    if (!res.ok) { const err = await res.json(); toast.error(err.error); return; }
    const json = await res.json();
    toast.success(`PO ${json.data.poNumber} created`);
    router.push(`/purchase-orders/${json.data.id}`);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">
        {isAuto && autoData ? "Auto-Generate Purchase Orders" : "New Purchase Order"}
      </h1>

      {/* Auto-generate suggestions */}
      {isAuto && autoData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              {autoData.lowStockCount} Low Stock Products — {autoData.supplierGroups.length} Supplier(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {autoData.supplierGroups.length === 0 ? (
              <p className="text-gray-500">No low stock products found. All stock levels are healthy.</p>
            ) : (
              autoData.supplierGroups.map((group) => (
                <div key={group.supplierId || "unknown"} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{group.supplierName}</p>
                      <p className="text-xs text-gray-500">{group.items.length} items — Est. Rs.{group.totalEstimatedCost.toFixed(0)}</p>
                    </div>
                    {group.supplierId && (
                      <Button size="sm" onClick={() => loadAutoGroup(group)}>
                        Create PO for this supplier
                      </Button>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {group.items.map((i) => `${i.name} (stock: ${i.currentStock}, need: ${i.suggestedQty})`).join(" | ")}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* PO Form — shown when not in auto mode or after selecting a supplier group */}
      {(!isAuto || !autoData) && (
        <>
          <Card>
            <CardHeader><CardTitle>PO Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier *</Label>
                <AsyncSelect value={supplierId} onValueChange={setSupplierId}
                  options={suppliers} placeholder="Select supplier..." />
              </div>
              <div className="space-y-2">
                <Label>Expected Delivery Date</Label>
                <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Special instructions..." />
              </div>
            </CardContent>
          </Card>

          {/* Add Products */}
          <Card>
            <CardHeader><CardTitle>Add Products</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input placeholder="Search product..." value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)} className="pl-10" />
              </div>
              {searchResults.length > 0 && (
                <div className="border rounded divide-y max-h-40 overflow-auto">
                  {searchResults.map((p) => {
                    const fromDifferentSupplier = supplierId && p.lastBatch?.supplierId && p.lastBatch.supplierId !== supplierId;
                    return (
                      <button key={p.id} type="button"
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between ${fromDifferentSupplier ? "bg-amber-50" : ""}`}
                        onClick={() => addProduct(p)}>
                        <div>
                          <span className="font-medium">{p.name}</span>
                          <span className="text-gray-400 ml-1">({p.sku})</span>
                          {p.lastBatch?.supplierName && (
                            <span className={`text-xs ml-2 ${fromDifferentSupplier ? "text-amber-600" : "text-gray-400"}`}>
                              {fromDifferentSupplier ? "⚠ " : ""}{p.lastBatch.supplierName}
                            </span>
                          )}
                        </div>
                        <Plus className="h-4 w-4 text-gray-400" />
                      </button>
                    );
                  })}
                  {searchResults.length === 25 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Showing first 25 — keep typing to refine.
                    </div>
                  )}
                </div>
              )}
              {productSearch.length >= 2 && searchResults.length === 0 && (
                <p className="text-sm text-gray-500">
                  No products found.{" "}
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => setQuickAddOpen(true)}>
                    + Create new product
                  </button>
                </p>
              )}
              <QuickAddProduct
                open={quickAddOpen}
                onOpenChange={setQuickAddOpen}
                defaultName={productSearch}
                submitLabel="Create & Add to PO"
                onProductCreated={(product) => {
                  addProduct({ id: product.id, name: product.name, sku: product.sku });
                  setProductSearch("");
                }}
              />
            </CardContent>
          </Card>

          {/* Line Items */}
          {items.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Line Items ({items.length})</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-32">Agreed Price</TableHead>
                      <TableHead className="w-24 text-right">Total</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={item.key}>
                        <TableCell>
                          <p className="font-medium text-sm">{item.productName}</p>
                          <p className="text-xs text-gray-500">{item.sku}</p>
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="1" value={item.orderedQty}
                            onChange={(e) => { const u = [...items]; u[idx] = { ...u[idx], orderedQty: e.target.value }; setItems(u); }}
                            className="h-8 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="0" step="0.01" value={item.agreedPrice}
                            onChange={(e) => { const u = [...items]; u[idx] = { ...u[idx], agreedPrice: e.target.value }; setItems(u); }}
                            className="h-8 text-sm" />
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          Rs.{(Number(item.orderedQty || 0) * Number(item.agreedPrice || 0)).toFixed(0)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-3 text-right text-sm font-bold">
                  Total: Rs.{items.reduce((s, i) => s + Number(i.orderedQty || 0) * Number(i.agreedPrice || 0), 0).toFixed(0)}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button onClick={handleSubmit} disabled={submitting || !supplierId || items.length === 0}>
              {submitting ? "Creating..." : "Create Purchase Order"}
            </Button>
            <Button variant="outline" onClick={() => router.push("/purchase-orders")}>Cancel</Button>
          </div>
        </>
      )}
    </div>
  );
}
