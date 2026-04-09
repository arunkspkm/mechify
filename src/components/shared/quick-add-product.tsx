"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AsyncSelect } from "@/components/shared/async-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface MasterDataOption {
  id: string;
  name: string;
  code?: string | null;
}

interface CreatedProduct {
  id: string;
  name: string;
  sku: string;
  bundleSize: string | number;
  hasExpiry: boolean;
  sellingPrice: string | number;
  unit: { name: string; code: string | null };
  lastBatch: null;
}

interface QuickAddProductProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductCreated: (product: CreatedProduct) => void;
  defaultName?: string; // Pre-fill from search text
  submitLabel?: string; // Customize button text
}

export function QuickAddProduct({
  open,
  onOpenChange,
  onProductCreated,
  defaultName = "",
  submitLabel = "Create & Add to Cart",
}: QuickAddProductProps) {
  const [categories, setCategories] = useState<MasterDataOption[]>([]);
  const [units, setUnits] = useState<MasterDataOption[]>([]);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [bundleSize, setBundleSize] = useState("1");
  const [mrp, setMrp] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [hasExpiry, setHasExpiry] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/master-data?type=CATEGORY").then((r) => r.json()),
      fetch("/api/master-data?type=UNIT").then((r) => r.json()),
    ]).then(([cats, unts]) => {
      setCategories(cats.data ?? []);
      setUnits(unts.data ?? []);
    });
  }, [open]);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setName(defaultName);
      setSku(
        defaultName
          ? defaultName.replace(/[^a-zA-Z0-9\s.]/g, "").split(/\s+/).filter((w) => w.length > 0).map((w) => w.toUpperCase().slice(0, 3)).join("-").slice(0, 16)
          : ""
      );
      setCategoryId("");
      setUnitId("");
      setBundleSize("1");
      setMrp("");
      setSellingPrice("");
      setHsnCode("");
      setHasExpiry(false);
      setError("");
    }
  }, [open, defaultName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        sku,
        categoryId,
        unitId,
        bundleSize: Number(bundleSize),
        mrp: Number(mrp),
        sellingPrice: Number(sellingPrice),
        hsnCode: hsnCode || null,
        hasExpiry,
        companionProductIds: [],
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to create product");
      return;
    }

    const result = await res.json();
    const product = result.data;

    // Find the unit details for the callback
    const unitData = units.find((u) => u.id === unitId);

    toast.success(`Product "${name}" created`);
    onOpenChange(false);
    onProductCreated({
      id: product.id,
      name: product.name,
      sku: product.sku,
      bundleSize: product.bundleSize,
      hasExpiry: product.hasExpiry,
      sellingPrice: product.sellingPrice,
      unit: {
        name: unitData?.name ?? "",
        code: unitData?.code ?? null,
      },
      lastBatch: null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick Add Product</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>SKU *</Label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <AsyncSelect value={categoryId} onValueChange={setCategoryId} options={categories} placeholder="Select..." />
            </div>
            <div className="space-y-2">
              <Label>Unit *</Label>
              <AsyncSelect value={unitId} onValueChange={setUnitId} options={units} placeholder="Select..." showCode />
            </div>
            <div className="space-y-2">
              <Label>Bundle Size</Label>
              <Input
                type="number"
                min="1"
                step="any"
                value={bundleSize}
                onChange={(e) => setBundleSize(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>HSN Code</Label>
              <Input
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>MRP (Rs.) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Selling Price (Rs.) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={hasExpiry} onCheckedChange={setHasExpiry} />
            <Label>Has expiry date</Label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !categoryId || !unitId}>
              {loading ? "Creating..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
