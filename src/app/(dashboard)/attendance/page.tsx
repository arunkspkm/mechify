"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, ChevronLeft, ChevronRight } from "lucide-react";

type Status = "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_CALL" | "LEAVE" | "HOLIDAY";

interface Employee {
  id: string;
  name: string;
  role: string;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  status: Status;
  employee: { name: string; role: string };
}

const STATUS_OPTIONS: { value: Status; label: string; color: string }[] = [
  { value: "PRESENT", label: "P", color: "bg-green-100 text-green-800" },
  { value: "ABSENT", label: "A", color: "bg-red-100 text-red-800" },
  { value: "HALF_DAY", label: "H", color: "bg-amber-100 text-amber-800" },
  { value: "ON_CALL", label: "OC", color: "bg-blue-100 text-blue-800" },
  { value: "LEAVE", label: "L", color: "bg-gray-100 text-gray-800" },
  { value: "HOLIDAY", label: "HD", color: "bg-red-200 text-red-900" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function AttendancePage() {
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local edits: { "employeeId-day": Status }
  const [edits, setEdits] = useState<Record<string, Status>>({});

  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();

  function fetchData() {
    setLoading(true);
    fetch(`/api/attendance?month=${month}&year=${year}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json) => {
        setRecords(json.data ?? []);
        setEmployees(json.employees ?? []);
        setEdits({});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => { fetchData(); }, [month, year]);

  function getStatus(employeeId: string, day: number): Status | null {
    const key = `${employeeId}-${day}`;
    if (edits[key]) return edits[key];
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const record = records.find(
      (r) => r.employeeId === employeeId && r.date.startsWith(dateStr)
    );
    return record?.status ?? null;
  }

  function toggleStatus(employeeId: string, day: number) {
    const key = `${employeeId}-${day}`;
    const current = getStatus(employeeId, day);
    const order: Status[] = ["PRESENT", "ABSENT", "HALF_DAY", "ON_CALL", "LEAVE", "HOLIDAY"];
    const nextIdx = current ? (order.indexOf(current) + 1) % order.length : 0;
    setEdits((prev) => ({ ...prev, [key]: order[nextIdx] }));
  }

  // Mark all employees as HOLIDAY for a given day
  function markHoliday(day: number) {
    const newEdits = { ...edits };
    for (const emp of employees) {
      newEdits[`${emp.id}-${day}`] = "HOLIDAY";
    }
    setEdits(newEdits);
  }

  async function handleSave() {
    const entries = Object.entries(edits).map(([key, status]) => {
      const [employeeId, dayStr] = key.split("-");
      const date = `${year}-${String(month).padStart(2, "0")}-${String(parseInt(dayStr)).padStart(2, "0")}`;
      return { employeeId, date, status };
    });

    if (entries.length === 0) { toast.error("No changes to save"); return; }

    setSaving(true);
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    setSaving(false);

    if (!res.ok) { const err = await res.json(); toast.error(err.error); return; }
    toast.success(`${entries.length} attendance records saved`);
    fetchData();
  }

  function getEmployeeSummary(employeeId: string) {
    const summary = { P: 0, A: 0, H: 0, OC: 0, L: 0 };
    for (let d = 1; d <= daysInMonth; d++) {
      const s = getStatus(employeeId, d);
      if (s === "PRESENT") summary.P++;
      else if (s === "ABSENT") summary.A++;
      else if (s === "HALF_DAY") summary.H++;
      else if (s === "ON_CALL") summary.OC++;
      else if (s === "LEAVE") summary.L++;
    }
    return summary;
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Attendance</h1>
        <div className="flex items-center gap-2">
          {Object.keys(edits).length > 0 && (
            <Badge variant="secondary">{Object.keys(edits).length} changes</Badge>
          )}
          <Button onClick={handleSave} disabled={saving || Object.keys(edits).length === 0}>
            <Save className="mr-1 h-4 w-4" /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-medium min-w-[160px] text-center">
          {MONTHS[month - 1]} {year}
        </span>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-xs">
        {STATUS_OPTIONS.map((s) => (
          <span key={s.value} className={`px-2 py-1 rounded ${s.color}`}>
            {s.label} = {s.value.replace("_", " ")}
          </span>
        ))}
        <span className="text-gray-400 ml-2">Click cell to cycle status | Click Sunday header to mark holiday for all</span>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : employees.length === 0 ? (
        <p className="text-gray-500">No active employees. Add employees first.</p>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-white z-10 min-w-[140px]">Employee</TableHead>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const dateObj = new Date(year, month - 1, day);
                    const isSunday = dateObj.getDay() === 0;
                    return (
                      <TableHead key={day}
                        className={`text-center px-1 min-w-[36px] ${isSunday ? "bg-red-50 text-red-600 cursor-pointer" : ""}`}
                        onClick={isSunday ? () => markHoliday(day) : undefined}
                        title={isSunday ? "Click to mark holiday for all" : undefined}
                      >
                        <div className="text-xs">{day}</div>
                        <div className={`text-[10px] ${isSunday ? "text-red-400" : "text-gray-400"}`}>
                          {dateObj.toLocaleDateString("en-IN", { weekday: "narrow" })}
                        </div>
                      </TableHead>
                    );
                  })}
                  <TableHead className="text-center px-2">P</TableHead>
                  <TableHead className="text-center px-2">A</TableHead>
                  <TableHead className="text-center px-2">H</TableHead>
                  <TableHead className="text-center px-2">OC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => {
                  const summary = getEmployeeSummary(emp.id);
                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="sticky left-0 bg-white z-10 font-medium text-sm">
                        {emp.name}
                        <span className="text-xs text-gray-400 ml-1">({emp.role})</span>
                      </TableCell>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                        const status = getStatus(emp.id, day);
                        const dateObj = new Date(year, month - 1, day);
                        const isSunday = dateObj.getDay() === 0;
                        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                        const isFuture = dateObj > todayDate;
                        const opt = STATUS_OPTIONS.find((s) => s.value === status);
                        const key = `${emp.id}-${day}`;
                        const isEdited = edits[key] !== undefined;

                        return (
                          <TableCell
                            key={day}
                            className={`text-center px-1 cursor-pointer select-none ${isSunday ? "bg-red-50" : ""} ${isFuture ? "opacity-30" : ""}`}
                            onClick={() => !isFuture && toggleStatus(emp.id, day)}
                          >
                            {status ? (
                              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${opt?.color ?? ""} ${isEdited ? "ring-2 ring-blue-400" : ""}`}>
                                {opt?.label}
                              </span>
                            ) : (
                              <span className="text-gray-200">·</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center text-sm font-medium text-green-600">{summary.P}</TableCell>
                      <TableCell className="text-center text-sm font-medium text-red-600">{summary.A}</TableCell>
                      <TableCell className="text-center text-sm font-medium text-amber-600">{summary.H}</TableCell>
                      <TableCell className="text-center text-sm font-medium text-blue-600">{summary.OC}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
