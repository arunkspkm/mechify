"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AsyncSelect } from "@/components/shared/async-select";
import { Plus, Search, Upload, Pencil, Package, X } from "lucide-react";

interface Product {
  id: string;
  sku: string;
  name: string;
  mrp: string;
  sellingPrice: string;
  bundleSize: string;
  active: boolean;
  category: { id: string; name: string };
  brand: { id: string; name: string } | null;
  unit: { id: string; name: string; code: string | null };
  images: { url: string }[];
  batches: { supplier: { name: string } | null }[];
  _count: { batches: number };
}

interface MasterDataOption {
  id: string;
  name: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<MasterDataOption[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter);
    if (inStockOnly) params.set("inStock", "true");

    const res = await fetch(`/api/products?${params}`);
    const json = await res.json();
    setProducts(json.data ?? []);
    setTotalPages(json.pagination?.totalPages ?? 1);
    setLoading(false);
  }, [page, search, categoryFilter, inStockOnly]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetch("/api/master-data?type=CATEGORY")
      .then((r) => r.json())
      .then((j) => setCategories(j.data ?? []));
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, inStockOnly]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="mt-1 text-sm text-gray-500">Product catalog management</p>
        </div>
        <div className="flex gap-2">
          <Link href="/products/import">
            <Button variant="outline" size="sm">
              <Upload className="mr-1 h-4 w-4" />
              Import Excel
            </Button>
          </Link>
          <Link href="/products/new">
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              New Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="w-48">
          <AsyncSelect
            value={categoryFilter === "all" ? "" : categoryFilter}
            onValueChange={(v) => setCategoryFilter(v || "all")}
            options={categories}
            placeholder="All categories"
            allowClear
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
          />
          In stock only
        </label>
        {(search || categoryFilter !== "all" || inStockOnly) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setCategoryFilter("all"); setInStockOnly(false); }}>
            <X className="mr-1 h-4 w-4" /> Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">MRP</TableHead>
              <TableHead className="text-right">Selling Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                  <Package className="mx-auto h-8 w-8 mb-2 text-gray-300" />
                  No products found.{" "}
                  <Link href="/products/new" className="text-blue-600 hover:underline">
                    Create one
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.images?.[0] ? (
                      <Image
                        src={product.images[0].url}
                        alt={product.name}
                        width={40}
                        height={40}
                        className="rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-gray-500">{product.sku}</TableCell>
                  <TableCell>{product.category?.name}</TableCell>
                  <TableCell>{product.brand?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-gray-500">{product.batches?.[0]?.supplier?.name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {(() => {
                      const bs = Number(product.bundleSize) || 1;
                      const mrp = Number(product.mrp) / bs;
                      return <>Rs.{mrp.toFixed(2)}{bs > 1 && <span className="text-xs text-gray-400 block">/{product.unit?.code ?? "pc"}</span>}</>;
                    })()}
                  </TableCell>
                  <TableCell className="text-right">
                    {(() => {
                      const bs = Number(product.bundleSize) || 1;
                      const sp = Number(product.sellingPrice) / bs;
                      return <>Rs.{sp.toFixed(2)}{bs > 1 && <span className="text-xs text-gray-400 block">/{product.unit?.code ?? "pc"}</span>}</>;
                    })()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.active ? "default" : "secondary"}>
                      {product.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/products/${product.id}`}>
                      <Button variant="ghost" size="sm">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
