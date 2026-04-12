"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AsyncSelect } from "@/components/shared/async-select";
import { CompanionItemsPicker } from "./companion-items-picker";
import { ProductImageUpload } from "./product-image-upload";
import { toast } from "sonner";

interface MasterDataOption {
  id: string;
  name: string;
  code?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface ProductImage {
  id: string;
  url: string;
  isPrimary: boolean;
}

interface CompanionProduct {
  id: string;
  name: string;
  sku: string;
  sellingPrice?: number | string;
}

interface ProductFormProps {
  productId?: string; // If editing
  initialData?: Record<string, unknown>;
}

export function ProductForm({ productId, initialData }: ProductFormProps) {
  const router = useRouter();
  const isEditing = !!productId;

  // Master data options
  const [categories, setCategories] = useState<MasterDataOption[]>([]);
  const [brands, setBrands] = useState<MasterDataOption[]>([]);
  const [units, setUnits] = useState<MasterDataOption[]>([]);
  const [taxRates, setTaxRates] = useState<MasterDataOption[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [skuManuallyEdited, setSkuManuallyEdited] = useState(false);

  function generateSkuLocal(productName: string, brand?: string) {
    const parts = [productName, brand].filter(Boolean).join(" ");
    const words = parts.replace(/[^a-zA-Z0-9\s.]/g, "").split(/\s+/).filter((w) => w.length > 0).map((w) => w.toUpperCase().slice(0, 3));
    let sku = words.join("-");
    if (sku.length > 16) {
      const segments: string[] = [];
      let len = 0;
      for (const word of words) {
        const needed = segments.length > 0 ? word.length + 1 : word.length;
        if (len + needed > 16) break;
        segments.push(word);
        len += needed;
      }
      sku = segments.join("-");
    }
    return sku || productName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  }
  const [barcode, setBarcode] = useState("");
  const [description, setDescription] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [bundleSize, setBundleSize] = useState("1");
  const [mrp, setMrp] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [taxRateId, setTaxRateId] = useState("");
  const [installationCharge, setInstallationCharge] = useState("0");
  const [maxDiscountPercent, setMaxDiscountPercent] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("1");
  const [hasExpiry, setHasExpiry] = useState(false);
  const [companions, setCompanions] = useState<CompanionProduct[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);

  const [loading, setLoading] = useState(false);
  const [priceChangeReason, setPriceChangeReason] = useState("");
  // Track original values to detect changes
  const [originalMrp, setOriginalMrp] = useState("");
  const [originalSellingPrice, setOriginalSellingPrice] = useState("");
  const [originalTaxRateId, setOriginalTaxRateId] = useState("");
  const [error, setError] = useState("");

  // Load master data options
  useEffect(() => {
    async function loadOptions() {
      const [catRes, brandRes, unitRes, taxRes] = await Promise.all([
        fetch("/api/master-data?type=CATEGORY"),
        fetch("/api/master-data?type=BRAND"),
        fetch("/api/master-data?type=UNIT"),
        fetch("/api/master-data?type=TAX_RATE"),
      ]);
      const [cats, brnds, unts, taxes] = await Promise.all([
        catRes.json(), brandRes.json(), unitRes.json(), taxRes.json(),
      ]);
      setCategories(cats.data ?? []);
      setBrands(brnds.data ?? []);
      setUnits(unts.data ?? []);
      setTaxRates(taxes.data ?? []);
    }
    loadOptions();
  }, []);

  // Populate form when editing
  useEffect(() => {
    if (!initialData) return;
    const d = initialData as Record<string, unknown>;
    setName(String(d.name ?? ""));
    setSku(String(d.sku ?? ""));
    setSkuManuallyEdited(true); // Don't auto-overwrite when editing existing product
    setBarcode(String(d.barcode ?? ""));
    setDescription(String(d.description ?? ""));
    setHsnCode(String(d.hsnCode ?? ""));
    setCategoryId(String(d.categoryId ?? ""));
    setBrandId(String(d.brandId ?? ""));
    setUnitId(String(d.unitId ?? ""));
    setBundleSize(String(d.bundleSize ?? "1"));
    setMrp(String(d.mrp ?? ""));
    setSellingPrice(String(d.sellingPrice ?? ""));
    setOriginalMrp(String(d.mrp ?? ""));
    setOriginalSellingPrice(String(d.sellingPrice ?? ""));
    setTaxRateId(String(d.taxRateId ?? ""));
    setOriginalTaxRateId(String(d.taxRateId ?? ""));
    setInstallationCharge(String(d.installationCharge ?? "0"));
    setMaxDiscountPercent(String(d.maxDiscountPercent ?? ""));
    setLowStockThreshold(String(d.lowStockThreshold ?? "1"));
    setHasExpiry(Boolean(d.hasExpiry));

    if (Array.isArray(d.images)) {
      setImages(d.images as ProductImage[]);
    }
    if (Array.isArray(d.companionProducts)) {
      setCompanions(
        (d.companionProducts as { companionProduct: CompanionProduct }[]).map(
          (c) => c.companionProduct
        )
      );
    }
  }, [initialData]);

  async function loadImages() {
    if (!productId) return;
    const res = await fetch(`/api/products/${productId}`);
    const json = await res.json();
    setImages(json.data?.images ?? []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const body = {
      name,
      sku,
      barcode: barcode || null,
      description: description || null,
      hsnCode: hsnCode || null,
      categoryId,
      brandId: brandId || null,
      unitId,
      bundleSize: Number(bundleSize),
      mrp: Number(mrp),
      sellingPrice: Number(sellingPrice),
      taxRateId: taxRateId || null,
      installationCharge: Number(installationCharge),
      maxDiscountPercent: maxDiscountPercent ? Number(maxDiscountPercent) : null,
      lowStockThreshold: Number(lowStockThreshold),
      hasExpiry,
      companionProductIds: companions.map((c) => c.id),
      priceChangeReason: priceChangeReason || null,
    };

    const res = await fetch(
      isEditing ? `/api/products/${productId}` : "/api/products",
      {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    setLoading(false);

    const text = await res.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      setError(`Server error (${res.status}): ${text.slice(0, 200) || "Empty response"}`);
      return;
    }

    if (!res.ok) {
      setError(result.error || "Failed to save product");
      return;
    }

    toast.success(isEditing ? "Product updated" : "Product created");

    if (!isEditing) {
      router.push(`/products/${result.data.id}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input id="name" value={name} onChange={(e) => {
              setName(e.target.value);
              if (!skuManuallyEdited) {
                const brandName = brands.find((b) => b.id === brandId)?.name;
                setSku(generateSkuLocal(e.target.value, brandName));
              }
            }} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sku">SKU <span className="text-gray-400 text-xs">(auto-generated)</span></Label>
            <Input id="sku" value={sku} onChange={(e) => { setSku(e.target.value); setSkuManuallyEdited(true); }}
              placeholder="Auto-generated from name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode</Label>
            <Input id="barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hsnCode">HSN Code</Label>
            <Input id="hsnCode" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Classification */}
      <Card>
        <CardHeader>
          <CardTitle>Classification</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Category *</Label>
            <AsyncSelect value={categoryId} onValueChange={setCategoryId} options={categories} placeholder="Select category" />
          </div>
          <div className="space-y-2">
            <Label>Brand</Label>
            <AsyncSelect value={brandId} onValueChange={(v) => {
              setBrandId(v);
              if (!skuManuallyEdited && name) {
                const brandName = brands.find((b) => b.id === v)?.name;
                setSku(generateSkuLocal(name, brandName));
              }
            }} options={brands} placeholder="Select brand" />
          </div>
          <div className="space-y-2">
            <Label>Unit *</Label>
            <AsyncSelect value={unitId} onValueChange={setUnitId} options={units} placeholder="Select unit" showCode />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bundleSize">Bundle Size</Label>
            <Input id="bundleSize" type="number" min="1" step="any" value={bundleSize} onChange={(e) => setBundleSize(e.target.value)} />
            <p className="text-xs text-gray-500">How many units per bundle (e.g., 50 for 50m wire roll)</p>
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing & Tax</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mrp">MRP (Rs.)</Label>
            <Input id="mrp" type="number" min="0" step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sellingPrice">Selling Price (Rs.) *</Label>
            <Input id="sellingPrice" type="number" min="0" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} required />
            {Number(mrp) > 0 && Number(sellingPrice) > 0 && Number(sellingPrice) < Number(mrp) && (
              <p className="text-xs text-green-600 font-medium">
                {((1 - Number(sellingPrice) / Number(mrp)) * 100).toFixed(1)}% below MRP
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationCharge">Installation Charge (Rs.)</Label>
            <Input id="installationCharge" type="number" min="0" step="0.01" value={installationCharge} onChange={(e) => setInstallationCharge(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tax Rate</Label>
            <AsyncSelect value={taxRateId} onValueChange={setTaxRateId} options={taxRates} placeholder="Select tax rate" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxDiscount">Max Discount (%)</Label>
            <Input id="maxDiscount" type="number" min="0" max="100" step="0.1" value={maxDiscountPercent} onChange={(e) => setMaxDiscountPercent(e.target.value)} placeholder="Uses default if empty" />
          </div>
          {isEditing && (mrp !== originalMrp || sellingPrice !== originalSellingPrice || taxRateId !== originalTaxRateId) && (
            <div className="col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
              <p className="text-sm text-amber-800 font-medium">
                {mrp !== originalMrp && <span>MRP: Rs.{originalMrp} → Rs.{mrp} </span>}
                {sellingPrice !== originalSellingPrice && <span>Selling: Rs.{originalSellingPrice} → Rs.{sellingPrice} </span>}
                {taxRateId !== originalTaxRateId && <span>Tax rate changed </span>}
              </p>
              <div>
                <Label className="text-xs">Reason for change</Label>
                <Textarea value={priceChangeReason} onChange={(e) => setPriceChangeReason(e.target.value)}
                  placeholder="e.g., Supplier price increase, GST notification number, govt rate revision..."
                  rows={2} className="text-sm" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lowStock">Low Stock Threshold</Label>
            <Input id="lowStock" type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={hasExpiry} onCheckedChange={setHasExpiry} />
            <Label>This product has an expiry date</Label>
          </div>
        </CardContent>
      </Card>

      {/* Images (only when editing) */}
      {isEditing && productId && (
        <Card>
          <CardHeader>
            <CardTitle>Product Images</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductImageUpload
              productId={productId}
              images={images}
              onImagesChange={loadImages}
            />
          </CardContent>
        </Card>
      )}

      {/* Companion Items */}
      <Card>
        <CardHeader>
          <CardTitle>Companion / Related Items</CardTitle>
          <p className="text-sm text-gray-500">
            Items commonly needed together for installation. Counter staff will be reminded when billing.
          </p>
        </CardHeader>
        <CardContent>
          <CompanionItemsPicker
            selectedItems={companions}
            onChange={setCompanions}
            excludeProductId={productId}
          />
        </CardContent>
      </Card>

      {/* Error & Submit */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : isEditing ? "Update Product" : "Create Product"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/products")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
