"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AsyncSelect } from "@/components/shared/async-select";
import { toast } from "sonner";

export default function NewEnquiryPage() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [productDescription, setProductDescription] = useState("");
  const [desiredQty, setDesiredQty] = useState("1");
  const [estimatedBudget, setEstimatedBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceMethodId, setAdvanceMethodId] = useState("");
  const [advanceReference, setAdvanceReference] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/master-data?type=PAYMENT_METHOD").then((r) => r.json()).then((j) => setPaymentMethods(j.data ?? []));
  }, []);

  function clearSelectedCustomer() {
    setCustomerId(null);
    setCustomerName("");
    setCustomerPhone("");
  }

  const [phoneChecking, setPhoneChecking] = useState(false);

  // Auto-check phone and link to existing customer
  async function checkPhone(phone: string) {
    if (phone.length !== 10 || customerId) return;
    setPhoneChecking(true);
    const res = await fetch(`/api/customers?q=${phone}&limit=1`);
    const json = await res.json();
    const match = (json.data ?? []).find((c: { phone: string | null }) => c.phone === phone);
    if (match) {
      setCustomerId(match.id);
      setCustomerName(match.name);
      setCustomerPhone(match.phone);
    }
    setPhoneChecking(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const res = await fetch("/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName,
        customerPhone: customerPhone || null,
        customerId: customerId || null,
        productDescription,
        desiredQty: Number(desiredQty),
        estimatedBudget: estimatedBudget ? Number(estimatedBudget) : null,
        advanceAmount: advanceAmount ? Number(advanceAmount) : 0,
        advanceMethodId: advanceMethodId || null,
        advanceReference: advanceReference || null,
        notes: notes || null,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to create enquiry");
      return;
    }

    toast.success("Enquiry recorded");
    router.push("/enquiries");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Customer Enquiry</h1>
        <p className="mt-1 text-sm text-gray-500">
          Record when a customer asks about a product not in stock
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Customer Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {customerId ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <p className="font-medium text-blue-900">{customerName}</p>
                  <p className="text-sm text-blue-700">{customerPhone || "No phone"}</p>
                  <p className="text-xs text-blue-500">Linked to existing customer</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={clearSelectedCustomer}>✕</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value);
                      if (e.target.value.length === 10) checkPhone(e.target.value);
                    }}
                    onBlur={() => { if (customerPhone.length === 10) checkPhone(customerPhone); }}
                    placeholder="Enter 10-digit mobile" maxLength={10} autoFocus />
                  {phoneChecking && <p className="text-xs text-gray-400">Checking...</p>}
                </div>
                <div className="space-y-2">
                  <Label>Customer Name *</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required
                    placeholder="Customer name" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Product Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>What product is the customer looking for? *</Label>
              <Textarea value={productDescription} onChange={(e) => setProductDescription(e.target.value)}
                placeholder="e.g., Pioneer 9-inch Android Player for Hyundai Creta 2024, black bezel variant"
                rows={3} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min="1" value={desiredQty} onChange={(e) => setDesiredQty(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Estimated Budget (Rs.)</Label>
                <Input type="number" min="0" value={estimatedBudget} onChange={(e) => setEstimatedBudget(e.target.value)}
                  placeholder="Customer's budget range" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes — urgency, preferred brand, vehicle details, etc."
                rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Advance Payment (Optional)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Advance Amount (Rs.)</Label>
              <Input type="number" min="0" step="0.01" value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <AsyncSelect value={advanceMethodId} onValueChange={setAdvanceMethodId}
                options={paymentMethods} placeholder="Select..." />
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={advanceReference} onChange={(e) => setAdvanceReference(e.target.value)}
                placeholder="UTR, receipt #" />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting || !customerName || !productDescription}>
            {submitting ? "Recording..." : "Record Enquiry"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/enquiries")}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
