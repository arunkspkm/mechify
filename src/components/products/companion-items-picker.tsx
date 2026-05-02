"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search, Plus } from "lucide-react";

interface CompanionProduct {
  id: string;
  name: string;
  sku: string;
  sellingPrice?: number | string;
}

interface CompanionItemsPickerProps {
  selectedItems: CompanionProduct[];
  onChange: (items: CompanionProduct[]) => void;
  excludeProductId?: string;
}

export function CompanionItemsPicker({
  selectedItems,
  onChange,
  excludeProductId,
}: CompanionItemsPickerProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CompanionProduct[]>([]);
  const [rawCount, setRawCount] = useState(0);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      setRawCount(0);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(search)}&limit=25`);
      const json = await res.json();
      const raw = (json.data ?? []) as CompanionProduct[];
      setRawCount(raw.length);
      // Filter out already selected and self
      const filtered = raw.filter(
        (p) =>
          p.id !== excludeProductId &&
          !selectedItems.some((s) => s.id === p.id)
      );
      setResults(filtered);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, excludeProductId, selectedItems]);

  function addItem(product: CompanionProduct) {
    onChange([...selectedItems, product]);
    setSearch("");
    setResults([]);
  }

  function removeItem(id: string) {
    onChange(selectedItems.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-3">
      {/* Selected items */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <Badge key={item.id} variant="secondary" className="gap-1 pr-1">
              {item.name} ({item.sku})
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search products to add as companion..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="border rounded-md divide-y max-h-48 overflow-auto">
          {results.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between px-3 py-2 hover:bg-gray-50"
            >
              <div>
                <span className="text-sm font-medium">{product.name}</span>
                <span className="ml-2 text-xs text-gray-500">{product.sku}</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => addItem(product)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {rawCount === 25 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Showing first 25 — keep typing to refine.
            </div>
          )}
        </div>
      )}

      {searching && (
        <p className="text-xs text-gray-500">Searching...</p>
      )}
    </div>
  );
}
