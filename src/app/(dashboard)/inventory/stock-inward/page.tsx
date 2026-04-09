import { StockInwardForm } from "@/components/inventory/stock-inward-form";

export default function StockInwardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stock Inward</h1>
        <p className="mt-1 text-sm text-gray-500">
          Record new stock arrival — creates a batch with landed cost
        </p>
      </div>
      <StockInwardForm />
    </div>
  );
}
