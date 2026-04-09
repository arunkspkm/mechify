"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShoppingCart, Eye } from "lucide-react";

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  grandTotal: string;
  status: string;
  isCreditSale: boolean;
  outstandingAmount: string;
  customer: { name: string; phone: string | null } | null;
  vehicle: {
    vehicleMake: { name: string };
    vehicleModel: { name: string };
    registrationNumber: string | null;
  } | null;
  operator: { name: string };
  _count: { items: number };
}

export default function InvoiceListPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    const res = await fetch(`/api/billing/invoices?${params}`);
    const json = await res.json();
    setInvoices(json.data ?? []);
    setTotalPages(json.pagination?.totalPages ?? 1);
    setLoading(false);
  }, [page, dateFrom, dateTo]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="mt-1 text-sm text-gray-500">All sales invoices</p>
        </div>
        <Link href="/billing">
          <Button size="sm">
            <ShoppingCart className="mr-1 h-4 w-4" /> New Sale
          </Button>
        </Link>
      </div>

      {/* Date Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">From:</label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-40 h-8" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">To:</label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-40 h-8" />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear</Button>
        )}
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Billed By</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">Loading...</TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  No invoices found.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(inv.date).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell>
                    {inv.customer?.name ?? <span className="text-gray-400">Walk-in</span>}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {inv.vehicle
                      ? `${inv.vehicle.vehicleMake.name} ${inv.vehicle.vehicleModel.name}${inv.vehicle.registrationNumber ? ` (${inv.vehicle.registrationNumber})` : ""}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center">{inv._count.items}</TableCell>
                  <TableCell className="text-right font-medium">
                    Rs.{Number(inv.grandTotal).toFixed(0)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Badge variant="secondary" className="text-xs">{inv.status}</Badge>
                      {inv.isCreditSale && (
                        <Badge variant="destructive" className="text-xs">Credit</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{inv.operator.name}</TableCell>
                  <TableCell>
                    <Link href={`/billing/invoices/${inv.id}`}>
                      <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
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
