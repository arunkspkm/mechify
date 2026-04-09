"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Printer } from "lucide-react";

interface ShiftDetail {
  id: string;
  date: string;
  status: string;
  startTime: string;
  endTime: string | null;
  openingBalance: string;
  closingBalance: string | null;
  varianceReason: string | null;
  operator: { name: string };
  invoices: {
    id: string;
    invoiceNumber: string;
    date: string;
    grandTotal: string;
    customer: { name: string } | null;
    payments: { amount: string; paymentMethod: { name: string } }[];
    _count: { items: number };
  }[];
  approvedReturns?: {
    id: string;
    returnNumber: string;
    totalRefund: string;
    invoice: { invoiceNumber: string } | null;
    customer: { name: string } | null;
  }[];
  summary: {
    totalSales: number;
    totalRefunds: number;
    returnCount: number;
    invoiceCount: number;
    totalItems: number;
    paymentTotals: Record<string, number>;
    openingBalance: number;
    expectedCash: number;
    actualCash: number | null;
    variance: number | null;
  };
}

export default function ShiftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [shift, setShift] = useState<ShiftDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Close shift state
  const [actualCash, setActualCash] = useState("");
  const [varianceReason, setVarianceReason] = useState("");
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    fetch(`/api/shifts/${id}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((json) => { setShift(json.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleCloseShift() {
    if (!actualCash) { toast.error("Enter actual cash in drawer"); return; }
    setClosing(true);

    const res = await fetch("/api/shifts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shiftId: id,
        actualCash: Number(actualCash),
        varianceReason,
      }),
    });

    setClosing(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to close shift");
      return;
    }

    toast.success("Shift closed successfully");
    // Reload
    const reload = await fetch(`/api/shifts/${id}`);
    const json = await reload.json();
    setShift(json.data);
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!shift) return <p className="text-red-600">Shift not found</p>;

  const isOpen = shift.status === "OPEN";
  const s = shift.summary;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <Link href="/shifts" className="text-sm text-blue-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="h-3 w-3" /> Back to Shifts
          </Link>
          <h1 className="text-2xl font-bold">
            Shift — {shift.operator.name}
          </h1>
          <p className="text-sm text-gray-500">
            {new Date(shift.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            {" • "}
            {new Date(shift.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            {shift.endTime ? ` — ${new Date(shift.endTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : " (ongoing)"}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={isOpen ? "default" : "secondary"}>{shift.status}</Badge>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div id="invoice-print">
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">Rs.{s.totalSales.toFixed(0)}</p>
              <p className="text-xs text-gray-500">Total Sales</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{s.invoiceCount}</p>
              <p className="text-xs text-gray-500">Invoices</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">Rs.{s.expectedCash.toFixed(0)}</p>
              <p className="text-xs text-gray-500">Expected Cash</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              {s.variance !== null ? (
                <>
                  <p className={`text-2xl font-bold ${s.variance < 0 ? "text-red-600" : s.variance > 0 ? "text-green-600" : ""}`}>
                    Rs.{s.variance.toFixed(0)}
                  </p>
                  <p className="text-xs text-gray-500">Variance</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-gray-300">—</p>
                  <p className="text-xs text-gray-500">Variance (pending)</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment Breakdown */}
        <Card className="mt-4">
          <CardHeader><CardTitle>Payment Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Opening Balance:</span>
                <span>Rs.{s.openingBalance.toFixed(0)}</span>
              </div>
              <Separator />
              {Object.entries(s.paymentTotals).map(([method, amount]) => (
                <div key={method} className="flex justify-between">
                  <span className="text-gray-500">{method}:</span>
                  <span>Rs.{amount.toFixed(0)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total Collections:</span>
                <span>Rs.{s.totalSales.toFixed(0)}</span>
              </div>
              {s.totalRefunds > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Return Refunds ({s.returnCount}):</span>
                  <span>− Rs.{s.totalRefunds.toFixed(0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>Expected Cash in Drawer:</span>
                <span>Rs.{s.expectedCash.toFixed(0)}</span>
              </div>
              {s.actualCash !== null && (
                <>
                  <div className="flex justify-between">
                    <span>Actual Cash in Drawer:</span>
                    <span>Rs.{s.actualCash.toFixed(0)}</span>
                  </div>
                  <div className={`flex justify-between font-bold ${(s.variance ?? 0) < 0 ? "text-red-600" : (s.variance ?? 0) > 0 ? "text-green-600" : ""}`}>
                    <span>Variance:</span>
                    <span>Rs.{(s.variance ?? 0).toFixed(0)}</span>
                  </div>
                  {shift.varianceReason && (
                    <p className="text-gray-500 italic">Reason: {shift.varianceReason}</p>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Invoices List */}
        <Card className="mt-4">
          <CardHeader><CardTitle>Invoices ({shift.invoices.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shift.invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-gray-500">
                      No invoices in this shift yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  shift.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link href={`/billing/invoices/${inv.id}`} className="text-blue-600 hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(inv.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell>{inv.customer?.name ?? "Walk-in"}</TableCell>
                      <TableCell className="text-center">{inv._count.items}</TableCell>
                      <TableCell className="text-right font-medium">Rs.{Number(inv.grandTotal).toFixed(0)}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {inv.payments.map((p) => `${p.paymentMethod.name}: Rs.${Number(p.amount).toFixed(0)}`).join(", ")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {/* Returns processed during shift */}
        {shift.approvedReturns && shift.approvedReturns.length > 0 && (
          <Card className="mt-4">
            <CardHeader><CardTitle>Returns Processed ({shift.approvedReturns.length})</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Return #</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Refund</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shift.approvedReturns.map((ret) => (
                    <TableRow key={ret.id}>
                      <TableCell className="font-medium">{ret.returnNumber}</TableCell>
                      <TableCell>{ret.invoice?.invoiceNumber ?? "—"}</TableCell>
                      <TableCell>{ret.customer?.name ?? "Walk-in"}</TableCell>
                      <TableCell className="text-right text-red-600">− Rs.{Number(ret.totalRefund).toFixed(0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Close Shift Form */}
      {isOpen && (
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Close Shift</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-sm space-y-2">
              <Label>Actual Cash in Drawer (Rs.) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                placeholder="Count and enter the actual cash"
              />
              {actualCash && (
                <p className={`text-sm font-medium ${Number(actualCash) - s.expectedCash < 0 ? "text-red-600" : Number(actualCash) - s.expectedCash > 0 ? "text-green-600" : "text-gray-600"}`}>
                  Variance: Rs.{(Number(actualCash) - s.expectedCash).toFixed(0)}
                  {Number(actualCash) - s.expectedCash < 0 ? " (short)" : Number(actualCash) - s.expectedCash > 0 ? " (excess)" : " (exact)"}
                </p>
              )}
            </div>
            {actualCash && Math.abs(Number(actualCash) - s.expectedCash) > 0.01 && (
              <div className="max-w-sm space-y-2">
                <Label>Reason for Variance *</Label>
                <Textarea
                  value={varianceReason}
                  onChange={(e) => setVarianceReason(e.target.value)}
                  placeholder="e.g., rounding, petty cash withdrawal, change given..."
                  rows={2}
                  required
                />
                {!varianceReason.trim() && (
                  <p className="text-xs text-red-500">Reason is required when there is a cash variance</p>
                )}
              </div>
            )}
            <Button
              onClick={handleCloseShift}
              disabled={closing || !actualCash || (Math.abs(Number(actualCash) - s.expectedCash) > 0.01 && !varianceReason.trim())}
              variant="destructive"
            >
              {closing ? "Closing..." : "Close Shift"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
