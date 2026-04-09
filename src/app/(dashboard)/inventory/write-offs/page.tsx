"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AsyncSelect } from "@/components/shared/async-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Check, X } from "lucide-react";

interface WriteOff {
  id: string;
  qty: string;
  valueLost: string;
  notes: string | null;
  status: string;
  createdAt: string;
  batch: {
    batchNumber: string | null;
    product: { name: string; sku: string };
  };
  reason: { name: string };
  submittedBy: { name: string };
  approvedBy: { name: string } | null;
}

interface Batch {
  id: string;
  batchNumber: string | null;
  qtyRemaining: string;
  landedCostPerUnit: string;
  purchaseDate: string;
}

interface MasterDataOption {
  id: string;
  name: string;
}

export default function WriteOffsPage() {
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "OWNER";

  const [writeOffs, setWriteOffs] = useState<WriteOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  // Form state
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [qty, setQty] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [notes, setNotes] = useState("");
  const [reasons, setReasons] = useState<MasterDataOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchWriteOffs = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/inventory/write-offs");
    const json = await res.json();
    setWriteOffs(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWriteOffs();
    fetch("/api/master-data?type=STOCK_ADJUSTMENT_REASON")
      .then((r) => r.json())
      .then((j) => setReasons(j.data ?? []));
  }, [fetchWriteOffs]);

  // Search products for the form
  useEffect(() => {
    if (productSearch.length < 2) return;
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(productSearch)}`);
      const json = await res.json();
      setProducts(json.data ?? []);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // Load batches when product is selected
  useEffect(() => {
    if (!selectedProductId) {
      setBatches([]);
      return;
    }
    fetch(`/api/products/${selectedProductId}`)
      .then((r) => r.json())
      .then((json) => {
        setBatches(json.data?.batches ?? []);
      });
  }, [selectedProductId]);

  async function handleSubmitWriteOff(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const res = await fetch("/api/inventory/write-offs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: selectedProductId,
        batchId,
        qty: Number(qty),
        reasonId,
        notes,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to submit write-off");
      return;
    }

    toast.success("Write-off submitted for approval");
    setFormOpen(false);
    resetForm();
    fetchWriteOffs();
  }

  async function handleApproval(id: string, action: "APPROVED" | "REJECTED") {
    const res = await fetch("/api/inventory/write-offs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to process");
      return;
    }

    toast.success(action === "APPROVED" ? "Write-off approved — stock deducted" : "Write-off rejected");
    fetchWriteOffs();
  }

  function resetForm() {
    setProductSearch("");
    setProducts([]);
    setSelectedProductId("");
    setBatches([]);
    setBatchId("");
    setQty("");
    setReasonId("");
    setNotes("");
  }

  const selectedBatch = batches.find((b) => b.id === batchId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Write-offs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Record damaged, expired, or lost stock
          </p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setFormOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" />
          New Write-off
        </Button>
      </div>

      {/* Write-offs Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Value Lost</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Submitted By</TableHead>
              <TableHead>Status</TableHead>
              {isOwner && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">Loading...</TableCell>
              </TableRow>
            ) : writeOffs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  No write-offs recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              writeOffs.map((wo) => (
                <TableRow key={wo.id}>
                  <TableCell className="text-sm">
                    {new Date(wo.createdAt).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell className="font-medium">{wo.batch.product.name}</TableCell>
                  <TableCell className="text-gray-500">{wo.batch.batchNumber ?? "—"}</TableCell>
                  <TableCell className="text-right">{Number(wo.qty)}</TableCell>
                  <TableCell className="text-right text-red-600">
                    Rs.{Number(wo.valueLost).toFixed(2)}
                  </TableCell>
                  <TableCell>{wo.reason.name}</TableCell>
                  <TableCell className="text-gray-500">{wo.submittedBy.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        wo.status === "APPROVED" ? "default" :
                        wo.status === "REJECTED" ? "destructive" : "secondary"
                      }
                    >
                      {wo.status}
                    </Badge>
                  </TableCell>
                  {isOwner && (
                    <TableCell>
                      {wo.status === "PENDING" && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-600"
                            onClick={() => handleApproval(wo.id, "APPROVED")}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => handleApproval(wo.id, "REJECTED")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* New Write-off Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Write-off</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitWriteOff} className="space-y-4">
            <div className="space-y-2">
              <Label>Search Product</Label>
              <Input
                placeholder="Type product name..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                autoFocus
              />
            </div>

            {products.length > 0 && (
              <div className="space-y-2">
                <Label>Product *</Label>
                <AsyncSelect
                  value={selectedProductId}
                  onValueChange={setSelectedProductId}
                  options={products.map((p) => ({ id: p.id, name: `${p.name} (${p.sku})` }))}
                  placeholder="Select product..."
                />
              </div>
            )}

            {batches.length > 0 && (
              <div className="space-y-2">
                <Label>Batch *</Label>
                <AsyncSelect
                  value={batchId}
                  onValueChange={setBatchId}
                  options={batches.map((b) => ({
                    id: b.id,
                    name: `${b.batchNumber || "No batch #"} — Qty: ${Number(b.qtyRemaining)} — Cost: Rs.${Number(b.landedCostPerUnit).toFixed(2)}`,
                  }))}
                  placeholder="Select batch..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Quantity to write off *</Label>
              <Input
                type="number"
                min="0.01"
                step="any"
                max={selectedBatch ? Number(selectedBatch.qtyRemaining) : undefined}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
              {selectedBatch && (
                <p className="text-xs text-gray-500">
                  Available: {Number(selectedBatch.qtyRemaining)} |
                  Value: Rs.{(Number(qty || 0) * Number(selectedBatch.landedCostPerUnit)).toFixed(2)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Reason *</Label>
              <AsyncSelect
                value={reasonId}
                onValueChange={setReasonId}
                options={reasons}
                placeholder="Select reason..."
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional details..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting || !batchId || !reasonId || !qty}>
                {submitting ? "Submitting..." : "Submit for Approval"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
