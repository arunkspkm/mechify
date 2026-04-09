"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AsyncSelect } from "@/components/shared/async-select";
import { toast } from "sonner";
import { ArrowLeft, Search, AlertTriangle } from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  hsnCode: string | null;
  mrp: string;
  sellingPrice: string;
  taxRate: { name: string } | null;
  category: { name: string };
}

export default function BulkTaxUpdatePage() {
  const [filterType, setFilterType] = useState("HSN");
  const [hsnCode, setHsnCode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [taxRates, setTaxRates] = useState<{ id: string; name: string }[]>([]);
  const [newTaxRateId, setNewTaxRateId] = useState("");
  const [reason, setReason] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ updated: number; skipped: number; total: number; newTaxRate: string } | null>(null);

  useEffect(() => {
    fetch("/api/master-data?type=CATEGORY").then((r) => r.json()).then((j) => setCategories(j.data ?? []));
    fetch("/api/master-data?type=TAX_RATE").then((r) => r.json()).then((j) => setTaxRates(j.data ?? []));
  }, []);

  async function handlePreview() {
    setPreviewing(true);
    setResult(null);
    const params = new URLSearchParams({ filterType });
    if (filterType === "HSN") params.set("filterValue", hsnCode);
    if (filterType === "CATEGORY") params.set("filterValue", categoryId);

    const res = await fetch(`/api/products/bulk-tax-update?${params}`);
    const json = await res.json();
    const data = json.data ?? [];
    setProducts(data);
    setSelectedIds(new Set(data.map((p: Product) => p.id)));
    setPreviewing(false);
  }

  async function handleApply() {
    if (!newTaxRateId) { toast.error("Select the new tax rate"); return; }
    if (!reason.trim()) { toast.error("Reason is required — enter the GST notification number or reason"); return; }

    const confirmed = window.confirm(
      `This will change the tax rate for ${selectedIds.size} products. Continue?`
    );
    if (!confirmed) return;

    setApplying(true);
    const res = await fetch("/api/products/bulk-tax-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productIds: Array.from(selectedIds),
        newTaxRateId,
        reason,
      }),
    });

    setApplying(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed");
      return;
    }

    const json = await res.json();
    setResult(json.data);
    toast.success(`Updated ${json.data.updated} products to ${json.data.newTaxRate}`);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/settings" className="text-sm text-blue-600 flex items-center gap-1 mb-1">
          <ArrowLeft className="h-3 w-3" /> Back to Settings
        </Link>
        <h1 className="text-2xl font-bold">Bulk Tax Rate Update</h1>
        <p className="mt-1 text-sm text-gray-500">
          Change the GST tax rate for multiple products at once — by HSN code or category
        </p>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader><CardTitle>Select Products</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" checked={filterType === "HSN"} onChange={() => setFilterType("HSN")} />
              <span className="text-sm">By HSN Code</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={filterType === "CATEGORY"} onChange={() => setFilterType("CATEGORY")} />
              <span className="text-sm">By Category</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={filterType === "ALL"} onChange={() => setFilterType("ALL")} />
              <span className="text-sm">All Products</span>
            </label>
          </div>

          {filterType === "HSN" && (
            <div className="max-w-xs space-y-2">
              <Label>HSN Code</Label>
              <Input value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} placeholder="e.g., 85182900" />
            </div>
          )}

          {filterType === "CATEGORY" && (
            <div className="max-w-xs space-y-2">
              <Label>Category</Label>
              <AsyncSelect value={categoryId} onValueChange={setCategoryId} options={categories} placeholder="Select category..." />
            </div>
          )}

          <Button onClick={handlePreview} disabled={previewing || (filterType === "HSN" && !hsnCode) || (filterType === "CATEGORY" && !categoryId)}>
            <Search className="mr-1 h-4 w-4" />
            {previewing ? "Loading..." : "Preview Affected Products"}
          </Button>
        </CardContent>
      </Card>

      {/* Preview */}
      {products.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{selectedIds.size} of {products.length} Products Selected</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set(products.map((p) => p.id)))}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Deselect All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-64 overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>HSN</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Current Tax Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id} className={!selectedIds.has(p.id) ? "opacity-40" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={(checked) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(p.id);
                              else next.delete(p.id);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm">{p.name}</TableCell>
                      <TableCell className="text-sm text-gray-500">{p.sku}</TableCell>
                      <TableCell className="text-sm">{p.hsnCode ?? "—"}</TableCell>
                      <TableCell className="text-sm">{p.category.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{p.taxRate?.name ?? "None"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* New Tax Rate + Reason */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>New Tax Rate *</Label>
                <AsyncSelect value={newTaxRateId} onValueChange={setNewTaxRateId} options={taxRates} placeholder="Select new rate..." />
              </div>
              <div className="space-y-2">
                <Label>Reason / Notification *</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., GST Council notification No. XX/2026 dated DD-MM-YYYY"
                  rows={2} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleApply} disabled={applying || !newTaxRateId || !reason.trim() || selectedIds.size === 0} variant="destructive">
                <AlertTriangle className="mr-1 h-4 w-4" />
                {applying ? "Applying..." : `Update ${selectedIds.size} Products`}
              </Button>
              <p className="text-xs text-gray-500">This will log every change for audit purposes.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card>
          <CardContent className="py-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{result.updated}</p>
                <p className="text-xs text-green-600">Updated to {result.newTaxRate}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-700">{result.skipped}</p>
                <p className="text-xs text-gray-600">Skipped (already on this rate)</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">{result.total}</p>
                <p className="text-xs text-blue-600">Total Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
