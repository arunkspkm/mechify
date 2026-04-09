"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AsyncSelect } from "@/components/shared/async-select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PriceHistoryDialog } from "@/components/shared/price-history-dialog";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Download,
  AlertTriangle,
  Clock,
  Warehouse,
  History,
  MoreVertical,
  Pencil,
  PackagePlus,
  Trash2,
  X,
} from "lucide-react";

interface StockItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  lowStockThreshold: number;
  totalStock: number;
  stockValue: number;
  avgLandedCost: number;
  isLowStock: boolean;
  hasNearExpiry: boolean;
  hasExpired: boolean;
  batchCount: number;
}

interface MasterDataOption {
  id: string;
  name: string;
}

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<MasterDataOption[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [nearExpiryOnly, setNearExpiryOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{ totalStockValue: number; lowStockCount: number; expiryCount: number } | null>(null);
  const [priceHistoryProduct, setPriceHistoryProduct] = useState<{ id: string; name: string } | null>(null);

  // Batch edit state
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [batchEditProductId, setBatchEditProductId] = useState("");
  const [batchEditProductName, setBatchEditProductName] = useState("");
  const [batchList, setBatchList] = useState<{
    id: string; batchNumber: string | null; qtyReceived: string; qtyRemaining: string;
    unitCost: string; handlingCharge: string; landedCostPerUnit: string;
    expiryDate: string | null; purchaseDate: string; supplier: { name: string } | null;
  }[]>([]);
  const [editingBatch, setEditingBatch] = useState<{
    id: string; unitCost: string; handlingCharge: string; landedCostPerUnit: string;
    batchNumber: string; qtyRemaining: string; expiryDate: string;
  } | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter);
    if (lowStockOnly) params.set("lowStock", "true");
    if (nearExpiryOnly) params.set("nearExpiry", "true");

    const res = await fetch(`/api/inventory?${params}`);
    const json = await res.json();
    setItems(json.data ?? []);
    if (json.summary) setSummary(json.summary);
    setLoading(false);
  }, [search, categoryFilter, lowStockOnly, nearExpiryOnly]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    fetch("/api/master-data?type=CATEGORY")
      .then((r) => r.json())
      .then((j) => setCategories(j.data ?? []));
  }, []);

  async function openBatchEditor(productId: string, productName: string) {
    setBatchEditProductId(productId);
    setBatchEditProductName(productName);
    const res = await fetch(`/api/products/${productId}`);
    const json = await res.json();
    setBatchList(json.data?.batches ?? []);
    setBatchEditOpen(true);
    setEditingBatch(null);
  }

  function startEditBatch(batch: typeof batchList[0]) {
    setEditingBatch({
      id: batch.id,
      unitCost: String(Number(batch.unitCost)),
      handlingCharge: String(Number(batch.handlingCharge)),
      landedCostPerUnit: String(Number(batch.landedCostPerUnit)),
      batchNumber: batch.batchNumber ?? "",
      qtyRemaining: String(Number(batch.qtyRemaining)),
      expiryDate: batch.expiryDate ? new Date(batch.expiryDate).toISOString().slice(0, 10) : "",
    });
  }

  async function saveBatchEdit() {
    if (!editingBatch) return;
    setBatchSaving(true);

    const res = await fetch(`/api/inventory/batches/${editingBatch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitCost: Number(editingBatch.unitCost),
        handlingCharge: Number(editingBatch.handlingCharge),
        batchNumber: editingBatch.batchNumber || null,
        qtyRemaining: Number(editingBatch.qtyRemaining),
        expiryDate: editingBatch.expiryDate || null,
      }),
    });

    setBatchSaving(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to update batch");
      return;
    }

    toast.success("Batch updated");
    setEditingBatch(null);
    // Reload batches
    openBatchEditor(batchEditProductId, batchEditProductName);
    // Reload inventory
    fetchInventory();
  }

  async function handleDiscontinue(productId: string, productName: string, stock: number) {
    const hasStock = stock > 0;
    const message = hasStock
      ? `Discontinue "${productName}"?\n\nThis product has ${stock} units in stock.\n\n• Click OK to discontinue AND write off all remaining stock\n• The product will be deactivated and removed from POS`
      : `Discontinue "${productName}"?\n\nThe product will be deactivated and removed from POS.`;

    if (!window.confirm(message)) return;

    const res = await fetch(`/api/products/${productId}/discontinue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writeOffStock: hasStock,
        reason: "Product discontinued",
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to discontinue");
      return;
    }

    const json = await res.json();
    if (json.data.stockWrittenOff) {
      toast.success(`"${productName}" discontinued. ${json.data.totalWrittenOff} units written off (Rs.${json.data.totalValueLost} loss).`);
    } else {
      toast.success(`"${productName}" discontinued.`);
    }
    fetchInventory();
  }

  const totalValue = summary?.totalStockValue ?? 0;
  const lowStockCount = summary?.lowStockCount ?? 0;
  const expiryCount = summary?.expiryCount ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">Stock overview and batch tracking</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/inventory/export" download>
            <Button variant="outline" size="sm">
              <Download className="mr-1 h-4 w-4" />
              Export Excel
            </Button>
          </a>
          <Link href="/inventory/write-offs">
            <Button variant="outline" size="sm">Write-offs</Button>
          </Link>
          <Link href="/inventory/stock-inward">
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Stock Inward
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-lg border">
          <div className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-blue-500" />
            <p className="text-sm text-gray-500">Total Stock Value</p>
          </div>
          <p className="text-2xl font-bold mt-1">Rs.{totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="p-4 bg-white rounded-lg border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-gray-500">Low Stock Items</p>
          </div>
          <p className="text-2xl font-bold mt-1 text-red-600">{lowStockCount}</p>
        </div>
        <div className="p-4 bg-white rounded-lg border">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <p className="text-sm text-gray-500">Near Expiry / Expired</p>
          </div>
          <p className="text-2xl font-bold mt-1 text-amber-600">{expiryCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <AsyncSelect
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v ?? "")}
          options={[{ id: "all", name: "All categories" }, ...categories]}
          placeholder="All categories"
          className="w-48"
        />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={lowStockOnly} onCheckedChange={setLowStockOnly} />
          Low stock only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={nearExpiryOnly} onCheckedChange={setNearExpiryOnly} />
          Near expiry
        </label>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Avg Cost</TableHead>
              <TableHead className="text-right">Stock Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">Loading...</TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No inventory data.{" "}
                  <Link href="/inventory/stock-inward" className="text-blue-600 hover:underline">
                    Record stock inward
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-gray-500">{item.sku}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell className="text-right">
                    <span className={item.isLowStock ? "text-red-600 font-semibold" : ""}>
                      {item.totalStock} {item.unit}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">Rs.{item.avgLandedCost.toFixed(2)}</TableCell>
                  <TableCell className="text-right">Rs.{item.stockValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {item.isLowStock && (
                        <Badge variant="destructive" className="text-xs">Low Stock</Badge>
                      )}
                      {item.hasExpired && (
                        <Badge variant="destructive" className="text-xs">Expired</Badge>
                      )}
                      {item.hasNearExpiry && !item.hasExpired && (
                        <Badge className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-100">Near Expiry</Badge>
                      )}
                      {!item.isLowStock && !item.hasNearExpiry && !item.hasExpired && (
                        <Badge variant="secondary" className="text-xs">OK</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 w-8 hover:bg-gray-100">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/products/${item.id}`)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit Product
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openBatchEditor(item.id, item.name)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit Batches / Cost
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push("/inventory/stock-inward")}>
                          <PackagePlus className="mr-2 h-4 w-4" />
                          Stock Inward
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPriceHistoryProduct({ id: item.id, name: item.name })}>
                          <History className="mr-2 h-4 w-4" />
                          Price History
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push("/inventory/write-offs")}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Write-off
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDiscontinue(item.id, item.name, item.totalStock)}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Discontinue
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Price History Dialog */}
      <PriceHistoryDialog
        open={!!priceHistoryProduct}
        onOpenChange={(open) => { if (!open) setPriceHistoryProduct(null); }}
        productId={priceHistoryProduct?.id ?? ""}
        productName={priceHistoryProduct?.name ?? ""}
      />

      {/* Batch Edit Dialog */}
      <Dialog open={batchEditOpen} onOpenChange={setBatchEditOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Edit Batches — {batchEditProductName}</DialogTitle>
          </DialogHeader>

          {batchList.length === 0 ? (
            <p className="text-gray-500 py-4">No batches found for this product.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Qty Remaining</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Handling</TableHead>
                  <TableHead className="text-right">Landed Cost</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchList.map((batch) => (
                  editingBatch?.id === batch.id ? (
                    <TableRow key={batch.id} className="bg-blue-50">
                      <TableCell className="text-sm">
                        {new Date(batch.purchaseDate).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell>
                        <Input value={editingBatch.batchNumber}
                          onChange={(e) => setEditingBatch({ ...editingBatch, batchNumber: e.target.value })}
                          className="h-8 text-sm w-24" />
                      </TableCell>
                      <TableCell className="text-sm">{batch.supplier?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Input type="number" min="0" value={editingBatch.qtyRemaining}
                          onChange={(e) => setEditingBatch({ ...editingBatch, qtyRemaining: e.target.value })}
                          className="h-8 text-sm w-20 text-right" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="0.01" value={editingBatch.unitCost}
                          onChange={(e) => setEditingBatch({ ...editingBatch, unitCost: e.target.value })}
                          className="h-8 text-sm w-24 text-right" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="0" step="0.01" value={editingBatch.handlingCharge}
                          onChange={(e) => setEditingBatch({ ...editingBatch, handlingCharge: e.target.value })}
                          className="h-8 text-sm w-24 text-right" />
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-blue-700">
                        Auto
                      </TableCell>
                      <TableCell>
                        <Input type="date" value={editingBatch.expiryDate}
                          onChange={(e) => setEditingBatch({ ...editingBatch, expiryDate: e.target.value })}
                          className="h-8 text-sm w-32" />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" onClick={saveBatchEdit} disabled={batchSaving}>
                            {batchSaving ? "..." : "Save"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingBatch(null)}>
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={batch.id}>
                      <TableCell className="text-sm">
                        {new Date(batch.purchaseDate).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell className="text-sm">{batch.batchNumber ?? "—"}</TableCell>
                      <TableCell className="text-sm">{batch.supplier?.name ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm">{Number(batch.qtyRemaining)}</TableCell>
                      <TableCell className="text-right text-sm">Rs.{Number(batch.unitCost).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm">Rs.{Number(batch.handlingCharge).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">Rs.{Number(batch.landedCostPerUnit).toFixed(2)}</TableCell>
                      <TableCell className="text-sm">
                        {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString("en-IN") : "—"}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => startEditBatch(batch)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
