"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AsyncSelect } from "@/components/shared/async-select";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, X, Check } from "lucide-react";

interface EnquiryDetail {
  id: string;
  customerName: string;
  customerPhone: string | null;
  productDescription: string;
  desiredQty: number;
  estimatedBudget: string | null;
  advanceAmount: string;
  advanceMethodId: string | null;
  advanceReference: string | null;
  notes: string | null;
  status: string;
  purchaseOrderId: string | null;
  invoiceId: string | null;
  cancelledReason: string | null;
  notifiedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  operator: { name: string };
  customer: { name: string; phone: string | null } | null;
  notesLog?: { id: string; message: string; createdAt: string; user: { id: string; name: string } }[];
}

const STATUS_LABELS: Record<string, string> = {
  ENQUIRY_RECORDED: "Enquiry Recorded",
  CONFIRMED: "Customer Confirmed",
  ORDER_PLACED: "Order Placed",
  IN_TRANSIT: "In Transit",
  RECEIVED: "Stock Received",
  CUSTOMER_NOTIFIED: "Customer Notified",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const STATUS_FLOW = [
  "ENQUIRY_RECORDED",
  "CONFIRMED",
  "ORDER_PLACED",
  "IN_TRANSIT",
  "RECEIVED",
  "CUSTOMER_NOTIFIED",
  "DELIVERED",
];

const NEXT_STATUS: Record<string, string> = {
  ENQUIRY_RECORDED: "CONFIRMED",
  CONFIRMED: "ORDER_PLACED",
  ORDER_PLACED: "IN_TRANSIT",
  IN_TRANSIT: "RECEIVED",
  RECEIVED: "CUSTOMER_NOTIFIED",
  CUSTOMER_NOTIFIED: "DELIVERED",
};

const NEXT_LABELS: Record<string, string> = {
  ENQUIRY_RECORDED: "Customer Confirmed",
  CONFIRMED: "Mark as Ordered",
  ORDER_PLACED: "Mark as In Transit",
  IN_TRANSIT: "Mark as Received",
  RECEIVED: "Mark Customer Notified",
  CUSTOMER_NOTIFIED: "Mark as Delivered",
};

export default function EnquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [enquiry, setEnquiry] = useState<EnquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAdvance, setConfirmAdvance] = useState("");
  const [confirmMethodId, setConfirmMethodId] = useState("");
  const [confirmReference, setConfirmReference] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string }[]>([]);

  // Communication log note input
  const [noteInput, setNoteInput] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  async function fetchEnquiry() {
    setLoading(true);
    const res = await fetch(`/api/enquiries/${id}`);
    const json = await res.json();
    setEnquiry(json.data);
    setLoading(false);
  }

  useEffect(() => { fetchEnquiry(); }, [id]);

  useEffect(() => {
    fetch("/api/master-data?type=PAYMENT_METHOD")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => setPaymentMethods(json.data ?? []))
      .catch(() => {});
  }, []);

  async function handleNextStatus() {
    if (!enquiry) return;
    const next = NEXT_STATUS[enquiry.status];
    if (!next) return;

    // Open confirm dialog when moving to CONFIRMED
    if (next === "CONFIRMED") {
      setConfirmAdvance("");
      setConfirmMethodId("");
      setConfirmReference("");
      setConfirmOpen(true);
      return;
    }

    setUpdating(true);
    const res = await fetch(`/api/enquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setUpdating(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to update");
      return;
    }

    toast.success(`Status updated to ${STATUS_LABELS[next]}`);
    fetchEnquiry();
  }

  async function handleConfirm() {
    setUpdating(true);
    const res = await fetch(`/api/enquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "CONFIRMED",
        advanceAmount: Number(confirmAdvance) || 0,
        advanceMethodId: confirmMethodId || null,
        advanceReference: confirmReference || null,
      }),
    });
    setUpdating(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to confirm");
      return;
    }

    toast.success("Enquiry confirmed");
    setConfirmOpen(false);
    fetchEnquiry();
  }

  async function handleCancel() {
    setUpdating(true);
    const res = await fetch(`/api/enquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED", cancelledReason: cancelReason || null }),
    });
    setUpdating(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to cancel");
      return;
    }

    toast.success("Enquiry cancelled");
    setCancelOpen(false);
    fetchEnquiry();
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!enquiry) return <p className="text-red-600">Enquiry not found</p>;

  const currentStep = STATUS_FLOW.indexOf(enquiry.status);
  const isClosed = enquiry.status === "DELIVERED" || enquiry.status === "CANCELLED";
  const nextLabel = NEXT_LABELS[enquiry.status];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/enquiries" className="text-sm text-blue-600 flex items-center gap-1 mb-1">
          <ArrowLeft className="h-3 w-3" /> Back to Enquiries
        </Link>
        <h1 className="text-2xl font-bold">Enquiry — {enquiry.productDescription.slice(0, 60)}</h1>
        <p className="text-sm text-gray-500">
          From {enquiry.customerName} {enquiry.customerPhone ? `(${enquiry.customerPhone})` : ""} •
          {new Date(enquiry.createdAt).toLocaleDateString("en-IN")}
        </p>
      </div>

      {/* Status Progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-1">
            {STATUS_FLOW.map((status, idx) => {
              const isCompleted = idx < currentStep;
              const isCurrent = idx === currentStep;
              return (
                <div key={status} className="flex items-center gap-1 flex-1">
                  <div className={`flex-1 h-2 rounded-full ${
                    isCompleted ? "bg-green-500" :
                    isCurrent ? "bg-blue-500" :
                    "bg-gray-200"
                  }`} />
                  {idx < STATUS_FLOW.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-gray-300 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            {STATUS_FLOW.map((status, idx) => {
              const isCurrent = idx === currentStep;
              return (
                <span key={status} className={`text-xs ${isCurrent ? "font-bold text-blue-700" : "text-gray-400"}`}>
                  {STATUS_LABELS[status]?.split(" ").slice(-1)[0]}
                </span>
              );
            })}
          </div>
          {enquiry.status === "CANCELLED" && (
            <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
              Cancelled{enquiry.cancelledReason ? `: ${enquiry.cancelledReason}` : ""}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader><CardTitle>Enquiry Details</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-500">Customer</p>
              <p className="font-medium">{enquiry.customerName}</p>
            </div>
            <div>
              <p className="text-gray-500">Phone</p>
              <p>{enquiry.customerPhone ?? "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500">Product Requested</p>
              <p className="font-medium">{enquiry.productDescription}</p>
            </div>
            <div>
              <p className="text-gray-500">Quantity</p>
              <p>{enquiry.desiredQty}</p>
            </div>
            <div>
              <p className="text-gray-500">Estimated Budget</p>
              <p>{enquiry.estimatedBudget ? `Rs.${Number(enquiry.estimatedBudget).toFixed(0)}` : "—"}</p>
            </div>
          </div>
          {Number(enquiry.advanceAmount) > 0 && (
            <>
              <Separator />
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-gray-500 text-xs mb-1">Advance Payment Received</p>
                <p className="font-bold text-green-700 text-lg">Rs.{Number(enquiry.advanceAmount).toFixed(0)}</p>
                {enquiry.advanceReference && (
                  <p className="text-xs text-gray-500">Ref: {enquiry.advanceReference}</p>
                )}
              </div>
            </>
          )}
          {enquiry.notes && (
            <>
              <Separator />
              <div>
                <p className="text-gray-500">Notes</p>
                <p>{enquiry.notes}</p>
              </div>
            </>
          )}
          {(enquiry.purchaseOrderId || enquiry.invoiceId) && (
            <>
              <Separator />
              <div className="flex gap-4">
                {enquiry.purchaseOrderId && (
                  <Link href={`/purchase-orders/${enquiry.purchaseOrderId}`} className="text-sm text-blue-600 hover:underline">
                    View Purchase Order
                  </Link>
                )}
                {enquiry.invoiceId && (
                  <Link href={`/billing/invoices/${enquiry.invoiceId}`} className="text-sm text-blue-600 hover:underline">
                    View Invoice
                  </Link>
                )}
              </div>
            </>
          )}
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
            <div>Recorded by: {enquiry.operator.name}</div>
            <div>Last updated: {new Date(enquiry.updatedAt).toLocaleString("en-IN")}</div>
            {enquiry.notifiedAt && <div>Customer notified: {new Date(enquiry.notifiedAt).toLocaleString("en-IN")}</div>}
            {enquiry.deliveredAt && <div>Delivered: {new Date(enquiry.deliveredAt).toLocaleString("en-IN")}</div>}
          </div>
        </CardContent>
      </Card>

      {/* Communication Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Communication Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)}
              placeholder="e.g., Called customer, asked to call back at 6 PM..."
              rows={2} className="text-sm" />
            <Button size="sm" disabled={addingNote || !noteInput.trim()} onClick={async () => {
              setAddingNote(true);
              const res = await fetch(`/api/enquiries/${id}/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: noteInput.trim() }),
              });
              setAddingNote(false);
              if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed"); return; }
              toast.success("Note added");
              setNoteInput("");
              fetchEnquiry();
            }}>
              {addingNote ? "Adding..." : "Add Note"}
            </Button>
          </div>
          {enquiry.notesLog && enquiry.notesLog.length > 0 ? (
            <div className="space-y-2">
              {enquiry.notesLog.map((n) => (
                <div key={n.id} className="border rounded p-2 bg-gray-50">
                  <p className="text-sm whitespace-pre-wrap">{n.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {n.user.name} · {new Date(n.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No notes yet. Add one after contacting the customer.</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {!isClosed && (
        <div className="flex gap-3">
          {nextLabel && (
            <Button onClick={handleNextStatus} disabled={updating}>
              <Check className="mr-1 h-4 w-4" />
              {updating ? "Updating..." : nextLabel}
            </Button>
          )}
          <Button variant="destructive" onClick={() => setCancelOpen(true)} disabled={updating}>
            <X className="mr-1 h-4 w-4" /> Cancel Enquiry
          </Button>
        </div>
      )}

      {/* Confirm Dialog — collect advance */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Enquiry — Collect Advance</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Customer has confirmed. Record the advance payment (if any).</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Advance Amount (Rs.)</Label>
                <Input type="number" min="0" value={confirmAdvance} onChange={(e) => setConfirmAdvance(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <AsyncSelect value={confirmMethodId} onValueChange={setConfirmMethodId} options={paymentMethods} placeholder="Select method" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={confirmReference} onChange={(e) => setConfirmReference(e.target.value)} placeholder="Receipt no., UTR, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={updating}>
              {updating ? "Confirming..." : "Confirm Enquiry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel Enquiry</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {enquiry && Number(enquiry.advanceAmount) > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-700">Advance Refund Required</p>
                <p className="text-sm text-red-600">Rs.{Number(enquiry.advanceAmount).toFixed(0)} advance was collected and needs to be refunded to the customer.</p>
              </div>
            )}
            <Label>Reason for cancellation</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g., Customer no longer interested, product unavailable..."
              rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Back</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={updating}>
              {updating ? "Cancelling..." : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
