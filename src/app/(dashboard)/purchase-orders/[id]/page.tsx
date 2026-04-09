"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Send, Package, X, Check } from "lucide-react";

interface PODetail {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: string;
  expectedDate: string | null;
  notes: string | null;
  createdAt: string;
  supplier: { id: string; name: string; phone: string | null };
  createdBy: { name: string };
  items: {
    id: string;
    orderedQty: string;
    receivedQty: string;
    agreedPrice: string;
    notes: string | null;
    product: { name: string; sku: string; bundleSize: string; sellingPrice: string };
  }[];
}

export default function PODetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [po, setPO] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Receive dialog
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveItems, setReceiveItems] = useState<{ itemId: string; receivedQty: string }[]>([]);
  const [handlingCharge, setHandlingCharge] = useState("0");
  const [supplierBillNumber, setSupplierBillNumber] = useState("");

  async function fetchPO() {
    setLoading(true);
    const res = await fetch(`/api/purchase-orders/${id}`);
    const json = await res.json();
    setPO(json.data);
    setLoading(false);
  }

  useEffect(() => { fetchPO(); }, [id]);

  async function handleAction(action: string) {
    setActionLoading(true);
    const res = await fetch(`/api/purchase-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActionLoading(false);
    if (!res.ok) { const err = await res.json(); toast.error(err.error); return; }
    const json = await res.json();
    toast.success(json.message);
    fetchPO();
  }

  function openReceiveDialog() {
    if (!po) return;
    setReceiveItems(
      po.items
        .filter((i) => Number(i.receivedQty) < Number(i.orderedQty))
        .map((i) => ({
          itemId: i.id,
          receivedQty: String(Number(i.orderedQty) - Number(i.receivedQty)),
        }))
    );
    setHandlingCharge("0");
    setSupplierBillNumber("");
    setReceiveOpen(true);
  }

  async function handleReceive() {
    setActionLoading(true);
    const res = await fetch(`/api/purchase-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "receive",
        items: receiveItems.map((i) => ({
          itemId: i.itemId,
          receivedQty: Number(i.receivedQty) || 0,
        })),
        handlingCharge: Number(handlingCharge) || 0,
        supplierBillNumber: supplierBillNumber || null,
      }),
    });
    setActionLoading(false);

    if (!res.ok) { const err = await res.json(); toast.error(err.error); return; }
    const json = await res.json();
    toast.success(json.message);
    setReceiveOpen(false);
    fetchPO();
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!po) return <p className="text-red-600">PO not found</p>;

  const isOpen = po.status === "SENT" || po.status === "PARTIALLY_RECEIVED";
  const isDraft = po.status === "DRAFT";
  const isClosed = po.status === "CLOSED" || po.status === "CANCELLED";

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/purchase-orders" className="text-sm text-blue-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="h-3 w-3" /> Back to Purchase Orders
          </Link>
          <h1 className="text-2xl font-bold">{po.poNumber}</h1>
          <p className="text-sm text-gray-500">
            {po.supplier.name} | {new Date(po.createdAt).toLocaleDateString("en-IN")}
            {po.expectedDate && ` | Expected: ${new Date(po.expectedDate).toLocaleDateString("en-IN")}`}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant={po.status === "CLOSED" ? "default" : po.status === "CANCELLED" ? "destructive" : "secondary"}>
            {po.status}
          </Badge>
          {isDraft && (
            <Button size="sm" onClick={() => handleAction("send")} disabled={actionLoading}>
              <Send className="mr-1 h-4 w-4" /> Mark as Sent
            </Button>
          )}
          {isOpen && (
            <Button size="sm" onClick={openReceiveDialog} disabled={actionLoading}>
              <Package className="mr-1 h-4 w-4" /> Receive Items
            </Button>
          )}
          {!isClosed && (
            <Button size="sm" variant="destructive" onClick={() => handleAction("cancel")} disabled={actionLoading}>
              <X className="mr-1 h-4 w-4" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items ({po.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items.map((item) => {
                const ordered = Number(item.orderedQty);
                const received = Number(item.receivedQty);
                const pending = ordered - received;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{item.product.name}</p>
                      <p className="text-xs text-gray-500">{item.product.sku}</p>
                    </TableCell>
                    <TableCell className="text-right">{ordered}</TableCell>
                    <TableCell className="text-right text-green-600">{received}</TableCell>
                    <TableCell className="text-right">
                      {pending > 0 ? <span className="text-amber-600">{pending}</span> : <Check className="h-4 w-4 text-green-600 ml-auto" />}
                    </TableCell>
                    <TableCell className="text-right">Rs.{Number(item.agreedPrice).toFixed(2)}</TableCell>
                    <TableCell className="text-right">Rs.{(ordered * Number(item.agreedPrice)).toFixed(0)}</TableCell>
                    <TableCell>
                      <Badge variant={received >= ordered ? "default" : received > 0 ? "secondary" : "destructive"} className="text-xs">
                        {received >= ordered ? "Complete" : received > 0 ? "Partial" : "Pending"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="mt-3 text-right text-sm font-bold">
            Total: Rs.{Number(po.totalAmount).toFixed(0)}
          </div>
        </CardContent>
      </Card>

      {po.notes && (
        <p className="text-sm text-gray-500">Notes: {po.notes}</p>
      )}

      {/* Receive Dialog */}
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Receive Items against {po.poNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 max-h-48 overflow-auto">
              {receiveItems.map((ri, idx) => {
                const poItem = po.items.find((i) => i.id === ri.itemId);
                if (!poItem) return null;
                const pending = Number(poItem.orderedQty) - Number(poItem.receivedQty);
                return (
                  <div key={ri.itemId} className="flex items-center gap-3 text-sm">
                    <span className="flex-1">{poItem.product.name}</span>
                    <span className="text-gray-500">of {pending}</span>
                    <Input
                      type="number"
                      min="0"
                      max={pending}
                      value={ri.receivedQty}
                      onChange={(e) => {
                        const updated = [...receiveItems];
                        updated[idx] = { ...updated[idx], receivedQty: e.target.value };
                        setReceiveItems(updated);
                      }}
                      className="w-20 h-8 text-sm"
                    />
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Handling Charge (Rs.)</Label>
                <Input type="number" min="0" value={handlingCharge} onChange={(e) => setHandlingCharge(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Supplier Bill #</Label>
                <Input value={supplierBillNumber} onChange={(e) => setSupplierBillNumber(e.target.value)} className="h-8 text-sm" placeholder="Optional" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button onClick={handleReceive} disabled={actionLoading}>
              {actionLoading ? "Receiving..." : "Receive & Update Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
