"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AsyncSelect } from "@/components/shared/async-select";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Pencil, Trash2 } from "lucide-react";

interface EmployeeDetail {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  wageType: string;
  dailyWage: string;
  monthlySalary: string;
  onCallRate: string;
  joiningDate: string;
  exitDate: string | null;
  idProofType: string | null;
  idProofNumber: string | null;
  address: string | null;
  emergencyContact: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  active: boolean;
  weekStart: string;
  weekEnd: string;
  attendanceSummary: {
    present: number;
    absent: number;
    halfDay: number;
    onCall: number;
    leave: number;
  };
  totalUndeductedAdvances: number;
  salaryRecords: {
    id: string;
    periodType: string;
    periodStart: string;
    periodEnd: string;
    dailyWage: string;
    baseSalary: string;
    onCallAmount: string;
    totalAdvances: string;
    bonus: string;
    deductions: string;
    netPayable: string;
    paidAmount: string;
    presentDays: number;
    halfDays: number;
    onCallDays: number;
    status: string;
    paymentMethod?: { id: string; name: string } | null;
  }[];
  advancePayments: {
    id: string;
    amount: string;
    reason: string | null;
    date: string;
    paymentMethod?: { id: string; name: string } | null;
    deductedInMonth: number | null;
    deductedInYear: number | null;
  }[];
}

function formatWeek(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  return `${s.toLocaleDateString("en-IN", opts)} — ${e.toLocaleDateString("en-IN", { ...opts, year: "numeric" })}`;
}

