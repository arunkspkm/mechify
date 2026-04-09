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
import { ArrowLeft, CreditCard, IndianRupee } from "lucide-react";

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
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string }[]>([]);
  const [paying, setPaying] = useState(false);

  async function fetchCustomer() {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${id}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setCustomer(json.data);
    } catch { /* failed */ }
    setLoading(false);
  }

  useEffect(() => { fetchCustomer(); }, [id]);
  useEffect(() => {
    fetch("/api/master-data?type=PAYMENT_METHOD").then((r) => r.json()).then((j) => setPaymentMethods(j.data ?? []));
  }, []);

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
      {/* Header */}
      <div>
        <Link href="/customers" className="text-sm text-blue-600 flex items-center gap-1 mb-1">
          <ArrowLeft className="h-3 w-3" /> Back to Customers
        </Link>
        <h1 className="text-2xl font-bold">{customer.name}</h1>
        <p className="text-sm text-gray-500">
          {customer.phone ?? "No phone"} {customer.email ? `• ${customer.email}` : ""}
        </p>
      </div>

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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Vehicles */}
      {customer.vehicles.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Vehicles</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {customer.vehicles.map((v) => (
                <div key={v.id} className="flex items-center gap-3 p-2 border rounded">
                  <span className="font-medium">{v.vehicleMake.name} {v.vehicleModel.name}</span>
                  {v.year && <span className="text-sm text-gray-500">({v.year})</span>}
                  {v.registrationNumber && <Badge variant="secondary">{v.registrationNumber}</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
