import { ProductForm } from "@/components/products/product-form";

export default function NewProductPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Product</h1>
        <p className="mt-1 text-sm text-gray-500">Add a new product to the catalog</p>
      </div>
      <ProductForm />
    </div>
  );
}
