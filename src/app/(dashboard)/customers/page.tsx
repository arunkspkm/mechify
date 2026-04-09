"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Eye, Users, IndianRupee } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  outstandingBalance: string;
  loyaltyPoints: number;
  vehicles: {
    vehicleMake: { name: string };
    vehicleModel: { name: string };
    registrationNumber: string | null;
  }[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [outstandingOnly, setOutstandingOnly] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (search) params.set("q", search);
    fetch(`/api/customers?${params}`)
      .then((r) => r.json())
      .then((json) => { setCustomers(json.data ?? []); setLoading(false); });
  }, [search]);

  const filteredCustomers = outstandingOnly
    ? customers.filter((c) => Number(c.outstandingBalance) > 0)
    : customers;

  const totalOutstanding = customers.reduce((s, c) => s + Number(c.outstandingBalance), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">Customer profiles, vehicles, and credit</p>
        </div>
      </div>

      {/* Summary */}
      {totalOutstanding > 0 && (
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IndianRupee className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-bold text-red-600 text-lg">Rs.{totalOutstanding.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-gray-500">Total outstanding from {customers.filter((c) => Number(c.outstandingBalance) > 0).length} customers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={outstandingOnly} onCheckedChange={setOutstandingOnly} />
          Outstanding only
        </label>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Vehicles</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-500">Loading...</TableCell></TableRow>
            ) : customers.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-500">
                <Users className="mx-auto h-8 w-8 mb-2 text-gray-300" />
                No customers found.
              </TableCell></TableRow>
            ) : filteredCustomers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell className="text-sm text-gray-500">
                  {c.vehicles.length > 0
                    ? c.vehicles.map((v) => `${v.vehicleMake.name} ${v.vehicleModel.name}`).join(", ")
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {Number(c.outstandingBalance) > 0 ? (
                    <Badge variant="destructive">Rs.{Number(c.outstandingBalance).toFixed(0)}</Badge>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/customers/${c.id}`}>
                    <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
