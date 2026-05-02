"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Eye, Search, ClipboardList } from "lucide-react";

interface Enquiry {
  id: string;
  customerName: string;
  customerPhone: string | null;
  productDescription: string;
  desiredQty: number;
  estimatedBudget: string | null;
  advanceAmount: string;
  status: string;
  createdAt: string;
  operator: { name: string };
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive"> = {
  ENQUIRY_RECORDED: "secondary",
  CONFIRMED: "default",
  ORDER_PLACED: "default",
  IN_TRANSIT: "default",
  RECEIVED: "default",
  CUSTOMER_NOTIFIED: "default",
  DELIVERED: "default",
  CANCELLED: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  ENQUIRY_RECORDED: "Enquiry",
  CONFIRMED: "Confirmed",
  ORDER_PLACED: "Ordered",
  IN_TRANSIT: "In Transit",
  RECEIVED: "Received",
  CUSTOMER_NOTIFIED: "Notified",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search) params.set("search", search);
    const res = await fetch(`/api/enquiries?${params}`);
    const json = await res.json();
    setEnquiries(json.data ?? []);
    setTotalPages(json.pagination?.totalPages ?? 1);
    setLoading(false);
  }, [page, statusFilter, search]);

  useEffect(() => { fetchEnquiries(); }, [fetchEnquiries]);

  // Counts for summary
  const openCount = enquiries.filter((e) =>
    !["DELIVERED", "CANCELLED"].includes(e.status)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customer Enquiries</h1>
          <p className="mt-1 text-sm text-gray-500">Track customer product requests and orders</p>
        </div>
        <Link href="/enquiries/new">
          <Button size="sm"><Plus className="mr-1 h-4 w-4" /> New Enquiry</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by customer, phone, or product..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? ""); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ENQUIRY_RECORDED">Enquiry Recorded</SelectItem>
            <SelectItem value="ORDER_PLACED">Order Placed</SelectItem>
            <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
            <SelectItem value="RECEIVED">Received</SelectItem>
            <SelectItem value="CUSTOMER_NOTIFIED">Customer Notified</SelectItem>
            <SelectItem value="DELIVERED">Delivered</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Product Requested</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Advance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Recorded By</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-gray-500">Loading...</TableCell></TableRow>
            ) : enquiries.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-gray-500">
                <ClipboardList className="mx-auto h-8 w-8 mb-2 text-gray-300" />
                No enquiries found.
              </TableCell></TableRow>
            ) : enquiries.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-sm">{new Date(e.createdAt).toLocaleDateString("en-IN")}</TableCell>
                <TableCell className="font-medium">{e.customerName}</TableCell>
                <TableCell className="text-sm">{e.customerPhone ?? "—"}</TableCell>
                <TableCell className="max-w-xs truncate">{e.productDescription}</TableCell>
                <TableCell className="text-center">{e.desiredQty}</TableCell>
                <TableCell className="text-right">
                  {e.estimatedBudget ? `Rs.${Number(e.estimatedBudget).toFixed(0)}` : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {Number(e.advanceAmount) > 0 ? (
                    <span className="text-green-600 font-medium">Rs.{Number(e.advanceAmount).toFixed(0)}</span>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_COLORS[e.status] ?? "secondary"}>
                    {STATUS_LABELS[e.status] ?? e.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-500">{e.operator.name}</TableCell>
                <TableCell>
                  <Link href={`/enquiries/${e.id}`}>
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
