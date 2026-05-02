"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AsyncSelect } from "@/components/shared/async-select";
import { toast } from "sonner";
import { ArrowLeft, Save, Star, Plus } from "lucide-react";

interface SupplierDetail {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstNumber: string | null;
  qualityRating: number | null;
  paymentTerms: string | null;
  creditPeriodDays: number | null;
  outstandingBalance: string;
  openingBalance: string;
  active: boolean;
  purchaseInvoices: {
    id: string;
    invoiceNumber: string | null;
    grandTotal: string;
    outstandingAmount: string;
    status: string;
    invoiceDate: string;
  }[];
  supplierReturns: {
    id: string;
    returnNumber: string;
    totalAmount: string;
    creditReceived: string;
    status: string;
    createdAt: string;
  }[];
  advances: {
    id: string;
    amount: string;
    adjustedAmount: string;
    isAdvance: boolean;
    reference: string | null;
    notes: string | null;
    date: string;
    paymentMethod: { name: string };
  }[];
  advanceSummary: {
    totalAdvance: number;
    totalAdjusted: number;
    pendingAdvance: number;
  };
  _count: { batches: number; purchaseInvoices: number; purchaseOrders: number; supplierReturns: number };
}

export default function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit fields
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [qualityRating, setQualityRating] = useState(3);
  const [paymentTerms, setPaymentTerms] = useState("");
  const [creditPeriodDays, setCreditPeriodDays] = useState("");

  const [openingBalance, setOpeningBalance] = useState("");

  // Bulk payment dialog
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethodId, setPayMethodId] = useState("");
  const [payReference, setPayReference] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [paying, setPaying] = useState(false);

  // Advance dialog
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advAmount, setAdvAmount] = useState("");
  const [advMethodId, setAdvMethodId] = useState("");
  const [advReference, setAdvReference] = useState("");
  const [advNotes, setAdvNotes] = useState("");
  const [advAdding, setAdvAdding] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/master-data?type=PAYMENT_METHOD").then((r) => r.ok ? r.json() : { data: [] }).then((j) => setPaymentMethods(j.data ?? [])).catch(() => {});
  }, []);

  function fetchSupplier() {
    fetch(`/api/suppliers/${id}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((json) => {
        const s = json.data;
        if (s) {
          setSupplier(s);
          setName(s.name);
          setContactPerson(s.contactPerson ?? "");
          setPhone(s.phone ?? "");
          setEmail(s.email ?? "");
          setAddress(s.address ?? "");
          setGstNumber(s.gstNumber ?? "");
          setQualityRating(s.qualityRating ?? 3);
          setPaymentTerms(s.paymentTerms ?? "");
          setCreditPeriodDays(s.creditPeriodDays ? String(s.creditPeriodDays) : "");
          setOpeningBalance(String(Number(s.openingBalance) || 0));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { fetchSupplier(); }, [id]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/suppliers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        gstNumber: gstNumber || null,
        qualityRating,
        paymentTerms: paymentTerms || null,
        creditPeriodDays: creditPeriodDays ? Number(creditPeriodDays) : null,
        openingBalance: Number(openingBalance) || 0,
      }),
    });
    setSaving(false);
    if (!res.ok) { const err = await res.json(); toast.error(err.error); return; }
    toast.success("Supplier updated");
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!supplier) return <p className="text-red-600">Supplier not found</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/suppliers" className="text-sm text-blue-600 flex items-center gap-1 mb-1">
          <ArrowLeft className="h-3 w-3" /> Back to Suppliers
        </Link>
        <h1 className="text-2xl font-bold">{supplier.name}</h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold">{supplier._count.purchaseInvoices}</p>
          <p className="text-xs text-gray-500">Purchase Invoices</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold">{supplier._count.batches}</p>
          <p className="text-xs text-gray-500">Batches Supplied</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          <p className={`text-2xl font-bold ${Number(supplier.outstandingBalance) > 0 ? "text-red-600" : "text-green-600"}`}>
            Rs.{Number(supplier.outstandingBalance).toFixed(0)}
          </p>
          <p className="text-xs text-gray-500">Outstanding</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{supplier._count.supplierReturns}</p>
          <p className="text-xs text-gray-500">Returns</p>
        </CardContent></Card>
      </div>

      {/* Edit Details */}
      <Card>
        <CardHeader><CardTitle>Supplier Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Contact Person</Label>
            <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>GST Number</Label>
            <Input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Quality Rating</Label>
            <div className="flex gap-1 pt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setQualityRating(star)}>
                  <Star className={`h-5 w-5 cursor-pointer ${star <= qualityRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Payment Terms</Label>
            <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g., Net 30, COD, 50% advance" />
          </div>
          <div className="space-y-2">
            <Label>Credit Period (days)</Label>
            <Input type="number" value={creditPeriodDays} onChange={(e) => setCreditPeriodDays(e.target.value)} placeholder="e.g., 30" />
          </div>
          <div className="space-y-2">
            <Label>Opening Balance (Rs.)</Label>
            <Input type="number" min="0" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="Legacy amount owed from before Mechify" />
            <p className="text-xs text-gray-500">Pre-existing amount owed from before using Mechify</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
        </Button>
        {Number(supplier.outstandingBalance) > 0 && (
          <Button onClick={() => { setPayAmount(String(Number(supplier.outstandingBalance).toFixed(0))); setPayMethodId(""); setPayReference(""); setPayNotes(""); setPayOpen(true); }}>
            Make Payment
          </Button>
        )}
        <Button variant="outline" onClick={() => setAdvanceOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Pay Advance
        </Button>
      </div>

      {/* Advance Payments */}
      {supplier.advanceSummary && supplier.advanceSummary.totalAdvance > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Advance Payments</span>
              <Badge variant={supplier.advanceSummary.pendingAdvance > 0 ? "default" : "secondary"}>
                Pending: Rs.{supplier.advanceSummary.pendingAdvance.toFixed(0)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4 text-sm">
              <div>Total Advance: <strong>Rs.{supplier.advanceSummary.totalAdvance.toFixed(0)}</strong></div>
              <div>Adjusted: <strong className="text-green-600">Rs.{supplier.advanceSummary.totalAdjusted.toFixed(0)}</strong></div>
              <div>Pending: <strong className="text-amber-600">Rs.{supplier.advanceSummary.pendingAdvance.toFixed(0)}</strong></div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Adjusted</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.advances.map((adv) => (
                  <TableRow key={adv.id}>
                    <TableCell className="text-sm">{new Date(adv.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                    <TableCell className="text-right font-medium">Rs.{Number(adv.amount).toFixed(0)}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {Number(adv.adjustedAmount) > 0 ? `Rs.${Number(adv.adjustedAmount).toFixed(0)}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{adv.paymentMethod.name}</TableCell>
                    <TableCell className="text-sm text-gray-500">{adv.reference ?? "—"}</TableCell>
                    <TableCell className="text-sm text-gray-500">{adv.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Purchase Invoices */}
      {supplier.purchaseInvoices.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent Purchase Invoices</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.purchaseInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link href={`/purchase-invoices/${inv.id}`} className="text-blue-600 hover:underline">
                        {inv.invoiceNumber ?? `PI-${inv.id.slice(-6)}`}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(inv.invoiceDate).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell className="text-right">Rs.{Number(inv.grandTotal).toFixed(0)}</TableCell>
                    <TableCell className="text-right">
                      {Number(inv.outstandingAmount) > 0 ? (
                        <span className="text-red-600">Rs.{Number(inv.outstandingAmount).toFixed(0)}</span>
                      ) : "Paid"}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{inv.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Returns */}
      {supplier.supplierReturns.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Returns</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Credit Received</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.supplierReturns.map((ret) => (
                  <TableRow key={ret.id}>
                    <TableCell className="font-medium">{ret.returnNumber}</TableCell>
                    <TableCell className="text-sm">{new Date(ret.createdAt).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell className="text-right">Rs.{Number(ret.totalAmount).toFixed(0)}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {Number(ret.creditReceived) > 0 ? `Rs.${Number(ret.creditReceived).toFixed(0)}` : "—"}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{ret.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Bulk Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Make Payment — {supplier.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Total outstanding: <span className="font-bold text-red-600">Rs.{Number(supplier.outstandingBalance).toFixed(0)}</span>
              {Number(supplier.openingBalance) > 0 && <span className="text-xs text-gray-500 ml-1">(incl. Rs.{Number(supplier.openingBalance).toFixed(0)} opening balance)</span>}
            </p>
            <p className="text-xs text-gray-500">Payment will be auto-distributed: opening balance first, then oldest invoices.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount (Rs.) *</Label>
                <Input type="number" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Payment Method *</Label>
                <AsyncSelect value={payMethodId} onValueChange={setPayMethodId} options={paymentMethods} placeholder="Select method" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="UTR, cheque no." />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
              </div>
            </div>
            {Number(payAmount) > Number(supplier.outstandingBalance) && Number(payAmount) > 0 && (
              <p className="text-xs text-amber-600">Rs.{(Number(payAmount) - Number(supplier.outstandingBalance)).toFixed(0)} excess will be recorded as supplier advance</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!payAmount || Number(payAmount) <= 0) { toast.error("Enter amount"); return; }
              if (!payMethodId) { toast.error("Select payment method"); return; }
              setPaying(true);
              const res = await fetch(`/api/suppliers/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: Number(payAmount), paymentMethodId: payMethodId, reference: payReference || null, notes: payNotes || null }),
              });
              setPaying(false);
              if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed"); return; }
              const json = await res.json();
              const dist = json.data.distributions;
              const summary = dist.map((d: { type: string; invoiceNumber?: string; amount: number }) =>
                d.type === "opening_balance" ? `Opening: Rs.${d.amount.toFixed(0)}` :
                d.type === "invoice" ? `${d.invoiceNumber}: Rs.${d.amount.toFixed(0)}` :
                `Advance: Rs.${d.amount.toFixed(0)}`
              ).join(", ");
              toast.success(`Payment distributed: ${summary}`);
              setPayOpen(false);
              fetchSupplier();
            }} disabled={paying || !payAmount || !payMethodId}>
              {paying ? "Processing..." : `Pay Rs.${Number(payAmount || 0).toFixed(0)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Advance Dialog */}
      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pay Advance — {supplier.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (Rs.) *</Label>
              <Input type="number" min="0" value={advAmount} onChange={(e) => setAdvAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <AsyncSelect value={advMethodId} onValueChange={setAdvMethodId}
                options={paymentMethods} placeholder="Select method..." />
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={advReference} onChange={(e) => setAdvReference(e.target.value)} placeholder="UTR, cheque #, etc." />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={advNotes} onChange={(e) => setAdvNotes(e.target.value)} placeholder="e.g., Advance for next order" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
            <Button disabled={advAdding || !advAmount || !advMethodId} onClick={async () => {
              setAdvAdding(true);
              const res = await fetch(`/api/suppliers/${id}/advance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  amount: Number(advAmount),
                  paymentMethodId: advMethodId,
                  reference: advReference || null,
                  notes: advNotes || null,
                }),
              });
              setAdvAdding(false);
              if (!res.ok) {
                const err = await res.json().catch(() => ({ error: "Failed" }));
                toast.error(err.error); return;
              }
              toast.success("Advance payment recorded");
              setAdvanceOpen(false);
              setAdvAmount(""); setAdvReference(""); setAdvNotes("");
              fetchSupplier();
            }}>
              {advAdding ? "Recording..." : "Record Advance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
