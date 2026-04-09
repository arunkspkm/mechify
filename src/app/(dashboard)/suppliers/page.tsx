"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Eye, Search, Star, IndianRupee } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  qualityRating: number | null;
  outstandingBalance: string;
  active: boolean;
  _count: { batches: number; purchaseInvoices: number };
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contactPerson: "", phone: "", email: "", address: "", gstNumber: "", paymentTerms: "", creditPeriodDays: "" });
  const [creating, setCreating] = useState(false);

  async function fetchSuppliers() {
    setLoading(true);
    const params = new URLSearchParams({ full: "true", limit: "50" });
    if (search) params.set("q", search);
    const res = await fetch(`/api/suppliers?${params}`);
    const json = await res.json();
    setSuppliers(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchSuppliers(); }, [search]);

  const totalOutstanding = suppliers.reduce((s, sup) => s + Number(sup.outstandingBalance), 0);
  const suppliersWithOutstanding = suppliers.filter((s) => Number(s.outstandingBalance) > 0).length;

  async function handleCreate() {
    setCreating(true);
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        creditPeriodDays: form.creditPeriodDays ? Number(form.creditPeriodDays) : null,
      }),
    });
    setCreating(false);
    if (!res.ok) { const err = await res.json(); toast.error(err.error); return; }
    toast.success("Supplier created");
    setCreateOpen(false);
    setForm({ name: "", contactPerson: "", phone: "", email: "", address: "", gstNumber: "", paymentTerms: "", creditPeriodDays: "" });
    fetchSuppliers();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your product suppliers</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> New Supplier
        </Button>
      </div>

      {/* Outstanding Summary */}
      {totalOutstanding > 0 && (
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <IndianRupee className="h-5 w-5 text-red-500" />
            <div>
              <p className="font-bold text-red-600 text-lg">Rs.{totalOutstanding.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-gray-500">Total payable to {suppliersWithOutstanding} supplier{suppliersWithOutstanding !== 1 ? "s" : ""}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead className="text-center">Invoices</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">Loading...</TableCell></TableRow>
            ) : suppliers.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">No suppliers found.</TableCell></TableRow>
            ) : suppliers.map((s) => (
              <TableRow key={s.id} className={!s.active ? "opacity-50" : ""}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-sm text-gray-500">{s.contactPerson ?? "—"}</TableCell>
                <TableCell className="text-sm">{s.phone ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`h-3 w-3 ${star <= (s.qualityRating ?? 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-center">{s._count.purchaseInvoices}</TableCell>
                <TableCell className="text-right">
                  {Number(s.outstandingBalance) > 0 ? (
                    <span className="text-red-600 font-medium">Rs.{Number(s.outstandingBalance).toFixed(0)}</span>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={s.active ? "default" : "secondary"}>{s.active ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>
                  <Link href={`/suppliers/${s.id}`}>
                    <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Supplier</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
            <div><Label>Contact Person</Label><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>GST Number</Label><Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} /></div>
            <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Payment Terms</Label><Input value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} placeholder="e.g., Net 30" /></div>
            <div><Label>Credit Period (days)</Label><Input type="number" value={form.creditPeriodDays} onChange={(e) => setForm({ ...form, creditPeriodDays: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !form.name}>{creating ? "Creating..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
