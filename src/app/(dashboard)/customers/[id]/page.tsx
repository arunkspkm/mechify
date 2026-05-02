"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
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
import { ArrowLeft, CreditCard, IndianRupee, Pencil, Plus, Car, Save, Trash2 } from "lucide-react";

interface CreditInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  grandTotal: string;
  amountPaid: string;
  outstandingAmount: string;
}

interface Payment {
  id: string;
  amount: string;
  reference: string | null;
  notes: string | null;
  date: string;
  paymentMethod: { name: string };
  invoice: { invoiceNumber: string } | null;
}

interface CustomerDetail {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  outstandingBalance: string;
  openingBalance: string;
  creditLimit: string;
  vehicles: {
    id: string;
    vehicleMake: { name: string };
    vehicleModel: { name: string };
    year: number | null;
    registrationNumber: string | null;
  }[];
  invoices: CreditInvoice[];
  payments: Payment[];
  loyaltyPoints: number;
  loyaltyTransactions: {
    id: string;
    type: string;
    points: number;
    balance: number;
    description: string | null;
    createdAt: string;
  }[];
  creditStats: {
    totalCreditSales: number;
    totalCollected: number;
    totalOutstanding: number;
    invoiceCount: number;
  };
  _count: { invoices: number };
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment dialog
  const [payOpen, setPayOpen] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethodId, setPayMethodId] = useState("");
  const [payReference, setPayReference] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // Bulk collect dialog (opening balance + oldest invoices)
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAmount, setBulkAmount] = useState("");
  const [bulkMethodId, setBulkMethodId] = useState("");
  const [bulkReference, setBulkReference] = useState("");
  const [bulkCollecting, setBulkCollecting] = useState(false);

  // Opening balance edit
  const [editingOpening, setEditingOpening] = useState(false);
  const [openingInput, setOpeningInput] = useState("");

  // Add vehicle dialog
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [vehicleMakeId, setVehicleMakeId] = useState("");
  const [vehicleModelId, setVehicleModelId] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleRegNo, setVehicleRegNo] = useState("");
  const [vehicleMakes, setVehicleMakes] = useState<{ id: string; name: string }[]>([]);
  const [vehicleModels, setVehicleModels] = useState<{ id: string; name: string }[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string }[]>([]);
  const [paying, setPaying] = useState(false);

  // Customer edit fields
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCreditLimit, setEditCreditLimit] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchCustomer() {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${id}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const c = json.data;
      setCustomer(c);
      if (c) {
        setEditName(c.name ?? "");
        setEditPhone(c.phone ?? "");
        setEditEmail(c.email ?? "");
        setEditCreditLimit(String(Number(c.creditLimit) || 0));
      }
    } catch { /* failed */ }
    setLoading(false);
  }

  useEffect(() => { fetchCustomer(); }, [id]);
  useEffect(() => {
    fetch("/api/master-data?type=PAYMENT_METHOD").then((r) => r.json()).then((j) => setPaymentMethods(j.data ?? []));
    fetch("/api/master-data?type=VEHICLE_MAKE").then((r) => r.json()).then((j) => setVehicleMakes(j.data ?? []));
  }, []);
  useEffect(() => {
    if (!vehicleMakeId) { setVehicleModels([]); return; }
    fetch(`/api/master-data?type=VEHICLE_MODEL&parentId=${vehicleMakeId}`).then((r) => r.json()).then((j) => setVehicleModels(j.data ?? []));
  }, [vehicleMakeId]);

  function openPaymentDialog(invoice: CreditInvoice) {
    setPayInvoiceId(invoice.id);
    setPayAmount(String(Number(invoice.outstandingAmount).toFixed(2)));
    setPayReference("");
    setPayNotes("");
    setPayOpen(true);
  }

  async function handleCollectPayment() {
    setPaying(true);
    const res = await fetch(`/api/customers/${id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: payInvoiceId,
        amount: Number(payAmount),
        paymentMethodId: payMethodId,
        reference: payReference || null,
        notes: payNotes || null,
      }),
    });

    setPaying(false);
    const text = await res.text();
    let result;
    try { result = JSON.parse(text); } catch { toast.error("Server error"); return; }
    if (!res.ok) { toast.error(result.error || "Failed"); return; }

    toast.success(`Rs.${Number(payAmount).toFixed(0)} collected against ${result.data.invoiceNumber}`);
    setPayOpen(false);
    fetchCustomer();
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!customer) return <p className="text-red-600">Customer not found</p>;

  const stats = customer.creditStats;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header + Edit */}
      <div>
        <Link href="/customers" className="text-sm text-blue-600 flex items-center gap-1 mb-1">
          <ArrowLeft className="h-3 w-3" /> Back to Customers
        </Link>
        <h1 className="text-2xl font-bold">{customer.name}</h1>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="e.g., 9876543210" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Credit Limit (Rs.)</Label>
              <Input type="number" min="0" value={editCreditLimit} onChange={(e) => setEditCreditLimit(e.target.value)} />
            </div>
          </div>
          <Button size="sm" className="mt-3" disabled={saving || !editName} onClick={async () => {
            setSaving(true);
            const res = await fetch(`/api/customers/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: editName, phone: editPhone || null, email: editEmail || null, creditLimit: Number(editCreditLimit) || 0 }),
            });
            setSaving(false);
            if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed"); return; }
            toast.success("Customer updated");
            fetchCustomer();
          }}>
            <Save className="mr-1 h-4 w-4" /> {saving ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>

      {/* Credit Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold">Rs.{stats.totalCreditSales.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Total Credit Sales</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold text-green-600">Rs.{stats.totalCollected.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Collected</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          <p className={`text-2xl font-bold ${stats.totalOutstanding > 0 ? "text-red-600" : "text-green-600"}`}>
            Rs.{stats.totalOutstanding.toFixed(0)}
          </p>
          <p className="text-xs text-gray-500">Outstanding</p>
          {stats.totalOutstanding > 0 && (
            <Button size="sm" className="mt-2 h-7" onClick={() => {
              setBulkAmount(String(stats.totalOutstanding.toFixed(0)));
              setBulkMethodId(""); setBulkReference("");
              setBulkOpen(true);
            }}>
              Collect
            </Button>
          )}
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold">{customer._count.invoices}</p>
          <p className="text-xs text-gray-500">Total Invoices</p>
        </CardContent></Card>
        {customer.loyaltyPoints > 0 && (
          <Card><CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{customer.loyaltyPoints}</p>
            <p className="text-xs text-gray-500">Loyalty Points</p>
          </CardContent></Card>
        )}
      </div>

      {/* Opening Balance */}
      {(Number(customer.openingBalance) > 0 || editingOpening) && (
        <Card>
          <CardContent className="py-3 flex items-center justify-between">
            {editingOpening ? (
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Opening Balance (Rs.):</Label>
                <Input type="number" min="0" value={openingInput} onChange={(e) => setOpeningInput(e.target.value)}
                  className="w-32 h-8" autoFocus onKeyDown={(e) => { if (e.key === "Escape") setEditingOpening(false); }} />
                <Button size="sm" className="h-8" onClick={async () => {
                  const res = await fetch(`/api/customers/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ openingBalance: Number(openingInput) || 0 }),
                  });
                  if (!res.ok) { toast.error("Failed to update"); return; }
                  toast.success("Opening balance updated");
                  setEditingOpening(false);
                  fetchCustomer();
                }}>Save</Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingOpening(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-500">Opening Balance (pre-Mechify): <span className="font-medium text-red-600">Rs.{Number(customer.openingBalance).toFixed(0)}</span></p>
                <button type="button" className="text-gray-400 hover:text-gray-600" onClick={() => { setOpeningInput(String(Number(customer.openingBalance))); setEditingOpening(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {Number(customer.openingBalance) === 0 && !editingOpening && (
        <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => { setOpeningInput("0"); setEditingOpening(true); }}>
          + Add opening balance (pre-Mechify debt)
        </button>
      )}

      {/* Outstanding Invoices */}
      {customer.invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-red-500" />
              Outstanding Invoices ({customer.invoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link href={`/billing/invoices/${inv.id}`} className="text-blue-600 hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(inv.date).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell className="text-right">Rs.{Number(inv.grandTotal).toFixed(0)}</TableCell>
                    <TableCell className="text-right text-green-600">Rs.{Number(inv.amountPaid).toFixed(0)}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">Rs.{Number(inv.outstandingAmount).toFixed(0)}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => openPaymentDialog(inv)}>
                        <CreditCard className="mr-1 h-4 w-4" /> Collect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      {customer.payments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{new Date(p.date).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell className="text-sm">{p.invoice?.invoiceNumber ?? "—"}</TableCell>
                    <TableCell>{p.paymentMethod.name}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">Rs.{Number(p.amount).toFixed(0)}</TableCell>
                    <TableCell className="text-sm text-gray-500">{p.reference ?? "—"}</TableCell>
                    <TableCell className="text-sm text-gray-500">{p.notes ?? "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Reverse payment"
                        onClick={async () => {
                          if (!confirm(`Reverse this Rs.${Number(p.amount).toFixed(0)} payment? The outstanding balance will be restored.`)) return;
                          const res = await fetch(`/api/customers/${id}/payments/${p.id}`, { method: "DELETE" });
                          if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed"); return; }
                          toast.success("Payment reversed");
                          fetchCustomer();
                        }}>
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Vehicles */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Vehicles</CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setVehicleMakeId(""); setVehicleModelId(""); setVehicleYear(""); setVehicleRegNo(""); setVehicleOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Add Vehicle
          </Button>
        </CardHeader>
        {customer.vehicles.length > 0 && (
          <CardContent>
            <div className="space-y-2">
              {customer.vehicles.map((v) => (
                <div key={v.id} className="flex items-center gap-3 p-2 border rounded">
                  <Car className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">{v.vehicleMake.name} {v.vehicleModel.name}</span>
                  {v.year && <span className="text-sm text-gray-500">({v.year})</span>}
                  {v.registrationNumber && <Badge variant="secondary">{v.registrationNumber}</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Add Vehicle Dialog */}
      <Dialog open={vehicleOpen} onOpenChange={setVehicleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Vehicle — {customer.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Make *</Label>
              <AsyncSelect value={vehicleMakeId} onValueChange={(v) => { setVehicleMakeId(v); setVehicleModelId(""); }} options={vehicleMakes} placeholder="Select make" />
            </div>
            <div className="space-y-2">
              <Label>Model *</Label>
              <AsyncSelect value={vehicleModelId} onValueChange={setVehicleModelId} options={vehicleModels} placeholder="Select model" />
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input type="number" min="1990" max="2030" value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} placeholder="e.g., 2022" />
            </div>
            <div className="space-y-2">
              <Label>Registration No.</Label>
              <Input value={vehicleRegNo} onChange={(e) => setVehicleRegNo(e.target.value)} placeholder="e.g., TN 01 AB 1234" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVehicleOpen(false)}>Cancel</Button>
            <Button disabled={!vehicleMakeId || !vehicleModelId} onClick={async () => {
              const res = await fetch("/api/customers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  customerId: id,
                  vehicleMakeId,
                  vehicleModelId,
                  year: vehicleYear ? Number(vehicleYear) : null,
                  registrationNumber: vehicleRegNo || null,
                }),
              });
              if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed"); return; }
              toast.success("Vehicle added");
              setVehicleOpen(false);
              fetchCustomer();
            }}>Add Vehicle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Collect Outstanding Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Collect Outstanding — {customer.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Total outstanding: <span className="font-bold text-red-600">Rs.{stats.totalOutstanding.toFixed(0)}</span>
              {Number(customer.openingBalance) > 0 && <span className="text-xs text-gray-500 ml-1">(incl. Rs.{Number(customer.openingBalance).toFixed(0)} opening balance)</span>}
            </p>
            <p className="text-xs text-gray-500">Payment auto-distributed: opening balance first, then oldest invoices.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount (Rs.) *</Label>
                <Input type="number" min="0" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Payment Method *</Label>
                <AsyncSelect value={bulkMethodId} onValueChange={setBulkMethodId} options={paymentMethods} placeholder="Select method" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={bulkReference} onChange={(e) => setBulkReference(e.target.value)} placeholder="UTR, cheque no." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button disabled={bulkCollecting || !bulkAmount || !bulkMethodId} onClick={async () => {
              setBulkCollecting(true);
              const res = await fetch(`/api/customers/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: Number(bulkAmount), paymentMethodId: bulkMethodId, reference: bulkReference || null }),
              });
              setBulkCollecting(false);
              if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed"); return; }
              const json = await res.json();
              const dist = json.data.distributions as { type: string; invoiceNumber?: string; amount: number }[];
              const summary = dist.map((d) =>
                d.type === "opening_balance" ? `Opening: Rs.${d.amount.toFixed(0)}` :
                `${d.invoiceNumber}: Rs.${d.amount.toFixed(0)}`
              ).join(", ");
              if (json.data.warning) toast.warning(json.data.warning);
              toast.success(`Collected: ${summary || "No distribution"}`);
              setBulkOpen(false);
              fetchCustomer();
            }}>{bulkCollecting ? "Processing..." : `Collect Rs.${Number(bulkAmount || 0).toFixed(0)}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collect Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Collect Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount (Rs.) *</Label>
              <Input type="number" min="0.01" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div>
              <Label>Payment Method *</Label>
              <AsyncSelect value={payMethodId} onValueChange={setPayMethodId} options={paymentMethods} placeholder="Select method..." />
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="UTR, cheque #, etc." />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={handleCollectPayment} disabled={paying || !payAmount || !payMethodId}>
              {paying ? "Collecting..." : `Collect Rs.${Number(payAmount || 0).toFixed(0)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loyalty Points History */}
      {customer.loyaltyTransactions && customer.loyaltyTransactions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Loyalty Points History</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.loyaltyTransactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="text-sm">
                      {new Date(txn.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={txn.type === "EARNED" ? "default" : txn.type === "REDEEMED" ? "secondary" : "destructive"}>
                        {txn.type}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${txn.points > 0 ? "text-green-600" : "text-red-600"}`}>
                      {txn.points > 0 ? "+" : ""}{txn.points}
                    </TableCell>
                    <TableCell className="text-right">{txn.balance}</TableCell>
                    <TableCell className="text-sm text-gray-500">{txn.description ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
