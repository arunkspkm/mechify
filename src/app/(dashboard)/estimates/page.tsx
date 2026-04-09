"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Eye, FileText } from "lucide-react";

interface Estimate {
  id: string;
  estimateNumber: string;
  date: string;
  validUntil: string;
  grandTotal: string;
  status: string;
  isExpired: boolean;
  customer: { name: string; phone: string | null } | null;
  customerName: string | null;
  customerPhone: string | null;
  vehicle: {
    vehicleMake: { name: string };
    vehicleModel: { name: string };
  } | null;
  operator: { name: string };
  _count: { items: number };
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  SENT: "default",
  CONVERTED: "default",
  EXPIRED: "destructive",
  CANCELLED: "destructive",
};

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchEstimates = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter !== "all") params.set("status", statusFilter);

    const res = await fetch(`/api/estimates?${params}`);
    const json = await res.json();
    setEstimates(json.data ?? []);
    setTotalPages(json.pagination?.totalPages ?? 1);
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => {
    fetchEstimates();
  }, [fetchEstimates]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
          <p className="mt-1 text-sm text-gray-500">Quotations and proforma invoices</p>
        </div>
        <Link href="/estimates/new">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> New Estimate
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? ""); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="CONVERTED">Converted</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estimate #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">Loading...</TableCell>
              </TableRow>
            ) : estimates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  <FileText className="mx-auto h-8 w-8 mb-2 text-gray-300" />
                  No estimates found.
                </TableCell>
              </TableRow>
            ) : (
              estimates.map((est) => (
                <TableRow key={est.id}>
                  <TableCell className="font-medium">{est.estimateNumber}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(est.date).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell>
                    {est.customer?.name ?? est.customerName ?? <span className="text-gray-400">—</span>}
                    {!est.customer && est.customerPhone && (
                      <span className="text-xs text-gray-400 ml-1">({est.customerPhone})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {est.vehicle
                      ? `${est.vehicle.vehicleMake.name} ${est.vehicle.vehicleModel.name}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center">{est._count.items}</TableCell>
                  <TableCell className="text-right font-medium">
                    Rs.{Number(est.grandTotal).toFixed(0)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(est.validUntil).toLocaleDateString("en-IN")}
                    {est.isExpired && (
                      <span className="ml-1 text-red-500 text-xs">(Expired)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[est.status] ?? "secondary"}>
                      {est.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/estimates/${est.id}`}>
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
