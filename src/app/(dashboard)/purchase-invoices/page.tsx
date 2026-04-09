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
import { Plus, Eye, FileText } from "lucide-react";

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string | null;
  totalItemsAmount: string;
  handlingCharge: string;
  grandTotal: string;
  amountPaid: string;
  outstandingAmount: string;
  status: string;
  invoiceDate: string;
  supplier: { name: string };
  _count: { items: number };
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  FINALIZED: "default",
  PARTIALLY_PAID: "default",
  PAID: "default",
  CANCELLED: "destructive",
};

export default function PurchaseInvoicesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    const res = await fetch(`/api/purchase-invoices?${params}`);
    const json = await res.json();
    setInvoices(json.data ?? []);
    setTotalPages(json.pagination?.totalPages ?? 1);
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Invoices</h1>
          <p className="mt-1 text-sm text-gray-500">Track supplier invoices and payments</p>
        </div>
        <Link href="/inventory/stock-inward">
          <Button size="sm"><Plus className="mr-1 h-4 w-4" /> New Purchase</Button>
        </Link>
      </div>

      <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? ""); setPage(1); }}>
        <SelectTrigger className="w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="DRAFT">Draft</SelectItem>
          <SelectItem value="FINALIZED">Finalized</SelectItem>
          <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
          <SelectItem value="PAID">Paid</SelectItem>
        </SelectContent>
      </Select>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-gray-500">Loading...</TableCell></TableRow>
            ) : invoices.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-gray-500">
                <FileText className="mx-auto h-8 w-8 mb-2 text-gray-300" />No purchase invoices found.</TableCell></TableRow>
            ) : invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.invoiceNumber ?? `PI-${inv.id.slice(-6)}`}</TableCell>
                <TableCell className="text-sm">{new Date(inv.invoiceDate).toLocaleDateString("en-IN")}</TableCell>
                <TableCell>{inv.supplier.name}</TableCell>
                <TableCell className="text-center">{inv._count.items}</TableCell>
                <TableCell className="text-right">Rs.{Number(inv.grandTotal).toFixed(0)}</TableCell>
                <TableCell className="text-right">Rs.{Number(inv.amountPaid).toFixed(0)}</TableCell>
                <TableCell className="text-right">
                  {Number(inv.outstandingAmount) > 0 ? (
                    <span className="text-red-600 font-medium">Rs.{Number(inv.outstandingAmount).toFixed(0)}</span>
                  ) : <span className="text-green-600">Paid</span>}
                </TableCell>
                <TableCell><Badge variant={STATUS_COLORS[inv.status] ?? "secondary"}>{inv.status}</Badge></TableCell>
                <TableCell>
                  <Link href={`/purchase-invoices/${inv.id}`}>
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
