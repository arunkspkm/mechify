"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AsyncSelect } from "@/components/shared/async-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

interface Expense {
  id: string;
  date: string;
  description: string;
  amount: string;
  reference: string | null;
  notes: string | null;
  category: { id: string; name: string };
  paymentMethod: { id: string; name: string };
}

interface SelectOption {
  id: string;
  name: string;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Options
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<SelectOption[]>([]);

  // Add form
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  function fetchExpenses() {
    const params = new URLSearchParams();
    if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    fetch(`/api/expenses?${params}`)
      .then((r) => r.ok ? r.json() : { data: [], totalAmount: 0 })
      .then((json) => {
        setExpenses(json.data ?? []);
        setTotalAmount(json.totalAmount ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/master-data?type=EXPENSE_CATEGORY").then((r) => r.ok ? r.json() : { data: [] }),
      fetch("/api/master-data?type=PAYMENT_METHOD").then((r) => r.ok ? r.json() : { data: [] }),
    ]).then(([catJson, pmJson]) => {
      setCategories(catJson.data ?? []);
      setPaymentMethods(pmJson.data ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchExpenses(); }, [categoryFilter, fromDate, toDate]);

  async function handleAdd() {
    if (!categoryId || !description.trim() || !amount || !paymentMethodId) {
      toast.error("Fill all required fields");
      return;
    }
    setAdding(true);
    const isEdit = !!editId;
    const res = await fetch(isEdit ? `/api/expenses/${editId}` : "/api/expenses", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date, categoryId, description,
        amount: Number(amount),
        paymentMethodId,
        reference: reference || null,
        notes: notes || null,
      }),
    });
    setAdding(false);
    if (!res.ok) { const err = await res.json(); toast.error(err.error); return; }
    toast.success(isEdit ? "Expense updated" : "Expense recorded");
    setShowAdd(false);
    setEditId(null);
    setDescription(""); setAmount(""); setReference(""); setNotes("");
    fetchExpenses();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense?")) return;
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete"); return; }
    toast.success("Expense deleted");
    fetchExpenses();
  }

  // Group by category for summary
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    categoryTotals[e.category.name] = (categoryTotals[e.category.name] ?? 0) + Number(e.amount);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Button onClick={() => { setEditId(null); setDate(new Date().toISOString().split("T")[0]); setCategoryId(""); setDescription(""); setAmount(""); setPaymentMethodId(""); setReference(""); setNotes(""); setShowAdd(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Record Expense
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="col-span-1"><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold text-red-600">Rs.{totalAmount.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Total Expenses</p>
        </CardContent></Card>
        {Object.entries(categoryTotals).slice(0, 3).map(([cat, total]) => (
          <Card key={cat}><CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">Rs.{total.toFixed(0)}</p>
            <p className="text-xs text-gray-500">{cat}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <AsyncSelect value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "")}
            options={[{ id: "all", name: "All Categories" }, ...categories]} placeholder="All" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No expenses found
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell className="text-sm">
                        {new Date(exp.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{exp.category.name}</Badge></TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{exp.description}</p>
                        {exp.notes && <p className="text-xs text-gray-400">{exp.notes}</p>}
                      </TableCell>
                      <TableCell className="text-right font-medium">Rs.{Number(exp.amount).toFixed(0)}</TableCell>
                      <TableCell className="text-sm">{exp.paymentMethod.name}</TableCell>
                      <TableCell className="text-sm text-gray-500">{exp.reference ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            setEditId(exp.id);
                            setDate(new Date(exp.date).toISOString().split("T")[0]);
                            setCategoryId(exp.category.id);
                            setDescription(exp.description);
                            setAmount(String(Number(exp.amount)));
                            setPaymentMethodId(exp.paymentMethod.id);
                            setReference(exp.reference ?? "");
                            setNotes(exp.notes ?? "");
                            setShowAdd(true);
                          }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(exp.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Expense Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit" : "Record"} Expense</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <AsyncSelect value={categoryId} onValueChange={setCategoryId}
                options={categories} placeholder="Select category..." />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Description *</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Monthly rent, Google Ads, Electricity bill" />
            </div>
            <div className="space-y-2">
              <Label>Amount (Rs.) *</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <AsyncSelect value={paymentMethodId} onValueChange={setPaymentMethodId}
                options={paymentMethods} placeholder="Select method..." />
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)}
                placeholder="Receipt no., UTR, etc." />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? "Saving..." : editId ? "Update Expense" : "Record Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
