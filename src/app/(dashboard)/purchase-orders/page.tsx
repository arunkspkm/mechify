"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Eye, Zap, FileText } from "lucide-react";

interface PO {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: string;
  expectedDate: string | null;
  createdAt: string;
  supplier: { name: string };
  createdBy: { name: string };
  _count: { items: number };
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  SENT: "default",
  PARTIALLY_RECEIVED: "default",
  CLOSED: "default",
  CANCELLED: "destructive",
};

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    const res = await fetch(`/api/purchase-orders?${params}`);
    const json = await res.json();
    setOrders(json.data ?? []);
    setTotalPages(json.pagination?.totalPages ?? 1);
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="mt-1 text-sm text-gray-500">Manage purchase orders to suppliers</p>
        </div>
        <div className="flex gap-2">
          <Link href="/purchase-orders/new?auto=true">
            <Button variant="outline" size="sm">
              <Zap className="mr-1 h-4 w-4" /> Auto-Generate from Low Stock
            </Button>
          </Link>
          <Link href="/purchase-orders/new">
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> New PO</Button>
          </Link>
        </div>
      </div>

      <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? ""); setPage(1); }}>
        <SelectTrigger className="w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="DRAFT">Draft</SelectItem>
          <SelectItem value="SENT">Sent</SelectItem>
          <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
          <SelectItem value="CLOSED">Closed</SelectItem>
          <SelectItem value="CANCELLED">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-gray-500">Loading...</TableCell></TableRow>
            ) : orders.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-gray-500">
                <FileText className="mx-auto h-8 w-8 mb-2 text-gray-300" />No purchase orders.</TableCell></TableRow>
            ) : orders.map((po) => (
              <TableRow key={po.id}>
                <TableCell className="font-medium">{po.poNumber}</TableCell>
                <TableCell className="text-sm">{new Date(po.createdAt).toLocaleDateString("en-IN")}</TableCell>
                <TableCell>{po.supplier.name}</TableCell>
                <TableCell className="text-center">{po._count.items}</TableCell>
                <TableCell className="text-right">Rs.{Number(po.totalAmount).toFixed(0)}</TableCell>
                <TableCell className="text-sm">
                  {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString("en-IN") : "—"}
                </TableCell>
                <TableCell><Badge variant={STATUS_COLORS[po.status] ?? "secondary"}>{po.status}</Badge></TableCell>
                <TableCell className="text-sm text-gray-500">{po.createdBy.name}</TableCell>
                <TableCell>
                  <Link href={`/purchase-orders/${po.id}`}>
                    <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
