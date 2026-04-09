"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Play, Square, Eye, Clock } from "lucide-react";

interface Shift {
  id: string;
  date: string;
  openingBalance: string;
  closingBalance: string | null;
  expectedCash: string | null;
  actualCash: string | null;
  variance: string | null;
  varianceReason: string | null;
  status: string;
  startTime: string;
  endTime: string | null;
  operator: { name: string };
  _count: { invoices: number };
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [openShiftDialog, setOpenShiftDialog] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Check for current open shift
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/shifts?limit=50");
    const json = await res.json();
    const data = json.data ?? [];
    setShifts(data);
    setCurrentShift(data.find((s: Shift) => s.status === "OPEN") ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  async function handleOpenShift() {
    setSubmitting(true);
    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingBalance: Number(openingBalance) }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to open shift");
      return;
    }

    toast.success("Shift opened");
    setOpenShiftDialog(false);
    setOpeningBalance("");
    fetchShifts();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shifts</h1>
          <p className="mt-1 text-sm text-gray-500">Day-end closing and cash reconciliation</p>
        </div>
        {!currentShift ? (
          <Button size="sm" onClick={() => setOpenShiftDialog(true)}>
            <Play className="mr-1 h-4 w-4" /> Open Shift
          </Button>
        ) : (
          <Link href={`/shifts/${currentShift.id}`}>
            <Button size="sm" variant="destructive">
              <Square className="mr-1 h-4 w-4" /> Close Current Shift
            </Button>
          </Link>
        )}
      </div>

      {/* Current Shift Banner */}
      {currentShift && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                <div>
                  <p className="font-medium">Shift Open — {currentShift.operator.name}</p>
                  <p className="text-sm text-gray-500">
                    Started {new Date(currentShift.startTime).toLocaleTimeString("en-IN")} |
                    Opening: Rs.{Number(currentShift.openingBalance).toFixed(0)} |
                    Invoices: {currentShift._count.invoices}
                  </p>
                </div>
              </div>
              <Link href={`/shifts/${currentShift.id}`}>
                <Button variant="outline" size="sm">View / Close</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shifts Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead className="text-center">Invoices</TableHead>
              <TableHead className="text-right">Opening</TableHead>
              <TableHead className="text-right">Expected Cash</TableHead>
              <TableHead className="text-right">Actual Cash</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-gray-500">Loading...</TableCell>
              </TableRow>
            ) : shifts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                  <Clock className="mx-auto h-8 w-8 mb-2 text-gray-300" />
                  No shifts yet. Open your first shift to start tracking.
                </TableCell>
              </TableRow>
            ) : (
              shifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell className="text-sm">
                    {new Date(shift.date).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell>{shift.operator.name}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(shift.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {shift.endTime
                      ? new Date(shift.endTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center">{shift._count.invoices}</TableCell>
                  <TableCell className="text-right">Rs.{Number(shift.openingBalance).toFixed(0)}</TableCell>
                  <TableCell className="text-right">
                    {shift.expectedCash ? `Rs.${Number(shift.expectedCash).toFixed(0)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {shift.actualCash ? `Rs.${Number(shift.actualCash).toFixed(0)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {shift.variance !== null ? (
                      <span className={Number(shift.variance) < 0 ? "text-red-600" : Number(shift.variance) > 0 ? "text-green-600" : ""}>
                        Rs.{Number(shift.variance).toFixed(0)}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={shift.status === "OPEN" ? "default" : "secondary"}>
                      {shift.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/shifts/${shift.id}`}>
                      <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Open Shift Dialog */}
      <Dialog open={openShiftDialog} onOpenChange={setOpenShiftDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open New Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Opening Cash Balance (Rs.) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="Count the cash in the drawer"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenShiftDialog(false)}>Cancel</Button>
            <Button onClick={handleOpenShift} disabled={submitting || !openingBalance}>
              {submitting ? "Opening..." : "Open Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
