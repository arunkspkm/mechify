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
  cancelledReason: string | null;
  notifiedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  operator: { name: string };
  customer: { name: string; phone: string | null } | null;
}

const STATUS_LABELS: Record<string, string> = {
  ENQUIRY_RECORDED: "Enquiry Recorded",
  ORDER_PLACED: "Order Placed",
  IN_TRANSIT: "In Transit",
  RECEIVED: "Stock Received",
  CUSTOMER_NOTIFIED: "Customer Notified",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const STATUS_FLOW = [
  "ENQUIRY_RECORDED",
  "ORDER_PLACED",
  "IN_TRANSIT",
  "RECEIVED",
  "CUSTOMER_NOTIFIED",
  "DELIVERED",
];

const NEXT_STATUS: Record<string, string> = {
  ENQUIRY_RECORDED: "ORDER_PLACED",
  ORDER_PLACED: "IN_TRANSIT",
  IN_TRANSIT: "RECEIVED",
  RECEIVED: "CUSTOMER_NOTIFIED",
  CUSTOMER_NOTIFIED: "DELIVERED",
};

const NEXT_LABELS: Record<string, string> = {
  ENQUIRY_RECORDED: "Mark as Ordered",
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

  async function fetchEnquiry() {
    setLoading(true);
    const res = await fetch(`/api/enquiries/${id}`);
    const json = await res.json();
    setEnquiry(json.data);
    setLoading(false);
  }

  useEffect(() => { fetchEnquiry(); }, [id]);

  async function handleNextStatus() {
    if (!enquiry) return;
    const next = NEXT_STATUS[enquiry.status];
    if (!next) return;

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
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
            <div>Recorded by: {enquiry.operator.name}</div>
            <div>Last updated: {new Date(enquiry.updatedAt).toLocaleString("en-IN")}</div>
            {enquiry.notifiedAt && <div>Customer notified: {new Date(enquiry.notifiedAt).toLocaleString("en-IN")}</div>}
            {enquiry.deliveredAt && <div>Delivered: {new Date(enquiry.deliveredAt).toLocaleString("en-IN")}</div>}
          </div>
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

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel Enquiry</DialogTitle></DialogHeader>
          <div className="space-y-3">
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
