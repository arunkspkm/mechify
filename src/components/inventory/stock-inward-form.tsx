"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AsyncSelect } from "@/components/shared/async-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AutocompleteInput } from "@/components/shared/autocomplete-input";
import { QuickAddProduct } from "@/components/shared/quick-add-product";
import { PriceHistoryDialog } from "@/components/shared/price-history-dialog";
import { toast } from "sonner";
import { Plus, Trash2, Search, History } from "lucide-react";

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  bundleSize: string | number;
  hasExpiry: boolean;
  sellingPrice: string | number;
  unit: { name: string; code: string | null };
  lastBatch?: {
    unitCost: number;
    handlingCharge: number;
    supplierName: string | null;
    qualityGradeId: string | null;
  } | null;
}

interface LineItem {
  key: number;
  productId: string;
  productName: string;
  productSku: string;
  bundleSize: number;
  hasExpiry: boolean;
  unitLabel: string;
  batchNumber: string;
  bundleQty: string;
  unitCost: string;
  qualityGradeId: string;
  expiryDate: string;
}

interface MasterDataOption {
  id: string;
  name: string;
}

const STORAGE_KEY = "mechify_stock_inward_draft";
let lineKeyCounter = 0;

interface DraftData {
  supplierName: string;
  handlingCharge: string;
  items: LineItem[];
  savedAt: string;
}

function saveDraft(data: Omit<DraftData, "savedAt">) {
  try {
    const draft: DraftData = { ...data, savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch { /* ignore storage errors */ }
}

function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftData;
  } catch {
    return null;
  }
}