function getLastSaturday(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const day = now.getDay();
  // Find last Saturday
  const satOffset = day === 6 ? 0 : day === 0 ? 1 : day + 1;
  const sat = new Date(now);
  sat.setDate(now.getDate() - satOffset);
  // Monday of that week
  const mon = new Date(sat);
  mon.setDate(sat.getDate() - 5);
  return {
    weekStart: mon.toISOString().split("T")[0],
    weekEnd: sat.toISOString().split("T")[0],
  };
}

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [dailyWage, setDailyWage] = useState("");
  const [onCallRate, setOnCallRate] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [idProofType, setIdProofType] = useState("");
  const [idProofNumber, setIdProofNumber] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string }[]>([]);

  // Advance dialog
  const [showAdvance, setShowAdvance] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceReason, setAdvanceReason] = useState("");
  const [advancePayMethodId, setAdvancePayMethodId] = useState("");
  const [advanceReference, setAdvanceReference] = useState("");
  const [addingAdvance, setAddingAdvance] = useState(false);
  const [editAdvanceId, setEditAdvanceId] = useState<string | null>(null);

  // Settle week dialog
  const [showSettle, setShowSettle] = useState(false);
  const [settleWeekStart, setSettleWeekStart] = useState("");
  const [settleWeekEnd, setSettleWeekEnd] = useState("");
  const [settleBonus, setSettleBonus] = useState("0");
  const [settleDeductions, setSettleDeductions] = useState("0");
  const [settling, setSettling] = useState(false);
  const [settlePreview, setSettlePreview] = useState<{
    presentDays: number; halfDays: number; onCallDays: number;
    baseSalary: number; onCallAmount: number; totalAdvances: number;
    netPayable: number;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Pay dialog
  const [showPay, setShowPay] = useState(false);
  const [payRecordId, setPayRecordId] = useState("");
  const [payNet, setPayNet] = useState(0);
  const [payAlreadyPaid, setPayAlreadyPaid] = useState(0);
  const [payAmount, setPayAmount] = useState("");
  const [payMethodId, setPayMethodId] = useState("");
  const [payReference, setPayReference] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetch("/api/master-data?type=PAYMENT_METHOD")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => setPaymentMethods(json.data ?? []))
      .catch(() => {});
  }, []);

  function fetchEmployee() {
    fetch(`/api/employees/${id}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json) => {
        const e = json.data;
        if (e) {
          setEmployee(e);
          setName(e.name);
          setPhone(e.phone ?? "");
          setRole(e.role);
          setDailyWage(String(Number(e.dailyWage)));
          setOnCallRate(String(Number(e.onCallRate)));
          setAddress(e.address ?? "");
          setEmergencyContact(e.emergencyContact ?? "");
          setIdProofType(e.idProofType ?? "");
          setIdProofNumber(e.idProofNumber ?? "");
          setBankAccountNumber(e.bankAccountNumber ?? "");
          setBankIfsc(e.bankIfsc ?? "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { fetchEmployee(); }, [id]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, phone: phone || null, role,
        dailyWage: Number(dailyWage),
        onCallRate: Number(onCallRate),
        address: address || null,
        emergencyContact: emergencyContact || null,
        idProofType: idProofType || null,
        idProofNumber: idProofNumber || null,
        bankAccountNumber: bankAccountNumber || null,
        bankIfsc: bankIfsc || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed" }));
      toast.error(err.error); return;
    }
    toast.success("Employee updated");
  }

  async function handleAddAdvance() {
    if (!advanceAmount || Number(advanceAmount) <= 0) { toast.error("Enter a valid amount"); return; }
    setAddingAdvance(true);

    const isEdit = !!editAdvanceId;
    const res = await fetch(isEdit ? `/api/advances/${editAdvanceId}` : "/api/advances", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isEdit ? {} : { employeeId: id }),
        amount: Number(advanceAmount),
        reason: advanceReason || null,
        paymentMethodId: advancePayMethodId || null,
        reference: advanceReference || null,
      }),
    });
    setAddingAdvance(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed" }));
      toast.error(err.error); return;
    }
    toast.success(isEdit ? "Advance updated" : "Advance recorded");
    setShowAdvance(false);
    setEditAdvanceId(null);
    setAdvanceAmount(""); setAdvanceReason(""); setAdvancePayMethodId(""); setAdvanceReference("");
    fetchEmployee();
  }

  async function fetchSettlePreview(ws: string, we: string) {
    if (!ws || !we || !employee) return;
    setLoadingPreview(true);
    try {
      // Fetch attendance — if week spans two months, fetch both
      const startDate = new Date(ws);
      const endDate = new Date(we);
      const fetches: Promise<Response>[] = [];
      fetches.push(fetch(`/api/attendance?month=${startDate.getMonth() + 1}&year=${startDate.getFullYear()}&employeeId=${id}`));
      if (endDate.getMonth() !== startDate.getMonth() || endDate.getFullYear() !== startDate.getFullYear()) {
        fetches.push(fetch(`/api/attendance?month=${endDate.getMonth() + 1}&year=${endDate.getFullYear()}&employeeId=${id}`));
      }
      const responses = await Promise.all(fetches);
      let records: { date: string; status: string }[] = [];
      for (const res of responses) {
        if (!res.ok) continue;
        const json = await res.json();
        records = records.concat(json.data ?? []);
      }

      // Filter to the week range (compare date strings to avoid timezone issues)
      const weekRecords = records.filter((r) => {
        const d = r.date.slice(0, 10);
        return d >= ws && d <= we;
      });

      const presentDays = weekRecords.filter((r) => r.status === "PRESENT").length;
      const halfDays = weekRecords.filter((r) => r.status === "HALF_DAY").length;
      const onCallDays = weekRecords.filter((r) => r.status === "ON_CALL").length;

      const dw = Number(employee.dailyWage);
      const ocRate = Number(employee.onCallRate) || dw;
      const baseSalary = dw * (presentDays + halfDays * 0.5);
      const onCallAmount = onCallDays * ocRate;
      const totalAdvances = employee.totalUndeductedAdvances;

      setSettlePreview({ presentDays, halfDays, onCallDays, baseSalary, onCallAmount, totalAdvances, netPayable: 0 });
    } catch {
      setSettlePreview(null);
    }
    setLoadingPreview(false);
  }

  function openSettleDialog() {
    const { weekStart, weekEnd } = getLastSaturday();
    setSettleWeekStart(weekStart);
    setSettleWeekEnd(weekEnd);
    setSettleBonus("0");
    setSettleDeductions("0");
    setSettlePreview(null);
    setShowSettle(true);
    fetchSettlePreview(weekStart, weekEnd);
  }

  async function handleSettle() {
    setSettling(true);
    const res = await fetch("/api/salary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: id,
        weekStart: settleWeekStart,
        weekEnd: settleWeekEnd,
        bonus: Number(settleBonus) || 0,
        deductions: Number(settleDeductions) || 0,
      }),
    });
    setSettling(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed" }));
      toast.error(err.error); return;
    }
    toast.success("Week settled");
    setShowSettle(false);
    fetchEmployee();
  }

  function openPayDialog(recordId: string, netPayable: number, paidAmount: number) {
    setPayRecordId(recordId);
    setPayNet(netPayable);
    setPayAlreadyPaid(paidAmount);
    setPayAmount(String(netPayable - paidAmount));
    setShowPay(true);
  }

  async function handlePaySalary() {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setPaying(true);
    const res = await fetch(`/api/salary/${payRecordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pay", amount: amt, paymentMethodId: payMethodId || null, paymentReference: payReference || null }),
    });
    setPaying(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed" }));
      toast.error(err.error); return;
    }
    const json = await res.json();
    if (json.overpay) {
      toast.success(`Paid! Rs.${json.overpay.excess.toFixed(0)} excess recorded as advance for next week`);
    } else {
      toast.success("Salary paid");
    }
    setShowPay(false);
    fetchEmployee();
  }

  async function handleToggleActive() {
    const res = await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !employee?.active }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed" }));
      toast.error(err.error); return;
    }
    toast.success(employee?.active ? "Employee deactivated" : "Employee activated");
    fetchEmployee();
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!employee) return <p className="text-red-600">Employee not found</p>;

  const attn = employee.attendanceSummary;
  const dw = Number(employee.dailyWage);
  const thisWeekEarning = dw * (attn.present + attn.halfDay * 0.5) +
    (Number(employee.onCallRate) || dw) * attn.onCall;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/employees" className="text-sm text-blue-600 flex items-center gap-1 mb-1">
          <ArrowLeft className="h-3 w-3" /> Back to Employees
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{employee.name}</h1>
          <Badge variant={employee.active ? "default" : "secondary"}>
            {employee.active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="text-sm text-gray-500">{employee.role} — Rs.{dw}/day</p>
      </div>

      {/* This Week Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold text-green-600">{attn.present}</p>
          <p className="text-xs text-gray-500">Present (this week)</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{attn.halfDay + attn.onCall}</p>
          <p className="text-xs text-gray-500">Half / On-Call</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          <p className="text-2xl font-bold">Rs.{thisWeekEarning.toFixed(0)}</p>
          <p className="text-xs text-gray-500">This Week Earning</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 text-center">
          <p className={`text-2xl font-bold ${employee.totalUndeductedAdvances > 0 ? "text-red-600" : ""}`}>
            Rs.{employee.totalUndeductedAdvances.toFixed(0)}
          </p>
          <p className="text-xs text-gray-500">Pending Advances</p>
        </CardContent></Card>
      </div>

      {/* Edit Details */}
      <Card>
        <CardHeader><CardTitle>Employee Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Role *</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Daily Wage (Rs.)</Label>
            <Input type="number" value={dailyWage} onChange={(e) => setDailyWage(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>On-Call Rate (Rs./day)</Label>
            <Input type="number" value={onCallRate} onChange={(e) => setOnCallRate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Emergency Contact</Label>
            <Input value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>ID Proof Type</Label>
            <Input value={idProofType} onChange={(e) => setIdProofType(e.target.value)} placeholder="Aadhaar, PAN, etc." />
          </div>
          <div className="space-y-2">
            <Label>ID Proof Number</Label>
            <Input value={idProofNumber} onChange={(e) => setIdProofNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Bank Account Number</Label>
            <Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Bank IFSC</Label>
            <Input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button variant="outline" onClick={() => { setEditAdvanceId(null); setAdvanceAmount(""); setAdvanceReason(""); setAdvancePayMethodId(""); setAdvanceReference(""); setShowAdvance(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Record Advance
        </Button>
        <Button variant="outline" onClick={openSettleDialog}>
          Settle Week
        </Button>
        <Button variant={employee.active ? "destructive" : "default"} size="sm" onClick={handleToggleActive}>
          {employee.active ? "Deactivate" : "Activate"}
        </Button>
      </div>

      {/* Weekly Settlement History */}
      {employee.salaryRecords.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Weekly Settlements</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead className="text-right">Wage</TableHead>
                  <TableHead className="text-right">On-Call</TableHead>
                  <TableHead className="text-right">Advances</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employee.salaryRecords.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">{formatWeek(s.periodStart, s.periodEnd)}</TableCell>
                    <TableCell className="text-center text-sm">
                      {s.presentDays}P {s.halfDays > 0 ? `${s.halfDays}H ` : ""}{s.onCallDays > 0 ? `${s.onCallDays}OC` : ""}
                    </TableCell>
                    <TableCell className="text-right">Rs.{Number(s.baseSalary).toFixed(0)}</TableCell>
                    <TableCell className="text-right">
                      {Number(s.onCallAmount) > 0 ? `Rs.${Number(s.onCallAmount).toFixed(0)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {Number(s.totalAdvances) > 0 ? `-Rs.${Number(s.totalAdvances).toFixed(0)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">Rs.{Number(s.netPayable).toFixed(0)}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "PAID" ? "default" : "secondary"}>{s.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {s.status !== "PAID" && Number(s.netPayable) > 0 && (
                          <Button size="sm" variant="outline"
                            onClick={() => openPayDialog(s.id, Number(s.netPayable), Number(s.paidAmount))}>
                            Pay
                          </Button>
                        )}
                        {s.status !== "PAID" && Number(s.netPayable) === 0 && (
                          <span className="text-xs text-gray-500">Nothing to pay</span>
                        )}
                        {Number(s.paidAmount) === 0 && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" title="Reverse settlement"
                            onClick={async () => {
                              if (!confirm("Reverse this settlement? Advances will be restored as pending.")) return;
                              const res = await fetch(`/api/salary/${s.id}`, { method: "DELETE" });
                              if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed"); return; }
                              toast.success("Settlement reversed");
                              fetchEmployee();
                            }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Advance History */}
      {employee.advancePayments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Advance Payments</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employee.advancePayments.map((adv) => (
                  <TableRow key={adv.id}>
                    <TableCell className="text-sm">
                      {new Date(adv.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right font-medium">Rs.{Number(adv.amount).toFixed(0)}</TableCell>
                    <TableCell className="text-sm">{adv.paymentMethod?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-gray-500">{adv.reason ?? "—"}</TableCell>
                    <TableCell>
                      {adv.deductedInMonth ? (
                        <Badge variant="secondary">Deducted</Badge>
                      ) : (
                        <Badge variant="destructive">To Recover</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!adv.deductedInMonth && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit"
                            onClick={() => {
                              setEditAdvanceId(adv.id);
                              setAdvanceAmount(String(Number(adv.amount)));
                              setAdvanceReason(adv.reason ?? "");
                              setAdvancePayMethodId(adv.paymentMethod?.id ?? "");
                              setAdvanceReference("");
                              setShowAdvance(true);
                            }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" title="Delete"
                            onClick={async () => {
                              if (!confirm(`Delete advance of Rs.${Number(adv.amount).toFixed(0)}?`)) return;
                              const res = await fetch(`/api/advances/${adv.id}`, { method: "DELETE" });
                              if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed"); return; }
                              toast.success("Advance deleted");
                              fetchEmployee();
                            }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Record Advance Dialog */}
      <Dialog open={showAdvance} onOpenChange={setShowAdvance}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editAdvanceId ? "Edit" : "Record"} Advance — {employee.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount (Rs.) *</Label>
              <Input type="number" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <AsyncSelect value={advancePayMethodId} onValueChange={setAdvancePayMethodId} options={paymentMethods} placeholder="Select method" />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={advanceReason} onChange={(e) => setAdvanceReason(e.target.value)} placeholder="e.g., Medical, Personal" />
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={advanceReference} onChange={(e) => setAdvanceReference(e.target.value)} placeholder="Receipt no., UTR, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdvance(false)}>Cancel</Button>
            <Button onClick={handleAddAdvance} disabled={addingAdvance}>
              {addingAdvance ? "Saving..." : editAdvanceId ? "Update Advance" : "Record Advance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle Week Dialog */}
      <Dialog open={showSettle} onOpenChange={setShowSettle}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Settle Week — {employee.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Week Start (Monday)</Label>
              <Input type="date" value={settleWeekStart} onChange={(e) => {
                setSettleWeekStart(e.target.value);
                fetchSettlePreview(e.target.value, settleWeekEnd);
              }} />
            </div>
            <div className="space-y-2">
              <Label>Week End (Saturday)</Label>
              <Input type="date" value={settleWeekEnd} onChange={(e) => {
                setSettleWeekEnd(e.target.value);
                fetchSettlePreview(settleWeekStart, e.target.value);
              }} />
            </div>
            <div className="space-y-2">
              <Label>Bonus (Rs.)</Label>
              <Input type="number" value={settleBonus} onChange={(e) => setSettleBonus(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Other Deductions (Rs.)</Label>
              <Input type="number" value={settleDeductions} onChange={(e) => setSettleDeductions(e.target.value)} />
            </div>
          </div>

          {/* Settlement Preview */}
          {loadingPreview ? (
            <p className="text-sm text-gray-400">Loading attendance...</p>
          ) : settlePreview && (
            <div className="border rounded-md p-3 space-y-1.5 text-sm bg-gray-50">
              <div className="flex justify-between">
                <span className="text-gray-500">Present Days:</span>
                <span>{settlePreview.presentDays} days</span>
              </div>
              {settlePreview.halfDays > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Half Days:</span>
                  <span>{settlePreview.halfDays} days (×0.5)</span>
                </div>
              )}
              {settlePreview.onCallDays > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">On-Call Days:</span>
                  <span>{settlePreview.onCallDays} days</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-gray-500">Base Wage ({settlePreview.presentDays}{settlePreview.halfDays > 0 ? `+${settlePreview.halfDays}×0.5` : ""} × Rs.{dw}):</span>
                <span>Rs.{settlePreview.baseSalary.toFixed(0)}</span>
              </div>
              {settlePreview.onCallAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">On-Call Amount:</span>
                  <span>Rs.{settlePreview.onCallAmount.toFixed(0)}</span>
                </div>
              )}
              {(Number(settleBonus) || 0) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Bonus:</span>
                  <span>+ Rs.{Number(settleBonus).toFixed(0)}</span>
                </div>
              )}
              {settlePreview.totalAdvances > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Pending Advances:</span>
                  <span>− Rs.{settlePreview.totalAdvances.toFixed(0)}</span>
                </div>
              )}
              {(Number(settleDeductions) || 0) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Other Deductions:</span>
                  <span>− Rs.{Number(settleDeductions).toFixed(0)}</span>
                </div>
              )}
              <Separator />
              {(() => {
                const net = Math.max(0,
                  settlePreview.baseSalary + settlePreview.onCallAmount
                  + (Number(settleBonus) || 0)
                  - settlePreview.totalAdvances
                  - (Number(settleDeductions) || 0)
                );
                return (
                  <div className="flex justify-between font-bold text-base">
                    <span>Pay to Employee:</span>
                    <span className="text-green-700">Rs.{net.toFixed(0)}</span>
                  </div>
                );
              })()}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettle(false)}>Cancel</Button>
            <Button onClick={handleSettle} disabled={settling || !settlePreview}>
              {settling ? "Settling..." : "Settle & Pay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Salary Dialog */}
      <Dialog open={showPay} onOpenChange={setShowPay}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Pay Salary — {employee.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Net Payable:</span>
              <span className="font-medium">Rs.{payNet.toFixed(0)}</span>
            </div>
            {payAlreadyPaid > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Already Paid:</span>
                <span>Rs.{payAlreadyPaid.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>Remaining:</span>
              <span>Rs.{(payNet - payAlreadyPaid).toFixed(0)}</span>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Amount to Pay Now (Rs.)</Label>
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                placeholder={String(payNet - payAlreadyPaid)} />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <AsyncSelect value={payMethodId} onValueChange={setPayMethodId} options={paymentMethods} placeholder="Select method" />
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="UTR, receipt no." />
            </div>
            {Number(payAmount) > (payNet - payAlreadyPaid) && Number(payAmount) > 0 && (
              <p className="text-amber-600 text-xs">
                Rs.{(Number(payAmount) - (payNet - payAlreadyPaid)).toFixed(0)} excess will be recorded as advance for next week
              </p>
            )}
            {Number(payAmount) > 0 && Number(payAmount) < (payNet - payAlreadyPaid) && (
              <p className="text-gray-500 text-xs">
                Rs.{(payNet - payAlreadyPaid - Number(payAmount)).toFixed(0)} will remain as balance due
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPay(false)}>Cancel</Button>
            <Button onClick={handlePaySalary} disabled={paying || !payAmount || Number(payAmount) <= 0}>
              {paying ? "Paying..." : `Pay Rs.${Number(payAmount || 0).toFixed(0)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
