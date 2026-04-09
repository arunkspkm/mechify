"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { getMaxDiscountForOperator } from "@/lib/margin-guard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AsyncSelect } from "@/components/shared/async-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { AutocompleteInput } from "@/components/shared/autocomplete-input";
import { QuickAddProduct } from "@/components/shared/quick-add-product";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Trash2,
  UserPlus,
  Car,
  CreditCard,
  AlertTriangle,
  Package,
} from "lucide-react";

// ==================== Types ====================

interface SearchProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  sellingPrice: string | number;
  mrp: string | number;
  installationCharge: string | number;
  maxDiscountPercent: string | number | null;
  hasExpiry: boolean;
  bundleSize: string | number;
  hsnCode: string | null;
  unit: { id: string; name: string; code: string | null };
  taxRate: { id: string; name: string; metadata: Record<string, number> | null } | null;
  category: { id: string; name: string };
  primaryImage: string | null;
  stock: number;
  lastBatch?: { landedCostPerUnit: number };
  companionProducts: {
    companionProduct: { id: string; name: string; sku: string; sellingPrice: string | number };
  }[];
}

interface CartItem {
  key: number;
  productId: string | null;
  isCustomItem: boolean;
  customItemName?: string;
  productName: string;
  sku: string;
  qty: string;
  unitPrice: string;
  discountAmount: string;
  installationCharge: string;
  maxDiscountPercent: number;
  landedCostPerUnit: number;
  stock: number;
  taxRatePercent: number;
  companions: { id: string; name: string; sku: string }[];
}

interface CustomerData {
  id: string;
  name: string;
  phone: string | null;
  outstandingBalance: string | number;
  loyaltyPoints: number;
  vehicles: VehicleData[];
}

interface VehicleData {
  id: string;
  vehicleMake: { name: string };
  vehicleModel: { name: string };
  year: number | null;
  registrationNumber: string | null;
}

interface PaymentLine {
  key: number;
  paymentMethodId: string;
  paymentMethodName: string;
  amount: string;
  reference: string;
}

interface PaymentMethod {
  id: string;
  name: string;
}

interface VehicleMake {
  id: string;
  name: string;
}

interface VehicleModel {
  id: string;
  name: string;
  parentId: string;
}

let cartKeyCounter = 0;
let paymentKeyCounter = 0;

// ==================== Component ====================

