"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Search, UserCircle } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  dailyWage: string;
  onCallRate: string;
  joiningDate: string;
  active: boolean;
  _count: { attendance: number; advancePayments: number };
}

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Add form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [dailyWage, setDailyWage] = useState("");
  const [onCallRate, setOnCallRate] = useState("");
  const [adding, setAdding] = useState(false);

  function fetchEmployees() {
    const params = new URLSearchParams();
    if (!showInactive) params.set("active", "true");
    if (search) params.set("search", search);
    fetch(`/api/employees?${params}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json) => { setEmployees(json.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { fetchEmployees(); }, [search, showInactive]);

  async function handleAdd() {
    if (!name.trim() || !role.trim()) { toast.error("Name and role are required"); return; }
    setAdding(true);

    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, phone: phone || null, role,
        wageType: "DAILY",
        dailyWage: dailyWage ? Number(dailyWage) : 0,
        onCallRate: onCallRate ? Number(onCallRate) : 0,
      }),
    });

    setAdding(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to add employee" }));
      toast.error(err.error || "Failed to add employee");
      return;
    }
    toast.success("Employee added");
    setShowAdd(false);
    setName(""); setPhone(""); setRole(""); setDailyWage(""); setOnCallRate("");
    fetchEmployees();
  }

  const activeEmployees = employees.filter((e) => e.active);
  const totalDailyWage = activeEmployees.reduce((s, e) => s + Number(e.dailyWage), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employees</h1>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add Employee
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold">{activeEmployees.length}</p>
          <p className="text-xs text-gray-500">Active Staff</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold">Rs.{totalDailyWage.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Total Daily Wages</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold">Rs.{(totalDailyWage * 6).toFixed(0)}</p>
          <p className="text-xs text-gray-500">Weekly Bill (6 days)</p>
        </CardContent></Card>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 items-center">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, phone, role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant={showInactive ? "default" : "outline"} size="sm"
          onClick={() => setShowInactive(!showInactive)}>
          {showInactive ? "Showing All" : "Show Inactive"}
        </Button>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Daily Wage</TableHead>
                  <TableHead className="text-right">On-Call Rate</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((emp) => (
                    <TableRow key={emp.id} className="cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push(`/employees/${emp.id}`)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserCircle className="h-5 w-5 text-gray-400" />
                          <span className="font-medium">{emp.name}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{emp.role}</Badge></TableCell>
                      <TableCell className="text-sm">{emp.phone ?? "—"}</TableCell>
                      <TableCell className="text-right">Rs.{Number(emp.dailyWage).toFixed(0)}/day</TableCell>
                      <TableCell className="text-right">Rs.{Number(emp.onCallRate).toFixed(0)}/day</TableCell>
                      <TableCell className="text-sm">
                        {new Date(emp.joiningDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.active ? "default" : "secondary"}>
                          {emp.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Employee Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g., Mechanic, Helper" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
            </div>
            <div className="space-y-2">
              <Label>Daily Wage (Rs.) *</Label>
              <Input type="number" value={dailyWage} onChange={(e) => setDailyWage(e.target.value)} placeholder="e.g., 500" />
            </div>
            <div className="space-y-2">
              <Label>On-Call Rate (Rs./day)</Label>
              <Input type="number" value={onCallRate} onChange={(e) => setOnCallRate(e.target.value)} placeholder="Same as daily wage if empty" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? "Adding..." : "Add Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