function clearDraft() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function StockInwardForm() {
  const router = useRouter();

  const [qualityGrades, setQualityGrades] = useState<MasterDataOption[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [handlingCharge, setHandlingCharge] = useState("0");
  const [priceHistoryProduct, setPriceHistoryProduct] = useState<{ id: string; name: string } | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [supplierBillNumber, setSupplierBillNumber] = useState("");
  const [mounted, setMounted] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  // Product search state
  const [productSearch, setProductSearch] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<ProductOption[]>([]);

  // Load draft on mount
  useEffect(() => {
    setMounted(true);
    const draft = loadDraft();
    if (draft && draft.items.length > 0) {
      setSupplierName(draft.supplierName);
      setHandlingCharge(draft.handlingCharge);
      const maxKey = Math.max(...draft.items.map((i) => i.key), 0);
      lineKeyCounter = maxKey;
      setItems(draft.items);
      setDraftRestored(true);
    }
  }, []);

  // Auto-save to localStorage whenever form data changes
  useEffect(() => {
    // Don't save if form is empty (or just cleared after submit)
    if (items.length === 0 && !supplierName) return;
    saveDraft({ supplierName, handlingCharge, items });
  }, [supplierName, handlingCharge, items]);

  useEffect(() => {
    fetch("/api/master-data?type=QUALITY_GRADE")
      .then((r) => r.json())
      .then((j) => setQualityGrades(j.data ?? []));
  }, []);

  // Search products
  useEffect(() => {
    if (productSearch.length < 1) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(productSearch)}&limit=10`);
      const json = await res.json();
      setSearchResults(json.data ?? []);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  function addProduct(product: ProductOption) {
    const bs = Number(product.bundleSize ?? 1);
    const lastCost = product.lastBatch?.unitCost ?? 0;
    const bundleCost = lastCost * bs;

    // Auto-fill supplier from first item's last batch if supplier is empty
    if (!supplierName && product.lastBatch?.supplierName) {
      setSupplierName(product.lastBatch.supplierName);
    }

    setItems((prev) => [
      ...prev,
      {
        key: ++lineKeyCounter,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        bundleSize: bs,
        hasExpiry: product.hasExpiry,
        unitLabel: product.unit.code ?? product.unit.name,
        batchNumber: `B-${new Date().toISOString().slice(0, 10)}`,
        bundleQty: "1",
        unitCost: bundleCost > 0 ? String(bundleCost) : "",
        qualityGradeId: product.lastBatch?.qualityGradeId ?? "",
        expiryDate: "",
      },
    ]);

    setProductSearch("");
    setSearchResults([]);
  }

  function updateItem(key: number, field: keyof LineItem, value: string) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    );
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }

  // Calculate totals
  const totalItemValue = items.reduce((sum, item) => {
    const qty = Number(item.bundleQty || 0);
    const cost = Number(item.unitCost || 0);
    return sum + qty * cost;
  }, 0);

  const handling = Number(handlingCharge || 0);

  function getSellingUnits(item: LineItem) {
    return Number(item.bundleQty || 0) * item.bundleSize;
  }

  function getCostPerSellingUnit(item: LineItem) {
    return item.bundleSize > 0 ? Number(item.unitCost || 0) / item.bundleSize : Number(item.unitCost || 0);
  }

  function getItemValue(item: LineItem) {
    return Number(item.bundleQty || 0) * Number(item.unitCost || 0);
  }

  function getLandedCostPerUnit(item: LineItem) {
    const costPerUnit = getCostPerSellingUnit(item);
    const sellingUnits = getSellingUnits(item);
    if (sellingUnits <= 0 || totalItemValue <= 0) return costPerUnit;
    const proportion = getItemValue(item) / totalItemValue;
    const handlingForItem = handling * proportion;
    return costPerUnit + (sellingUnits > 0 ? handlingForItem / sellingUnits : 0);
  }

  const submittingRef = useRef(false);

  async function handleSubmit(e: React.FormEvent, saveStatus: "FINALIZED" | "DRAFT" = "FINALIZED") {
    e.preventDefault();

    // Prevent double submission
    if (submittingRef.current) return;

    if (!supplierName.trim()) {
      toast.error("Supplier name is required");
      return;
    }

    if (items.length === 0) {
      toast.error("Add at least one product");
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    const res = await fetch("/api/inventory/stock-inward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierName,
        supplierBillNumber: supplierBillNumber || null,
        handlingCharge: handling,
        status: saveStatus,
        items: items.map((item) => ({
          productId: item.productId,
          batchNumber: item.batchNumber,
          bundleQty: Number(item.bundleQty),
          unitCost: Number(item.unitCost),
          qualityGradeId: item.qualityGradeId || null,
          expiryDate: item.expiryDate || null,
        })),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      submittingRef.current = false;
      const err = await res.json();
      toast.error(err.error || "Failed to record stock inward");
      return;
    }

    const result = await res.json();
    clearDraft();
    if (saveStatus === "DRAFT") {
      toast.success(`Draft saved — ${result.data.itemCount} items. Finalize from Purchase Invoices to make stock available.`);
      router.push("/purchase-invoices");
    } else {
      toast.success(`Recorded ${result.data.itemCount} items from ${result.data.supplier || "unknown supplier"}`, {
        action: {
          label: "Print Labels",
          onClick: () => {
            const labelData = items.map((item) => ({
              productName: item.productName,
              productSku: item.productSku,
              qty: Math.ceil(Number(item.bundleQty) * Number(item.bundleSize)),
            }));
            sessionStorage.setItem("label_print_items", JSON.stringify(labelData));
            router.push("/billing/price-labels");
          },
        },
      });
      router.push("/inventory");
    }
  }

  function handleClearDraft() {
    clearDraft();
    setSupplierName("");
    setHandlingCharge("0");
    setItems([]);
    setDraftRestored(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Draft restored banner */}
      {draftRestored && (
        <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <span className="text-amber-800">
            Restored your in-progress invoice ({items.length} item{items.length !== 1 ? "s" : ""}). Continue where you left off.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-amber-700 hover:text-amber-900"
            onClick={handleClearDraft}
          >
            Discard draft
          </Button>
        </div>
      )}

      {/* Invoice Header */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Supplier Name *</Label>
            <AutocompleteInput
              value={supplierName}
              onChange={setSupplierName}
              fetchUrl="/api/suppliers"
              placeholder="Type to search or add new..."
            />
          </div>
          <div className="space-y-2">
            <Label>Supplier Bill Number</Label>
            <Input
              value={supplierBillNumber}
              onChange={(e) => setSupplierBillNumber(e.target.value)}
              placeholder="Invoice/bill reference (optional)"
            />
          </div>
          <div className="space-y-2">
            <Label>Total Handling / Courier Charge (Rs.)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={handlingCharge}
              onChange={(e) => setHandlingCharge(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Distributed proportionally across all items by their value
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add Products */}
      <Card>
        <CardHeader>
          <CardTitle>Add Products</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search product by name or SKU to add..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {searchResults.length > 0 && (
            <div className="border rounded-md divide-y max-h-48 overflow-auto">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between"
                  onClick={() => addProduct(p)}
                >
                  <div>
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-sm text-gray-500">
                      {p.sku} — {p.unit.code ?? p.unit.name}
                      {Number(p.bundleSize) > 1 ? ` (bundle of ${p.bundleSize})` : ""}
                    </span>
                  </div>
                  <Plus className="h-4 w-4 text-gray-400" />
                </button>
              ))}
            </div>
          )}

          {productSearch.length >= 2 && searchResults.length === 0 && (
            <div className="text-sm text-gray-500 flex items-center gap-2">
              No products found for &quot;{productSearch}&quot;.
              <Button
                type="button"
                variant="link"
                size="sm"
                className="text-blue-600 p-0 h-auto"
                onClick={() => setQuickAddOpen(true)}
              >
                + Create new product
              </Button>
            </div>
          )}

          {/* Quick add button always visible */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQuickAddOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            New Product
          </Button>

          <QuickAddProduct
            open={quickAddOpen}
            onOpenChange={setQuickAddOpen}
            defaultName={productSearch}
            submitLabel="Create & Add to Stock Inward"
            onProductCreated={(product) => {
              addProduct({
                ...product,
                sellingPrice: product.sellingPrice,
                lastBatch: null,
              } as ProductOption);
            }}
          />
        </CardContent>
      </Card>

      {/* Line Items Table */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Line Items ({items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Product</TableHead>
                    <TableHead className="w-24">Batch #</TableHead>
                    <TableHead className="w-24">Qty</TableHead>
                    <TableHead className="w-32">Cost/Bundle</TableHead>
                    <TableHead className="w-32">Quality</TableHead>
                    <TableHead className="w-32">Expiry</TableHead>
                    <TableHead className="w-28 text-right">Units</TableHead>
                    <TableHead className="w-32 text-right">Landed/Unit</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.key}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{item.productName}</p>
                          <p className="text-xs text-gray-500">
                            {item.productSku} — {item.unitLabel}
                            {item.bundleSize > 1 ? ` (×${item.bundleSize})` : ""}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.batchNumber}
                          onChange={(e) => updateItem(item.key, "batchNumber", e.target.value)}
                          placeholder="—"
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.bundleQty}
                          onChange={(e) => updateItem(item.key, "bundleQty", e.target.value)}
                          className="h-8 text-sm"
                          required
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitCost}
                          onChange={(e) => updateItem(item.key, "unitCost", e.target.value)}
                          className="h-8 text-sm"
                          required
                        />
                      </TableCell>
                      <TableCell>
                        <AsyncSelect
                          value={item.qualityGradeId}
                          onValueChange={(v) => updateItem(item.key, "qualityGradeId", v)}
                          options={qualityGrades}
                          placeholder="—"
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        {item.hasExpiry ? (
                          <Input
                            type="date"
                            value={item.expiryDate}
                            onChange={(e) => updateItem(item.key, "expiryDate", e.target.value)}
                            className="h-8 text-sm"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {getSellingUnits(item)} {item.unitLabel}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-blue-700">
                        Rs.{getLandedCostPerUnit(item).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPriceHistoryProduct({ id: item.productId, name: item.productName })}
                            title="Price history"
                          >
                            <History className="h-4 w-4 text-gray-400" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.key)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="w-72 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Items Total:</span>
                  <span>Rs.{totalItemValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Handling Charge:</span>
                  <span>Rs.{handling.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Grand Total:</span>
                  <span>Rs.{(totalItemValue + handling).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={!mounted || loading || items.length === 0 || !supplierName.trim()}
        >
          {loading ? "Recording..." : `Record ${items.length} Item${items.length !== 1 ? "s" : ""}`}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!mounted || loading || items.length === 0 || !supplierName.trim()}
          onClick={(e) => handleSubmit(e, "DRAFT")}
        >
          Save as Draft
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/inventory")}>
          Cancel
        </Button>
      </div>

      {/* Price History Dialog */}
      <PriceHistoryDialog
        open={!!priceHistoryProduct}
        onOpenChange={(open) => { if (!open) setPriceHistoryProduct(null); }}
        productId={priceHistoryProduct?.id ?? ""}
        productName={priceHistoryProduct?.name ?? ""}
      />
    </form>
  );
}
