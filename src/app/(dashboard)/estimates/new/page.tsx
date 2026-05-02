"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Plus, Trash2 } from "lucide-react";

interface CartItem {
  key: number;
  productId: string | null;
  isCustomItem: boolean;
  customItemName?: string;
  productName: string;
  qty: string;
  unitPrice: string;
  discountAmount: string;
  installationCharge: string;
  taxRatePercent: number;
  hsnCode: string | null;
}

interface CustomerData {
  id: string;
  name: string;
  phone: string | null;
  vehicles: {
    id: string;
    vehicleMake: { name: string };
    vehicleModel: { name: string };
    registrationNumber: string | null;
  }[];
}

let cartKeyCounter = 0;

export default function NewEstimatePage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phoneChecking, setPhoneChecking] = useState(false);

  const [validityDays, setValidityDays] = useState("15");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [customItemOpen, setCustomItemOpen] = useState(false);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");

  // Search products
  useEffect(() => {
    if (productSearch.length < 1) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(productSearch)}&limit=25`);
      const json = await res.json();
      setSearchResults(json.data ?? []);
    }, 250);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // Auto-check phone against existing customers
  async function checkPhone(phone: string) {
    if (phone.length !== 10 || selectedCustomer) return;
    setPhoneChecking(true);
    const res = await fetch(`/api/customers?q=${phone}&limit=1`);
    const json = await res.json();
    const match = (json.data ?? []).find((c: CustomerData) => c.phone === phone);
    if (match) {
      setSelectedCustomer(match);
      setCustomerName(match.name);
    }
    setPhoneChecking(false);
  }

  const n = (v: string | number) => Number(v) || 0;

  function addProduct(p: Record<string, unknown>) {
    const taxRate = ((p.taxRate as Record<string, unknown>)?.metadata as Record<string, number> | null)?.rate ?? 0;
    const bundleSize = Number(p.bundleSize) || 1;
    const perUnitPrice = Number(p.sellingPrice) / bundleSize;
    setCartItems((prev) => [...prev, {
      key: ++cartKeyCounter,
      productId: p.id as string,
      isCustomItem: false,
      productName: p.name as string,
      qty: "1",
      unitPrice: String(perUnitPrice),
      discountAmount: "0",
      installationCharge: String(Number(p.installationCharge)),
      taxRatePercent: taxRate,
      hsnCode: (p.hsnCode as string) ?? null,
    }]);
    setProductSearch("");
    setSearchResults([]);
  }

  function addCustom() {
    if (!customItemName || !customItemPrice) return;
    setCartItems((prev) => [...prev, {
      key: ++cartKeyCounter,
      productId: null,
      isCustomItem: true,
      customItemName,
      productName: customItemName,
      qty: "1",
      unitPrice: customItemPrice,
      discountAmount: "0",
      installationCharge: "0",
      taxRatePercent: 0,
      hsnCode: null,
    }]);
    setCustomItemName("");
    setCustomItemPrice("");
    setCustomItemOpen(false);
  }

  function updateItem(key: number, field: string, value: string) {
    setCartItems((prev) => prev.map((i) => i.key === key ? { ...i, [field]: value } : i));
  }

  const subtotal = cartItems.reduce((s, i) =>
    s + (n(i.unitPrice) - n(i.discountAmount)) * n(i.qty) + n(i.installationCharge), 0);
  const grandTotal = subtotal;

  async function handleSubmit() {
    if (cartItems.length === 0) { toast.error("Add at least one item"); return; }
    setSubmitting(true);

    const res = await fetch("/api/estimates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: selectedCustomer?.id ?? null,
        vehicleId: selectedVehicleId || null,
        customerName: (selectedCustomer?.name ?? customerName) || null,
        customerPhone: (selectedCustomer?.phone ?? customerPhone) || null,
        items: cartItems.map((i) => ({
          productId: i.isCustomItem ? null : i.productId,
          isCustomItem: i.isCustomItem,
          customItemName: i.isCustomItem ? i.customItemName : null,
          qty: n(i.qty),
          unitPrice: n(i.unitPrice),
          discountAmount: n(i.discountAmount),
          installationCharge: n(i.installationCharge),
          taxRatePercent: i.taxRatePercent,
          hsnCode: i.hsnCode,
        })),
        validityDays: n(validityDays),
        notes: notes || null,
      }),
    });

    setSubmitting(false);
    const text = await res.text();
    let result;
    try { result = JSON.parse(text); } catch { toast.error("Server error"); return; }
    if (!res.ok) { toast.error(result.error || "Failed"); return; }

    toast.success(`Estimate ${result.data.estimateNumber} created`);
    router.push(`/estimates/${result.data.id}`);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">New Estimate</h1>

      {/* Customer + Vehicle */}
      <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-white">
        <div className="space-y-3">
          <Label>Customer</Label>
          {selectedCustomer ? (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-blue-900">{selectedCustomer.name}</p>
                  <p className="text-sm text-blue-700">{selectedCustomer.phone || customerPhone}</p>
                  <p className="text-xs text-blue-500">Linked to existing customer</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedCustomer(null); setSelectedVehicleId(""); setCustomerPhone(""); setCustomerName(""); }}>✕</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Phone Number</Label>
                <Input value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    if (e.target.value.length === 10) checkPhone(e.target.value);
                  }}
                  onBlur={() => { if (customerPhone.length === 10) checkPhone(customerPhone); }}
                  placeholder="Enter 10-digit mobile" maxLength={10} className="h-8 text-sm" />
                {phoneChecking && <p className="text-xs text-gray-400">Checking...</p>}
              </div>
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name" className="h-8 text-sm" />
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          {selectedCustomer && selectedCustomer.vehicles.length > 0 && (
            <>
              <Label>Vehicle</Label>
              <Select value={selectedVehicleId} onValueChange={(v) => setSelectedVehicleId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select vehicle..." /></SelectTrigger>
                <SelectContent>
                  {selectedCustomer.vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.vehicleMake.name} {v.vehicleModel.name} {v.registrationNumber ? `(${v.registrationNumber})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <div>
            <Label>Validity (days)</Label>
            <Input type="number" min="1" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} className="w-32" />
          </div>
        </div>
      </div>

      {/* Product Search */}
      <div className="p-4 border rounded-lg bg-white space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input ref={searchRef} placeholder="Search product..." value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)} className="pl-10" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setCustomItemOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Custom Item
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div className="border rounded divide-y max-h-48 overflow-auto">
            {searchResults.map((p) => (
              <button key={p.id as string} type="button"
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex justify-between"
                onClick={() => addProduct(p)}>
                <span className="font-medium text-sm">{p.name as string} <span className="text-gray-500">({p.sku as string})</span></span>
                <span className="text-sm">Rs.{(Number(p.sellingPrice as number) / (Number(p.bundleSize) || 1)).toFixed(2)}</span>
              </button>
            ))}
            {searchResults.length === 25 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Showing first 25 — keep typing to refine.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart Items */}
      {cartItems.length > 0 && (
        <div className="p-4 border rounded-lg bg-white space-y-3">
          <h3 className="font-semibold">Line Items ({cartItems.length})</h3>
          {cartItems.map((item) => (
            <div key={item.key} className="flex gap-3 items-end border-b pb-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{item.productName}</p>
                <p className="text-xs text-gray-500">{item.isCustomItem ? <Badge variant="secondary" className="text-xs">Custom</Badge> : item.productId}</p>
              </div>
              <div className="w-20">
                <Label className="text-xs">Qty</Label>
                <Input type="number" min="1" value={item.qty} onChange={(e) => updateItem(item.key, "qty", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="w-28">
                <Label className="text-xs">Price</Label>
                <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.key, "unitPrice", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="w-24">
                <Label className="text-xs">Discount</Label>
                <Input type="number" value={item.discountAmount} onChange={(e) => updateItem(item.key, "discountAmount", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="w-24">
                <Label className="text-xs">Install</Label>
                <Input type="number" value={item.installationCharge} onChange={(e) => updateItem(item.key, "installationCharge", e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="w-24 text-right text-sm font-medium pt-5">
                Rs.{((n(item.unitPrice) - n(item.discountAmount)) * n(item.qty) + n(item.installationCharge)).toFixed(0)}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCartItems((p) => p.filter((i) => i.key !== item.key))}>
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </div>
          ))}

          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Grand Total:</span>
            <span>Rs.{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Notes + Submit */}
      <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={submitting || cartItems.length === 0}>
          {submitting ? "Creating..." : "Create Estimate"}
        </Button>
        <Button variant="outline" onClick={() => router.push("/estimates")}>Cancel</Button>
      </div>

      {/* Custom Item Dialog */}
      <Dialog open={customItemOpen} onOpenChange={setCustomItemOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Custom Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Item Name *</Label><Input value={customItemName} onChange={(e) => setCustomItemName(e.target.value)} autoFocus /></div>
            <div><Label>Price (Rs.) *</Label><Input type="number" value={customItemPrice} onChange={(e) => setCustomItemPrice(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomItemOpen(false)}>Cancel</Button>
            <Button onClick={addCustom} disabled={!customItemName || !customItemPrice}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
