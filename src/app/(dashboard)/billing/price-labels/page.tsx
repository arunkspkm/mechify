"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Search, Plus, Minus, Printer, Trash2 } from "lucide-react";

interface ProductResult {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  mrp: string;
  sellingPrice: string;
  installationCharge?: string | number;
  bundleSize: string | number;
  stock?: number;
  brand?: { name: string } | null;
  category?: { name: string } | null;
}

function perUnit(price: string | number, bundleSize: string | number) {
  return Number(price) / (Number(bundleSize) || 1);
}

interface LabelItem {
  product: ProductResult;
  qty: number;
}

type LabelSize = "a4-65" | "a4-40" | "a4-24" | "thermal-50x25" | "thermal-38x25";

const LABEL_SIZES: { value: LabelSize; label: string; desc: string }[] = [
  { value: "a4-65", label: "A4 — 65 labels", desc: "5×13 grid (38mm × 21mm) — small price stickers" },
  { value: "a4-40", label: "A4 — 40 labels", desc: "4×10 grid (48mm × 25mm) — medium" },
  { value: "a4-24", label: "A4 — 24 labels", desc: "3×8 grid (64mm × 34mm) — large" },
  { value: "thermal-50x25", label: "Thermal 50×25mm", desc: "Single column, standard thermal" },
  { value: "thermal-38x25", label: "Thermal 38×25mm", desc: "Single column, small thermal" },
];