export function POSScreen() {
  const router = useRouter();
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "OWNER";
  const searchRef = useRef<HTMLInputElement>(null);

  // Product search
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
  const [searchHighlight, setSearchHighlight] = useState(-1);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [customItemOpen, setCustomItemOpen] = useState(false);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");
  const [customItemQty, setCustomItemQty] = useState("1");

  // Cart — auto-restore from localStorage on mount
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [companionAlert, setCompanionAlert] = useState<{ id: string; name: string; sku: string }[]>([]);

  // Customer
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  // Vehicle
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [vehicleMakes, setVehicleMakes] = useState<VehicleMake[]>([]);
  const [vehicleModels, setVehicleModels] = useState<VehicleModel[]>([]);
  const [newVehicleMakeId, setNewVehicleMakeId] = useState("");
  const [newVehicleModelId, setNewVehicleModelId] = useState("");
  const [newVehicleYear, setNewVehicleYear] = useState("");
  const [newVehicleRegNo, setNewVehicleRegNo] = useState("");

  // Payment
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [isCreditSale, setIsCreditSale] = useState(false);
  const [notes, setNotes] = useState("");

  // Loyalty
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyRedemptionValue, setLoyaltyRedemptionValue] = useState(0);
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);

  // Held bills
  interface HeldBill {
    id: string;
    label: string;
    heldAt: string;
    cartItems: CartItem[];
    customer: CustomerData | null;
    customerName: string;
    customerPhone: string;
    vehicleId: string;
    paymentLines: PaymentLine[];
    isCreditSale: boolean;
    loyaltyPointsToRedeem: number;
    notes: string;
  }
  const [heldBills, setHeldBills] = useState<HeldBill[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("mechify_held_bills");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [heldBillsOpen, setHeldBillsOpen] = useState(false);

  // Save held bills to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("mechify_held_bills", JSON.stringify(heldBills));
  }, [heldBills]);

  // Auto-restore active cart on mount (synchronous via ref to avoid overwrite)
  const cartRestored = useRef(false);
  useEffect(() => {
    if (cartRestored.current) return;
    cartRestored.current = true;
    try {
      const saved = localStorage.getItem("mechify_active_cart");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.cartItems?.length > 0) {
          setCartItems(data.cartItems);
          setSelectedCustomer(data.customer ?? null);
          setNewCustomerName(data.customerName ?? "");
          setNewCustomerPhone(data.customerPhone ?? "");
          setSelectedVehicleId(data.vehicleId ?? "");
          setNotes(data.notes ?? "");
        }
      }
    } catch {}
  }, []);

  // Auto-save active cart to localStorage (debounced, skip if not yet restored)
  useEffect(() => {
    if (!cartRestored.current) return;
    const timer = setTimeout(() => {
      if (cartItems.length > 0) {
        localStorage.setItem("mechify_active_cart", JSON.stringify({
          cartItems,
          customer: selectedCustomer,
          customerName: newCustomerName,
          customerPhone: newCustomerPhone,
          vehicleId: selectedVehicleId,
          notes,
        }));
      } else {
        localStorage.removeItem("mechify_active_cart");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [cartItems, selectedCustomer, newCustomerName, newCustomerPhone, selectedVehicleId, notes]);

  function holdCurrentBill() {
    if (cartItems.length === 0) { toast.error("Nothing to hold — cart is empty"); return; }
    const label = selectedCustomer?.name ?? newCustomerName ?? `Bill #${heldBills.length + 1}`;
    const bill: HeldBill = {
      id: Date.now().toString(),
      label,
      heldAt: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      cartItems: [...cartItems],
      customer: selectedCustomer,
      customerName: newCustomerName,
      customerPhone: newCustomerPhone,
      vehicleId: selectedVehicleId,
      paymentLines: [...paymentLines],
      isCreditSale,
      loyaltyPointsToRedeem,
      notes,
    };
    setHeldBills((prev) => [...prev, bill]);
    clearPOS();
    toast.success(`Bill held: ${label}`);
  }

  function resumeBill(billId: string) {
    const bill = heldBills.find((b) => b.id === billId);
    if (!bill) return;
    // Save current cart if it has items
    if (cartItems.length > 0) {
      holdCurrentBill();
    }
    // Restore
    setCartItems(bill.cartItems);
    setSelectedCustomer(bill.customer);
    setNewCustomerName(bill.customerName);
    setNewCustomerPhone(bill.customerPhone);
    setSelectedVehicleId(bill.vehicleId);
    setPaymentLines(bill.paymentLines);
    setIsCreditSale(bill.isCreditSale);
    setLoyaltyPointsToRedeem(bill.loyaltyPointsToRedeem);
    setNotes(bill.notes);
    // Remove from held
    setHeldBills((prev) => prev.filter((b) => b.id !== billId));
    setHeldBillsOpen(false);
    toast.success(`Resumed: ${bill.label}`);
  }

  function discardHeldBill(billId: string) {
    setHeldBills((prev) => prev.filter((b) => b.id !== billId));
    toast.success("Held bill discarded");
  }

  function clearPOS() {
    setCartItems([]);
    setSelectedCustomer(null);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setSelectedVehicleId("");
    setNewVehicleMakeId("");
    setNewVehicleModelId("");
    setNewVehicleYear("");
    setNewVehicleRegNo("");
    setPaymentLines([]);
    setIsCreditSale(false);
    setLoyaltyPointsToRedeem(0);
    setNotes("");
    setCompanionAlert([]);
    localStorage.removeItem("mechify_active_cart");
    searchRef.current?.focus();
  }

  // Config
  const [gstEnabled, setGstEnabled] = useState(false);
  const [globalMaxDiscountPercent, setGlobalMaxDiscountPercent] = useState(100);

  const [submitting, setSubmitting] = useState(false);
  const [confirmSaleOpen, setConfirmSaleOpen] = useState(false);
  const [estimateId, setEstimateId] = useState<string | null>(null);

  // Active shift
  const [activeShift, setActiveShift] = useState<{ id: string; operatorName: string; openingBalance: number } | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);

  // Load payment methods, config, and active shift
  useEffect(() => {
    fetch("/api/master-data?type=PAYMENT_METHOD")
      .then((r) => r.json())
      .then((j) => setPaymentMethods(j.data ?? []));

    fetch("/api/master-data?type=VEHICLE_MAKE")
      .then((r) => r.json())
      .then((j) => setVehicleMakes(j.data ?? []));

    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setGstEnabled(j.data.gstEnabled);
          setGlobalMaxDiscountPercent(Number(j.data.defaultDiscountMax) || 100);
          setLoyaltyEnabled(j.data.loyaltyEnabled ?? false);
          setLoyaltyRedemptionValue(Number(j.data.loyaltyRedemptionValue) || 0);
        }
      })
      .catch(() => {});

    // Check for open shift
    fetch("/api/shifts?status=OPEN&limit=1")
      .then((r) => r.json())
      .then((j) => {
        const openShift = (j.data ?? [])[0];
        if (openShift) {
          setActiveShift({
            id: openShift.id,
            operatorName: openShift.operator.name,
            openingBalance: Number(openShift.openingBalance),
          });
        }
        setShiftLoading(false);
      })
      .catch(() => setShiftLoading(false));
  }, []);

  // Focus search on mount + load estimate data if converting
  useEffect(() => {
    searchRef.current?.focus();

    // Check if we're converting from an estimate
    const raw = sessionStorage.getItem("estimate_to_invoice");
    if (raw) {
      try {
        const data = JSON.parse(raw);
        setEstimateId(data.estimateId ?? null);

        // Load customer if provided
        if (data.customerId) {
          fetch(`/api/customers?q=&limit=100`)
            .then((r) => r.json())
            .then((json) => {
              const customer = (json.data ?? []).find((c: CustomerData) => c.id === data.customerId);
              if (customer) {
                setSelectedCustomer(customer);
                if (data.vehicleId) setSelectedVehicleId(data.vehicleId);
              }
            });
        }

        // Load cart items from estimate
        if (data.items) {
          const cartFromEstimate: CartItem[] = data.items.map((item: Record<string, unknown>) => ({
            key: ++cartKeyCounter,
            productId: item.productId as string | null,
            isCustomItem: (item.isCustomItem as boolean) ?? !item.productId,
            customItemName: (item.customItemName as string) ?? (item.isCustomItem ? item.productName as string : undefined),
            productName: item.productName as string,
            sku: (item.sku as string) ?? (item.productId ? "..." : "CUSTOM"),
            qty: String(item.qty),
            unitPrice: String(item.unitPrice),
            discountAmount: String(item.discountAmount ?? 0),
            installationCharge: String(item.installationCharge ?? 0),
            maxDiscountPercent: 100,
            landedCostPerUnit: 0,
            stock: 9999,
            taxRatePercent: 0,
            companions: [],
          }));
          setCartItems(cartFromEstimate);
        }

        setNotes(`Converted from estimate ${data.estimateId ? "" : ""}`);
      } catch { /* ignore parse errors */ }
      sessionStorage.removeItem("estimate_to_invoice");
    }
  }, []);

  // Search products
  useEffect(() => {
    if (productSearch.length < 1) {
      setSearchResults([]);
      setSearchHighlight(-1);
      return;
    }
    setSearchHighlight(-1);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(productSearch)}&limit=10`, { signal: controller.signal });
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json.data ?? []);
        }
      } catch { /* aborted or network error */ }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [productSearch]);

  // Load vehicle models when make changes
  useEffect(() => {
    if (!newVehicleMakeId) { setVehicleModels([]); return; }
    fetch(`/api/master-data?type=VEHICLE_MODEL&parentId=${newVehicleMakeId}`)
      .then((r) => r.json())
      .then((j) => setVehicleModels(j.data ?? []));
  }, [newVehicleMakeId]);

  // ==================== Cart Logic ====================

  function addToCart(product: SearchProduct) {
    const existing = cartItems.find((i) => i.productId === product.id);
    if (existing) {
      setCartItems((prev) =>
        prev.map((i) => i.productId === product.id ? { ...i, qty: String(Number(i.qty || 0) + 1) } : i)
      );
    } else {
      const taxRate = (product.taxRate?.metadata as Record<string, number> | null)?.rate ?? 0;
      setCartItems((prev) => [
        ...prev,
        {
          key: ++cartKeyCounter,
          productId: product.id,
          isCustomItem: false,
          productName: product.name,
          sku: product.sku,
          qty: "1",
          unitPrice: String(Number(product.sellingPrice)),
          discountAmount: "0",
          installationCharge: String(Number(product.installationCharge)),
          maxDiscountPercent: Number(product.maxDiscountPercent ?? 100),
          landedCostPerUnit: product.lastBatch?.landedCostPerUnit ?? 0,
          stock: product.stock,
          taxRatePercent: taxRate,
          companions: product.companionProducts.map((c) => c.companionProduct),
        },
      ]);

      // Show companion alert
      if (product.companionProducts.length > 0) {
        const newCompanions = product.companionProducts
          .map((c) => c.companionProduct)
          .filter((c) => !cartItems.some((ci) => ci.productId === c.id));
        if (newCompanions.length > 0) {
          setCompanionAlert(newCompanions);
        }
      }
    }

    setProductSearch("");
    setSearchResults([]);
    searchRef.current?.focus();
  }

  function updateCartItem(key: number, field: string, value: string) {
    setCartItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, [field]: value } : i))
    );
  }

  function removeCartItem(key: number) {
    setCartItems((prev) => prev.filter((i) => i.key !== key));
  }

  function addCustomItem() {
    if (!customItemName || !customItemPrice) return;
    setCartItems((prev) => [
      ...prev,
      {
        key: ++cartKeyCounter,
        productId: null,
        isCustomItem: true,
        customItemName: customItemName,
        productName: customItemName,
        sku: "CUSTOM",
        qty: customItemQty || "1",
        unitPrice: customItemPrice,
        discountAmount: "0",
        installationCharge: "0",
        maxDiscountPercent: 100,
        landedCostPerUnit: 0,
        stock: 9999,
        taxRatePercent: 0,
        companions: [],
      },
    ]);
    setCustomItemName("");
    setCustomItemPrice("");
    setCustomItemQty("1");
    setCustomItemOpen(false);
    searchRef.current?.focus();
  }

  // ==================== Calculations ====================

  // Helper to safely parse cart item string values to numbers
  const n = (v: string | number) => Number(v) || 0;

  const subtotal = cartItems.reduce((s, i) => {
    const linePrice = (n(i.unitPrice) - n(i.discountAmount)) * n(i.qty) + n(i.installationCharge);
    return s + linePrice;
  }, 0);

  const taxTotal = gstEnabled
    ? cartItems.reduce((s, i) => {
        const taxable = (n(i.unitPrice) - n(i.discountAmount)) * n(i.qty) + n(i.installationCharge);
        return s + taxable * (i.taxRatePercent / 100);
      }, 0)
    : 0;

  const discountTotal = cartItems.reduce((s, i) => s + n(i.discountAmount) * n(i.qty), 0);
  const loyaltyDiscountAmount = loyaltyPointsToRedeem * loyaltyRedemptionValue;
  const grandTotal = Math.max(0, subtotal + taxTotal - loyaltyDiscountAmount);
  const totalPaid = paymentLines.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balanceDue = grandTotal - totalPaid;

  // ==================== Payment ====================

  function addPaymentLine() {
    const defaultMethod = paymentMethods[0];
    if (!defaultMethod) return;
    setPaymentLines((prev) => [
      ...prev,
      {
        key: ++paymentKeyCounter,
        paymentMethodId: defaultMethod.id,
        paymentMethodName: defaultMethod.name,
        amount: balanceDue > 0 ? String(Math.round(balanceDue * 100) / 100) : "",
        reference: "",
      },
    ]);
  }

  function updatePaymentLine(key: number, field: string, value: string) {
    setPaymentLines((prev) =>
      prev.map((p) => (p.key === key ? { ...p, [field]: value } : p))
    );
  }

  function removePaymentLine(key: number) {
    setPaymentLines((prev) => prev.filter((p) => p.key !== key));
  }

  // ==================== Customer ====================

  async function createCustomer() {
    if (!newCustomerName.trim()) {
      toast.error("Customer name is required");
      return;
    }

    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCustomerName, phone: newCustomerPhone || null }),
    });

    const json = await res.json();

    if (!res.ok) {
      // If duplicate phone, offer to use the existing customer
      if (res.status === 409 && json.existingCustomer) {
        const useExisting = window.confirm(
          `${json.error}\n\nDo you want to use the existing customer "${json.existingCustomer.name}" instead?`
        );
        if (useExisting) {
          setSelectedCustomer(json.existingCustomer);
          setNewCustomerOpen(false);
          setNewCustomerName("");
          setNewCustomerPhone("");
        }
        return;
      }
      toast.error(json.error || "Failed to create customer");
      return;
    }

    setSelectedCustomer(json.data);
    setNewCustomerOpen(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
    toast.success("Customer created");
  }

  async function addVehicle() {
    if (selectedCustomer) {
      // Existing customer — save vehicle to DB immediately
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          vehicleMakeId: newVehicleMakeId,
          vehicleModelId: newVehicleModelId,
          year: newVehicleYear ? Number(newVehicleYear) : null,
          registrationNumber: newVehicleRegNo || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to add vehicle");
        return;
      }
      const json = await res.json();
      // Refresh customer data
      const custRes = await fetch(`/api/customers?q=${selectedCustomer.phone || selectedCustomer.name}`);
      const custJson = await custRes.json();
      const updated = (custJson.data ?? []).find((c: CustomerData) => c.id === selectedCustomer.id);
      if (updated) {
        setSelectedCustomer(updated);
        setSelectedVehicleId(json.data.id);
      }
      toast.success("Vehicle added");
    } else {
      // New customer — just store details, will be created at invoice completion
      toast.success("Vehicle details saved — will be linked when invoice is completed");
    }
    setAddVehicleOpen(false);
  }

  // ==================== Submit ====================

  async function handleCompleteSale() {
    if (cartItems.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    // Clear localStorage immediately to prevent double-submit on refresh
    localStorage.removeItem("mechify_active_cart");

    if (!isCreditSale && balanceDue > 0.01) {
      toast.error(`Payment short by Rs.${balanceDue.toFixed(2)}. Add payment or mark as credit sale.`);
      return;
    }

    if (isCreditSale && !selectedCustomer && !newCustomerPhone) {
      toast.error("Customer is required for credit sales. Please enter a phone number.");
      return;
    }

    setSubmitting(true);

    // Auto-create customer if phone + name provided but not yet linked
    let customerId = selectedCustomer?.id ?? null;
    if (!customerId && newCustomerPhone.length === 10 && newCustomerName.trim()) {
      const custRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCustomerName.trim(), phone: newCustomerPhone }),
      });
      const custJson = await custRes.json();
      if (custRes.ok) {
        customerId = custJson.data.id;
      } else if (custRes.status === 409 && custJson.existingCustomer) {
        // Phone belongs to existing customer — use them
        customerId = custJson.existingCustomer.id;
      }
    }

    // Auto-create vehicle for new customer if vehicle details provided
    let vehicleId = selectedVehicleId || null;
    if (!vehicleId && customerId && newVehicleMakeId && newVehicleModelId) {
      try {
        const vehRes = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId,
            vehicleMakeId: newVehicleMakeId,
            vehicleModelId: newVehicleModelId,
            year: newVehicleYear ? Number(newVehicleYear) : null,
            registrationNumber: newVehicleRegNo || null,
          }),
        });
        if (vehRes.ok) {
          const vehJson = await vehRes.json();
          vehicleId = vehJson.data.id;
        }
      } catch { /* proceed without vehicle */ }
    }

    const res = await fetch("/api/billing/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        vehicleId,
        items: cartItems.map((i) => ({
          productId: i.isCustomItem ? null : i.productId,
          isCustomItem: i.isCustomItem,
          customItemName: i.isCustomItem ? i.customItemName : null,
          qty: Number(i.qty) || 0,
          unitPrice: Number(i.unitPrice) || 0,
          discountAmount: Number(i.discountAmount) || 0,
          installationCharge: Number(i.installationCharge) || 0,
          taxRatePercent: i.taxRatePercent,
        })),
        payments: paymentLines
          .filter((p) => Number(p.amount) > 0)
          .map((p) => ({
            paymentMethodId: p.paymentMethodId,
            amount: Number(p.amount),
            reference: p.reference || null,
          })),
        isCreditSale,
        loyaltyPointsRedeemed: loyaltyPointsToRedeem > 0 ? loyaltyPointsToRedeem : 0,
        shiftId: activeShift?.id ?? null,
        notes: notes || null,
      }),
    });

    setSubmitting(false);

    const text = await res.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      // Restore cart to localStorage on failure
      cartRestored.current = true;
      toast.error(`Server error (${res.status}): ${text.slice(0, 200) || "Empty response"}`);
      return;
    }

    if (!res.ok) {
      // Restore cart to localStorage on failure
      cartRestored.current = true;
      toast.error(result.error || "Failed to create invoice");
      return;
    }
    toast.success(`Invoice ${result.data.invoiceNumber} created!`);
    clearPOS();
    router.push(`/billing/invoices/${result.data.id}`);
  }

  // clearPOS is now clearPOS defined above

  // ==================== Render ====================

  // Show shift required screen
  if (!shiftLoading && !activeShift) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-7rem)]">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <CreditCard className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">No Active Shift</h2>
          <p className="text-gray-500 max-w-md">
            You need to open a shift before you can create invoices.
            This ensures all sales are tracked for cash reconciliation.
          </p>
          <Button onClick={() => router.push("/shifts")}>
            Go to Shifts → Open Shift
          </Button>
        </div>
      </div>
    );
  }

  if (shiftLoading) {
    return <div className="flex items-center justify-center h-[calc(100vh-7rem)]"><p className="text-gray-500">Loading...</p></div>;
  }

  return (
    <div className="flex flex-col gap-2 h-[calc(100vh-7rem)]">
      {/* Shift Banner */}
      {activeShift && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-800">
              Shift active — {activeShift.operatorName} | Opening: Rs.{activeShift.openingBalance.toFixed(0)}
            </span>
          </div>
          <Button variant="ghost" size="sm" className="text-green-700 h-6 text-xs" onClick={() => router.push(`/shifts/${activeShift.id}`)}>
            View Shift
          </Button>
        </div>
      )}

      {/* Hold / Resume bar */}
      <div className="flex items-center gap-2 px-1">
        <Button variant="outline" size="sm" onClick={holdCurrentBill} disabled={cartItems.length === 0}>
          Hold Bill
        </Button>
        {heldBills.length > 0 && (
          <Button variant="outline" size="sm" className="text-amber-700 border-amber-300"
            onClick={() => setHeldBillsOpen(!heldBillsOpen)}>
            Held Bills ({heldBills.length})
          </Button>
        )}
        {heldBillsOpen && heldBills.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {heldBills.map((bill) => (
              <div key={bill.id} className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-xs">
                <button type="button" onClick={() => resumeBill(bill.id)} className="font-medium text-amber-800 hover:underline">
                  {bill.label} ({bill.cartItems.length} items)
                </button>
                <span className="text-amber-400">{bill.heldAt}</span>
                <button type="button" onClick={() => discardHeldBill(bill.id)} className="text-red-400 hover:text-red-600 ml-1">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
      {/* LEFT: Product Search + Results */}
      <div className="w-80 flex flex-col border rounded-lg bg-white">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              ref={searchRef}
              placeholder="Search product (F1)..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              onKeyDown={(e) => {
                if (searchResults.length === 0) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSearchHighlight((prev) => Math.min(prev + 1, searchResults.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSearchHighlight((prev) => Math.max(prev - 1, 0));
                } else if (e.key === "Enter" && searchHighlight >= 0) {
                  e.preventDefault();
                  addToCart(searchResults[searchHighlight]);
                  setProductSearch("");
                  setSearchResults([]);
                  setSearchHighlight(-1);
                }
              }}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {searchResults.length > 0 ? (
            <div className="divide-y">
              {searchResults.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  className={`w-full text-left p-3 transition-colors ${idx === searchHighlight ? "bg-blue-100" : "hover:bg-blue-50"}`}
                  onClick={() => addToCart(p)}
                  onMouseEnter={() => setSearchHighlight(idx)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.sku} • {p.category.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Rs.{Number(p.sellingPrice).toFixed(0)}</p>
                      <p className="text-xs text-gray-500">Stock: {p.stock}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : productSearch.length >= 2 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No products found.
              <Button
                variant="link"
                size="sm"
                className="text-blue-600 p-0 ml-1"
                onClick={() => setQuickAddOpen(true)}
              >
                + Create new
              </Button>
            </div>
          ) : (
            <div className="p-4 text-center text-gray-400">
              <Package className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm">Search to add products</p>
            </div>
          )}
        </div>

        <div className="p-2 border-t">
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setQuickAddOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> New Product
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setCustomItemOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Custom Item
            </Button>
          </div>
        </div>
      </div>

      {/* CENTER: Cart */}
      <div className="flex-1 flex flex-col border rounded-lg bg-white">
        <div className="p-3 border-b flex justify-between items-center">
          <h2 className="font-semibold">Cart ({cartItems.length} items)</h2>
          {cartItems.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearPOS}>Clear All</Button>
          )}
        </div>

        {/* Companion Alert */}
        {companionAlert.length > 0 && (
          <div className="mx-3 mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
            <div className="flex items-center gap-1 text-amber-800 font-medium mb-1">
              <AlertTriangle className="h-4 w-4" />
              Related items you may need:
            </div>
            <div className="flex flex-wrap gap-1">
              {companionAlert.map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={async () => {
                    const res = await fetch(`/api/products/search?q=${encodeURIComponent(c.sku)}&limit=1`);
                    const json = await res.json();
                    if (json.data?.[0]) addToCart(json.data[0]);
                  }}
                >
                  + {c.name}
                </Button>
              ))}
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setCompanionAlert([])}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-3">
          {cartItems.length === 0 ? (
            <div className="text-center text-gray-400 mt-20">
              <p>Cart is empty</p>
              <p className="text-sm">Search for products to add</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cartItems.map((item) => (
                <div key={item.key} className="border rounded p-3 space-y-2">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium text-sm">{item.productName}</p>
                      <p className="text-xs text-gray-500">
                        {item.isCustomItem ? (
                          <Badge variant="secondary" className="text-xs">Custom Item</Badge>
                        ) : (
                          item.sku
                        )}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeCartItem(item.key)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        max={item.stock}
                        value={item.qty}
                        onChange={(e) => updateCartItem(item.key, "qty", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Price</Label>
                      <Input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateCartItem(item.key, "unitPrice", e.target.value)}
                        disabled={!isOwner && !item.isCustomItem}
                        className={`h-8 text-sm ${!isOwner && !item.isCustomItem ? "bg-gray-50" : ""}`}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Discount</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.discountAmount}
                        onChange={(e) => updateCartItem(item.key, "discountAmount", e.target.value)}
                        className={`h-8 text-sm ${n(item.discountAmount) > 0 && (
                          (!isOwner && (item.maxDiscountPercent < 100 ? item.maxDiscountPercent : globalMaxDiscountPercent) < 100 && n(item.discountAmount) > n(item.unitPrice) * (item.maxDiscountPercent < 100 ? item.maxDiscountPercent : globalMaxDiscountPercent) / 100)
                          || (!item.isCustomItem && item.landedCostPerUnit > 0 && n(item.unitPrice) - n(item.discountAmount) <= item.landedCostPerUnit * 1.1)
                        ) ? "border-red-400" : ""}`}
                      />
                      {n(item.discountAmount) > 0 && (() => {
                        const unitPrice = n(item.unitPrice);
                        const disc = n(item.discountAmount);
                        const effectivePrice = unitPrice - disc;

                        // Check 1: Global max discount % (from Settings)
                        const maxDiscPercent = item.maxDiscountPercent < 100 ? item.maxDiscountPercent : globalMaxDiscountPercent;
                        const maxDiscByPercent = Math.floor(unitPrice * maxDiscPercent / 100);
                        if (!isOwner && disc > maxDiscByPercent && maxDiscPercent < 100) {
                          return <p className="text-[10px] text-red-600 mt-0.5">Max {maxDiscPercent}% = Rs.{maxDiscByPercent}</p>;
                        }

                        // Check 2: Margin guard (landed cost based)
                        if (!item.isCustomItem && item.landedCostPerUnit > 0) {
                          const maxDiscByCost = getMaxDiscountForOperator(unitPrice, item.landedCostPerUnit);
                          if (effectivePrice <= item.landedCostPerUnit) {
                            return <p className="text-[10px] text-red-600 mt-0.5">Below cost! Max: Rs.{Math.min(maxDiscByCost, maxDiscByPercent < 100 ? maxDiscByPercent : maxDiscByCost)}</p>;
                          }
                          if (!isOwner && effectivePrice < item.landedCostPerUnit * 1.1) {
                            return <p className="text-[10px] text-amber-600 mt-0.5">Low margin. Max: Rs.{Math.min(maxDiscByCost, maxDiscByPercent < 100 ? maxDiscByPercent : maxDiscByCost)}</p>;
                          }
                        }
                        return null;
                      })()}
                    </div>
                    <div>
                      <Label className="text-xs">Install</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.installationCharge}
                        onChange={(e) => updateCartItem(item.key, "installationCharge", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="text-right text-sm font-medium">
                    Rs.{((n(item.unitPrice) - n(item.discountAmount)) * n(item.qty) + n(item.installationCharge)).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        {cartItems.length > 0 && (
          <div className="border-t p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal:</span>
              <span>Rs.{subtotal.toFixed(2)}</span>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount:</span>
                <span>-Rs.{discountTotal.toFixed(2)}</span>
              </div>
            )}
            {gstEnabled && taxTotal > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Tax (GST):</span>
                <span>Rs.{taxTotal.toFixed(2)}</span>
              </div>
            )}
            {loyaltyDiscountAmount > 0 && (
              <div className="flex justify-between text-purple-600">
                <span>Loyalty ({loyaltyPointsToRedeem} pts):</span>
                <span>-Rs.{loyaltyDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Grand Total:</span>
              <span>Rs.{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Customer + Payment */}
      <div className="w-80 flex flex-col border rounded-lg bg-white">
        {/* Customer Section */}
        <div className="p-3 border-b space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-1">
            <UserPlus className="h-4 w-4" /> Customer
          </h3>
          {selectedCustomer ? (
            <div className="p-2 bg-blue-50 rounded-lg border border-blue-200 text-sm">
              <div className="flex justify-between">
                <div>
                  <p className="font-medium text-blue-900">{selectedCustomer.name}</p>
                  <p className="text-xs text-blue-700">{selectedCustomer.phone}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedCustomer(null); setSelectedVehicleId(""); setNewCustomerName(""); setNewCustomerPhone(""); }}>
                  ✕
                </Button>
              </div>
              {Number(selectedCustomer.outstandingBalance) > 0 && (
                <Badge variant="destructive" className="mt-1 text-xs">
                  Outstanding: Rs.{Number(selectedCustomer.outstandingBalance).toFixed(0)}
                </Badge>
              )}
              {loyaltyEnabled && selectedCustomer.loyaltyPoints > 0 && (
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {selectedCustomer.loyaltyPoints} pts
                    {loyaltyRedemptionValue > 0 && ` (Rs.${(selectedCustomer.loyaltyPoints * loyaltyRedemptionValue).toFixed(0)})`}
                  </Badge>
                  {loyaltyRedemptionValue > 0 && (
                    <button type="button" className="text-[10px] text-blue-600 underline"
                      onClick={() => setLoyaltyPointsToRedeem(loyaltyPointsToRedeem > 0 ? 0 : selectedCustomer.loyaltyPoints)}>
                      {loyaltyPointsToRedeem > 0 ? "Remove" : "Redeem"}
                    </button>
                  )}
                </div>
              )}
              {loyaltyPointsToRedeem > 0 && (
                <div className="mt-1 flex items-center gap-1">
                  <Input type="number" min="0" max={selectedCustomer.loyaltyPoints}
                    value={loyaltyPointsToRedeem}
                    onChange={(e) => setLoyaltyPointsToRedeem(Math.min(Number(e.target.value) || 0, selectedCustomer.loyaltyPoints))}
                    className="w-20 h-6 text-xs" />
                  <span className="text-[10px] text-green-600">
                    = Rs.{(loyaltyPointsToRedeem * loyaltyRedemptionValue).toFixed(0)} off
                  </span>
                </div>
              )}
            </div>
          ) : (
            <>
              <Input
                placeholder="Enter phone number..."
                value={newCustomerPhone}
                onChange={(e) => {
                  setNewCustomerPhone(e.target.value);
                  // Auto-search when 10 digits entered
                  if (e.target.value.length === 10) {
                    fetch(`/api/customers?q=${e.target.value}&limit=1`)
                      .then((r) => r.json())
                      .then((json) => {
                        const match = (json.data ?? []).find((c: { phone: string | null }) => c.phone === e.target.value);
                        if (match) {
                          setSelectedCustomer(match);
                          setNewCustomerPhone("");
                        }
                      });
                  }
                }}
                maxLength={10}
                className="text-sm h-8"
              />
              {newCustomerPhone.length === 10 && !selectedCustomer && (
                <Input
                  placeholder="Customer name..."
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="text-sm h-8"
                />
              )}
            </>
          )}
        </div>

        {/* Vehicle Section — show for existing customer OR new customer with phone entered */}
        {(selectedCustomer || newCustomerPhone.length === 10) && (
          <div className="p-3 border-b space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-1">
              <Car className="h-4 w-4" /> Vehicle
            </h3>
            {selectedCustomer && selectedCustomer.vehicles.length > 0 && (
              <AsyncSelect
                value={selectedVehicleId}
                onValueChange={setSelectedVehicleId}
                options={selectedCustomer.vehicles.map((v) => ({
                  id: v.id,
                  name: `${v.vehicleMake.name} ${v.vehicleModel.name}${v.registrationNumber ? ` (${v.registrationNumber})` : ""}`,
                }))}
                placeholder="Select vehicle..."
                className="text-sm h-8"
              />
            )}
            {/* Show inline vehicle info if new vehicle details entered for new customer */}
            {!selectedCustomer && newVehicleMakeId && newVehicleModelId && (
              <div className="p-2 bg-blue-50 rounded text-xs text-blue-800 cursor-pointer flex justify-between items-center"
                onClick={() => setAddVehicleOpen(true)} title="Click to edit">
                <span>
                  {vehicleMakes.find((m) => m.id === newVehicleMakeId)?.name} {vehicleModels.find((m) => m.id === newVehicleModelId)?.name}
                  {newVehicleRegNo && ` (${newVehicleRegNo})`}
                </span>
                <span className="text-blue-500 text-[10px]">Edit</span>
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setAddVehicleOpen(true)}>
              {newVehicleMakeId && newVehicleModelId && !selectedCustomer ? "Change Vehicle" : "+ Add Vehicle"}
            </Button>
          </div>
        )}

        {/* Payment Section */}
        <div className="flex-1 overflow-auto p-3 space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-1">
            <CreditCard className="h-4 w-4" /> Payment
          </h3>

          {paymentLines.map((pl) => (
            <div key={pl.key} className="flex gap-1 items-end">
              <div className="flex-1">
                <AsyncSelect
                  value={pl.paymentMethodId}
                  onValueChange={(v) => {
                    const method = paymentMethods.find((m) => m.id === v);
                    updatePaymentLine(pl.key, "paymentMethodId", v);
                    if (method) updatePaymentLine(pl.key, "paymentMethodName", method.name);
                  }}
                  options={paymentMethods}
                  className="text-sm h-8"
                />
              </div>
              <Input
                type="number"
                value={pl.amount}
                onChange={(e) => updatePaymentLine(pl.key, "amount", e.target.value)}
                placeholder="Amount"
                className="w-24 text-sm h-8"
              />
              <Button variant="ghost" size="sm" className="h-8 px-1" onClick={() => removePaymentLine(pl.key)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" className="w-full text-xs" onClick={addPaymentLine}>
            + Add Payment
          </Button>

          {grandTotal > 0 && (
            <div className="text-sm space-y-1 mt-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Total:</span>
                <span className="font-medium">Rs.{grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Paid:</span>
                <span className="font-medium">Rs.{totalPaid.toFixed(2)}</span>
              </div>
              {balanceDue > 0.01 && (
                <div className="flex justify-between text-red-600 font-medium">
                  <span>Balance Due:</span>
                  <span>Rs.{balanceDue.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <Switch checked={isCreditSale} onCheckedChange={setIsCreditSale} />
            <Label className="text-xs">Credit Sale</Label>
          </div>

          <Input
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-sm h-8"
          />
        </div>

        {/* Complete Sale Button */}
        <div className="p-3 border-t">
          {(() => {
            const hasItems = cartItems.length > 0;
            const hasPayment = paymentLines.some((p) => Number(p.amount) > 0 && p.paymentMethodId);
            const paymentCovers = isCreditSale || totalPaid >= grandTotal - 0.01;
            const creditNeedsCustomer = isCreditSale && !selectedCustomer && !newCustomerPhone;
            const canComplete = hasItems && (hasPayment || isCreditSale) && paymentCovers && !creditNeedsCustomer;

            let hint = "";
            if (!hasItems) hint = "Add items to cart";
            else if (!hasPayment && !isCreditSale) hint = "Add payment";
            else if (!paymentCovers) hint = `Short by Rs.${(grandTotal - totalPaid).toFixed(0)}`;
            else if (creditNeedsCustomer) hint = "Customer required for credit sale";

            return (
              <>
                {hint && <p className="text-xs text-amber-600 text-center mb-1">{hint}</p>}
                <Button
                  className="w-full h-12 text-lg"
                  disabled={submitting || !canComplete}
                  onClick={() => setConfirmSaleOpen(true)}
                >
                  {submitting ? "Processing..." : `Complete Sale — Rs.${grandTotal.toFixed(0)}`}
                </Button>
              </>
            );
          })()}
        </div>
      </div>

      {/* Confirm Sale Dialog */}
      <Dialog open={confirmSaleOpen} onOpenChange={setConfirmSaleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirm Sale</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Items:</span>
              <span>{cartItems.length} products, {cartItems.reduce((s, i) => s + Number(i.qty || 0), 0)} qty</span>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount:</span>
                <span>-Rs.{discountTotal.toFixed(0)}</span>
              </div>
            )}
            {loyaltyDiscountAmount > 0 && (
              <div className="flex justify-between text-sm text-purple-600">
                <span>Loyalty Redemption:</span>
                <span>-Rs.{loyaltyDiscountAmount.toFixed(0)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Grand Total:</span>
              <span>Rs.{grandTotal.toFixed(0)}</span>
            </div>
            <Separator />
            <div className="space-y-1.5">
              {paymentLines.filter((p) => Number(p.amount) > 0).map((p, i) => {
                const method = paymentMethods.find((m) => m.id === p.paymentMethodId);
                return (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="font-medium">{method?.name ?? "—"}</span>
                    <span>Rs.{Number(p.amount).toFixed(0)}{p.reference ? ` (${p.reference})` : ""}</span>
                  </div>
                );
              })}
              {isCreditSale && balanceDue > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Credit (unpaid):</span>
                  <span>Rs.{balanceDue.toFixed(0)}</span>
                </div>
              )}
            </div>
            {selectedCustomer && (
              <>
                <Separator />
                <div className="text-sm text-gray-500">
                  Customer: <span className="font-medium text-gray-900">{selectedCustomer.name}</span>
                  {selectedCustomer.phone && ` (${selectedCustomer.phone})`}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSaleOpen(false)}>Back</Button>
            <Button className="flex-1" disabled={submitting} onClick={() => { setConfirmSaleOpen(false); handleCompleteSale(); }}>
              {submitting ? "Processing..." : "Confirm & Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogs */}
      <QuickAddProduct
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        defaultName={productSearch}
        submitLabel="Create & Add to Cart"
        onProductCreated={(product) => {
          // Fetch full product data to add to cart
          fetch(`/api/products/search?q=${encodeURIComponent(product.sku)}&limit=1`)
            .then((r) => r.json())
            .then((j) => { if (j.data?.[0]) addToCart(j.data[0]); });
        }}
      />

      {/* New Customer Dialog */}
      <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Phone Number</Label>
              <Input value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="Enter 10-digit mobile" maxLength={10} autoFocus />
            </div>
            <div>
              <Label>Name *</Label>
              <Input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Customer name" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCustomerOpen(false)}>Cancel</Button>
            <Button onClick={createCustomer} disabled={!newCustomerName}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Vehicle Dialog */}
      <Dialog open={addVehicleOpen} onOpenChange={setAddVehicleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{newVehicleMakeId && newVehicleModelId ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Make *</Label>
              <AsyncSelect
                value={newVehicleMakeId}
                onValueChange={(v) => { setNewVehicleMakeId(v); setNewVehicleModelId(""); }}
                options={vehicleMakes}
                placeholder="Select make..."
              />
            </div>
            <div>
              <Label>Model *</Label>
              <AsyncSelect
                value={newVehicleModelId}
                onValueChange={setNewVehicleModelId}
                options={vehicleModels}
                placeholder="Select model..."
              />
            </div>
            <div>
              <Label>Year</Label>
              <Input type="number" value={newVehicleYear} onChange={(e) => setNewVehicleYear(e.target.value)} />
            </div>
            <div>
              <Label>Registration Number</Label>
              <Input value={newVehicleRegNo} onChange={(e) => setNewVehicleRegNo(e.target.value)} placeholder="e.g., KA 01 AB 1234" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddVehicleOpen(false)}>Cancel</Button>
            <Button onClick={addVehicle} disabled={!newVehicleMakeId || !newVehicleModelId}>
              {newVehicleMakeId && newVehicleModelId ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Item Dialog */}
      <Dialog open={customItemOpen} onOpenChange={setCustomItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Item</DialogTitle>
            <p className="text-sm text-gray-500">
              For parts or items not in the product catalog. No inventory deduction.
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Item Name *</Label>
              <Input
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                placeholder="e.g., Android Frame Coupler, Wiring adapter"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price (Rs.) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customItemPrice}
                  onChange={(e) => setCustomItemPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={customItemQty}
                  onChange={(e) => setCustomItemQty(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomItemOpen(false)}>Cancel</Button>
            <Button onClick={addCustomItem} disabled={!customItemName || !customItemPrice}>
              Add to Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
