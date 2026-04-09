"use client";

import { useState, useEffect, use } from "react";
import { ProductForm } from "@/components/products/product-form";

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [product, setProduct] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((json) => {
        setProduct(json.data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <p className="text-gray-500">Loading product...</p>;
  }

  if (!product) {
    return <p className="text-red-600">Product not found</p>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Edit: {String(product.name)}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          SKU: {String(product.sku)}
        </p>
      </div>
      <ProductForm productId={id} initialData={product} />
    </div>
  );
}