export default function PriceLabelsPage() {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProductResult[]>([]);
  const [labelItems, setLabelItems] = useState<LabelItem[]>([]);
  const [labelSize, setLabelSize] = useState<LabelSize>("a4-65");
  const [showPreview, setShowPreview] = useState(false);
  const [shopName, setShopName] = useState("Mechify");
  const [showGrid, setShowGrid] = useState(true);
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  // Load shop name + pre-filled items from purchase invoice / stock inward
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json?.data?.shopName) setShopName(json.data.shopName); })
      .catch(() => {});

    // Check for pre-filled items from other pages
    const raw = sessionStorage.getItem("label_print_items");
    if (raw) {
      try {
        const items = JSON.parse(raw) as { productName: string; productSku: string; qty: number }[];
        sessionStorage.removeItem("label_print_items");
        // Fetch full product details for each item
        Promise.all(
          items.map(async (item) => {
            const res = await fetch(`/api/products/search?q=${encodeURIComponent(item.productSku)}&limit=1`);
            if (!res.ok) return null;
            const json = await res.json();
            const product = (json.data ?? []).find((p: ProductResult) => p.sku === item.productSku);
            if (!product) return null;
            return { product, qty: item.qty } as LabelItem;
          })
        ).then((results) => {
          const valid = results.filter(Boolean) as LabelItem[];
          // Merge duplicates (same product from multiple batches)
          const merged: LabelItem[] = [];
          for (const item of valid) {
            const existing = merged.find((m) => m.product.id === item.product.id);
            if (existing) {
              existing.qty += item.qty;
            } else {
              merged.push(item);
            }
          }
          if (merged.length > 0) setLabelItems(merged);
        });
      } catch { /* ignore */ }
    }
  }, []);

  // Search products
  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const params = new URLSearchParams({ q: search, limit: "25" });
      if (!showOutOfStock) params.set("inStockOnly", "true");
      const res = await fetch(`/api/products/search?${params}`);
      if (res.ok) {
        const json = await res.json();
        setSearchResults(json.data ?? []);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search, showOutOfStock]);

  function addProduct(product: ProductResult) {
    const existing = labelItems.find((i) => i.product.id === product.id);
    if (existing) {
      setLabelItems(labelItems.map((i) =>
        i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i
      ));
    } else {
      setLabelItems([...labelItems, { product, qty: 1 }]);
    }
    setSearch("");
    setSearchResults([]);
  }

  function updateQty(productId: string, delta: number) {
    setLabelItems(labelItems.map((i) =>
      i.product.id === productId ? { ...i, qty: Math.max(1, i.qty + delta) } : i
    ));
  }

  function setQty(productId: string, qty: number) {
    setLabelItems(labelItems.map((i) =>
      i.product.id === productId ? { ...i, qty: Math.max(1, qty) } : i
    ));
  }

  function removeProduct(productId: string) {
    setLabelItems(labelItems.filter((i) => i.product.id !== productId));
  }

  const totalLabels = labelItems.reduce((s, i) => s + i.qty, 0);

  function handlePrint() {
    if (labelItems.length === 0) { toast.error("Add products first"); return; }
    setShowPreview(true);
    setTimeout(() => window.print(), 300);
  }

  return (
    <div className="space-y-6">
      {/* Header — hidden when printing */}
      <div className="no-print">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Price Labels</h1>
            <p className="text-sm text-gray-500">Search products, set quantity, and print labels</p>
          </div>
          <Button onClick={handlePrint} disabled={labelItems.length === 0}>
            <Printer className="mr-1 h-4 w-4" /> Print {totalLabels} Labels
          </Button>
        </div>

        {/* Label size selector */}
        <div className="flex gap-2 mt-4">
          {LABEL_SIZES.map((s) => (
            <button key={s.value} type="button"
              className={`px-3 py-2 rounded-lg border text-sm text-left ${
                labelSize === s.value
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
              onClick={() => setLabelSize(s.value)}>
              <p className="font-medium">{s.label}</p>
              <p className={`text-xs ${labelSize === s.value ? "text-gray-300" : "text-gray-400"}`}>{s.desc}</p>
            </button>
          ))}
        </div>

        {/* Print options */}
        <div className="flex gap-4 mt-3 text-sm flex-wrap">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
            Show grid lines (cut guides)
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-gray-500">
            <input type="checkbox" checked={showOutOfStock} onChange={(e) => setShowOutOfStock(e.target.checked)} />
            Show out of stock
          </label>
        </div>

        {/* Product search */}
        <div className="relative mt-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search product by name, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {searchResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
              {searchResults.map((p) => (
                <button key={p.id} type="button"
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 border-b last:border-b-0 text-left"
                  onClick={() => addProduct(p)}>
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">Rs.{perUnit(p.sellingPrice, p.bundleSize).toFixed(0)}</p>
                    {perUnit(p.mrp, p.bundleSize) !== perUnit(p.sellingPrice, p.bundleSize) && (
                      <p className="text-xs text-gray-400 line-through">MRP: Rs.{perUnit(p.mrp, p.bundleSize).toFixed(0)}</p>
                    )}
                    {p.stock !== undefined && (
                      p.stock <= 0 ? (
                        <p className="text-xs text-red-500 font-medium">Out of stock</p>
                      ) : (
                        <p className="text-xs text-gray-500">Stock: {p.stock}</p>
                      )
                    )}
                  </div>
                </button>
              ))}
              {searchResults.length === 25 && (
                <div className="px-4 py-2 text-xs text-muted-foreground">
                  Showing first 25 — keep typing to refine.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected products table */}
        {labelItems.length > 0 && (
          <Card className="mt-4">
            <CardHeader><CardTitle>Products ({labelItems.length}) — {totalLabels} labels</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">MRP</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-center">Label Qty</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labelItems.map((item, idx) => (
                    <TableRow key={`${item.product.id}-${idx}`}>
                      <TableCell>
                        <p className="font-medium text-sm">{item.product.name}</p>
                        <p className="text-xs text-gray-400">{item.product.sku}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.product.stock === undefined ? (
                          <span className="text-gray-400 italic text-xs">—</span>
                        ) : item.product.stock <= 0 ? (
                          <span className="text-red-500 font-medium">0</span>
                        ) : (
                          item.product.stock
                        )}
                      </TableCell>
                      <TableCell className="text-right">Rs.{perUnit(item.product.mrp, item.product.bundleSize).toFixed(0)}</TableCell>
                      <TableCell className="text-right font-medium">Rs.{perUnit(item.product.sellingPrice, item.product.bundleSize).toFixed(0)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7"
                            onClick={() => updateQty(item.product.id, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input type="number" min="1" value={item.qty}
                            onChange={(e) => setQty(item.product.id, Number(e.target.value) || 1)}
                            className="w-14 h-7 text-center text-sm" />
                          <Button variant="outline" size="icon" className="h-7 w-7"
                            onClick={() => updateQty(item.product.id, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => removeProduct(item.product.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Print Preview — visible only when printing */}
      <div id="label-print" className={`${showPreview ? "" : "hidden print:block"}${showGrid ? "" : " no-label-grid"}`}>
        {labelSize.startsWith("a4") ? (
          <A4Labels items={labelItems} shopName={shopName} size={labelSize} />
        ) : (
          <ThermalLabels items={labelItems} shopName={shopName} size={labelSize} />
        )}
      </div>
    </div>
  );
}

// ============ A4 Sheet Labels ============
const A4_CONFIGS: Record<string, { cols: number; rows: number; perPage: number; cssClass: string }> = {
  "a4-65": { cols: 5, rows: 13, perPage: 65, cssClass: "a4-label-65" },
  "a4-40": { cols: 4, rows: 10, perPage: 40, cssClass: "a4-label-40" },
  "a4-24": { cols: 3, rows: 8, perPage: 24, cssClass: "a4-label-24" },
};

function A4Labels({ items, shopName, size }: { items: LabelItem[]; shopName: string; size: LabelSize }) {
  const config = A4_CONFIGS[size] ?? A4_CONFIGS["a4-65"];

  const labels: ProductResult[] = [];
  for (const item of items) {
    for (let i = 0; i < item.qty; i++) {
      labels.push(item.product);
    }
  }

  const pages: ProductResult[][] = [];
  for (let i = 0; i < labels.length; i += config.perPage) {
    pages.push(labels.slice(i, i + config.perPage));
  }

  const isSmall = size === "a4-65";

  return (
    <>
      {pages.map((page, pageIdx) => (
        <div key={pageIdx} className={`a4-label-page ${config.cssClass}-page${pageIdx === pages.length - 1 ? " last-label-page" : ""}`}>
          {page.map((p, idx) => (
            <div key={idx} className={`a4-label ${config.cssClass}`}>
              {!isSmall && <div className="a4-label-shop">{shopName}</div>}
              <div className="a4-label-name">{p.name}</div>
              <div className="a4-label-sku">{p.sku}</div>
              <div className="a4-label-prices">
                {perUnit(p.mrp, p.bundleSize) > 0 && perUnit(p.mrp, p.bundleSize) !== perUnit(p.sellingPrice, p.bundleSize) && (
                  <span className="a4-label-mrp">MRP: ₹{perUnit(p.mrp, p.bundleSize).toFixed(0)}</span>
                )}
                <span className="a4-label-ourprice">Our Price:</span>
                <span className="a4-label-price">
                  ₹{perUnit(p.sellingPrice, p.bundleSize).toFixed(0)}
                  {Number(p.installationCharge) > 0 && <span className="a4-label-asterisk">*</span>}
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

// ============ Thermal Labels (single column) ============
function ThermalLabels({ items, shopName, size }: { items: LabelItem[]; shopName: string; size: LabelSize }) {
  const labels: ProductResult[] = [];
  for (const item of items) {
    for (let i = 0; i < item.qty; i++) {
      labels.push(item.product);
    }
  }

  const isSmall = size === "thermal-38x25";

  return (
    <div className="thermal-labels">
      {labels.map((p, idx) => (
        <div key={idx} className={`thermal-label ${isSmall ? "thermal-label-small" : ""}`}>
          <div className="thermal-label-shop">{shopName}</div>
          <div className="thermal-label-name">{p.name}</div>
          <div className="thermal-label-sku">{p.sku}</div>
          <div className="thermal-label-prices">
            {perUnit(p.mrp, p.bundleSize) !== perUnit(p.sellingPrice, p.bundleSize) && (
              <span className="thermal-label-mrp">MRP: ₹{perUnit(p.mrp, p.bundleSize).toFixed(0)}</span>
            )}
            <span className="thermal-label-price">
              ₹{perUnit(p.sellingPrice, p.bundleSize).toFixed(0)}
              {Number(p.installationCharge) > 0 && <span className="thermal-label-asterisk">*</span>}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
