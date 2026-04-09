"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PriceHistoryEntry {
  id: string;
  batchNumber: string | null;
  date: string;
  supplier: string;
  qtyReceived: number;
  qtyRemaining: number;
  unitCost: number;
  handlingCharge: number;
  landedCost: number;
  qualityGrade: string | null;
  expiryDate: string | null;
}

interface PriceStats {
  avgCost: number;
  minCost: number;
  maxCost: number;
  latestCost: number;
  totalBatches: number;
}

interface SellingPriceChange {
  id: string;
  date: string;
  changeType: string;
  oldMrp: number;
  newMrp: number;
  oldSellingPrice: number;
  newSellingPrice: number;
  oldTaxRateName: string | null;
  newTaxRateName: string | null;
  reason: string | null;
  changedBy: string;
}

interface PriceHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
}

export function PriceHistoryDialog({
  open,
  onOpenChange,
  productId,
  productName,
}: PriceHistoryDialogProps) {
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [stats, setStats] = useState<PriceStats | null>(null);
  const [sellingPriceChanges, setSellingPriceChanges] = useState<SellingPriceChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !productId) return;
    setLoading(true);
    fetch(`/api/products/${productId}/price-history`)
      .then((r) => r.json())
      .then((json) => {
        setHistory(json.data ?? []);
        setStats(json.stats ?? null);
        setSellingPriceChanges(json.sellingPriceHistory ?? []);
        setLoading(false);
      });
  }, [open, productId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Price History — {productName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-gray-500 py-4">Loading...</p>
        ) : history.length === 0 ? (
          <p className="text-gray-500 py-4">No purchase history for this product yet.</p>
        ) : (
          <div className="space-y-4">
            {/* Stats Summary */}
            {stats && (
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-lg font-bold">Rs.{stats.latestCost.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Latest Cost</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-lg font-bold">Rs.{stats.avgCost.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Average Cost</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-green-700">Rs.{stats.minCost.toFixed(2)}</p>
                  <p className="text-xs text-green-600">Lowest Cost</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-red-700">Rs.{stats.maxCost.toFixed(2)}</p>
                  <p className="text-xs text-red-600">Highest Cost</p>
                </div>
              </div>
            )}

            {/* Batch History Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Handling</TableHead>
                  <TableHead className="text-right">Landed Cost</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry, idx) => {
                  const prevEntry = history[idx + 1]; // older entry (list is newest first)
                  const trend = prevEntry
                    ? entry.landedCost > prevEntry.landedCost
                      ? "up"
                      : entry.landedCost < prevEntry.landedCost
                        ? "down"
                        : "same"
                    : null;

                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm">
                        {new Date(entry.date).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell className="text-sm">{entry.supplier}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {entry.batchNumber ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {entry.qtyReceived}
                        {entry.qtyRemaining < entry.qtyReceived && (
                          <span className="text-gray-400 ml-1">
                            ({entry.qtyRemaining} left)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        Rs.{entry.unitCost.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-500">
                        Rs.{entry.handlingCharge.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        Rs.{entry.landedCost.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {entry.qualityGrade ?? "—"}
                      </TableCell>
                      <TableCell>
                        {trend === "up" && (
                          <Badge variant="destructive" className="text-xs">
                            ↑ +Rs.{(entry.landedCost - prevEntry!.landedCost).toFixed(2)}
                          </Badge>
                        )}
                        {trend === "down" && (
                          <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">
                            ↓ -Rs.{(prevEntry!.landedCost - entry.landedCost).toFixed(2)}
                          </Badge>
                        )}
                        {trend === "same" && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {/* Selling Price Change History */}
            {sellingPriceChanges.length > 0 && (
              <>
                <h3 className="font-semibold mt-4 mb-2">Price &amp; Tax Rate Changes</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sellingPriceChanges.map((pc) => (
                      <TableRow key={pc.id}>
                        <TableCell className="text-sm">
                          {new Date(pc.date).toLocaleDateString("en-IN")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={pc.changeType === "TAX_RATE" ? "destructive" : "secondary"} className="text-xs">
                            {pc.changeType === "PRICE" ? "Price" : pc.changeType === "TAX_RATE" ? "Tax Rate" : "Price + Tax"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {(pc.changeType === "PRICE" || pc.changeType === "BOTH") && (
                            <div>
                              {pc.oldMrp !== pc.newMrp && (
                                <span>MRP: Rs.{pc.oldMrp.toFixed(0)} → <strong className={pc.newMrp > pc.oldMrp ? "text-red-600" : "text-green-600"}>Rs.{pc.newMrp.toFixed(0)}</strong></span>
                              )}
                              {pc.oldSellingPrice !== pc.newSellingPrice && (
                                <span className="ml-2">Sell: Rs.{pc.oldSellingPrice.toFixed(0)} → <strong className={pc.newSellingPrice > pc.oldSellingPrice ? "text-red-600" : "text-green-600"}>Rs.{pc.newSellingPrice.toFixed(0)}</strong></span>
                              )}
                            </div>
                          )}
                          {(pc.changeType === "TAX_RATE" || pc.changeType === "BOTH") && (
                            <div>
                              Tax: {pc.oldTaxRateName ?? "None"} → <strong>{pc.newTaxRateName ?? "None"}</strong>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{pc.reason ?? "—"}</TableCell>
                        <TableCell className="text-sm text-gray-500">{pc.changedBy}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
