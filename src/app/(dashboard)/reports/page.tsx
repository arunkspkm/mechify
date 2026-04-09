"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { Download } from "lucide-react";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

// Indian Financial Year helpers
const FY_START_MONTH = 4; // April

function getCurrentFY() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const fyStart = month >= FY_START_MONTH ? year : year - 1;
  return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31`, label: `FY ${fyStart}-${String(fyStart + 1).slice(2)}` };
}

function getLastFY() {
  const { from } = getCurrentFY();
  const fyStart = parseInt(from.slice(0, 4)) - 1;
  return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31`, label: `FY ${fyStart}-${String(fyStart + 1).slice(2)}` };
}

function getThisMonth() {
  const d = new Date();
  return {
    from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
    to: d.toISOString().slice(0, 10),
    label: "This Month",
  };
}

function getThisQuarter() {
  const now = new Date();
  const month = now.getMonth() + 1;
  // Indian FY quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
  let qStart: number, qStartYear: number;
  if (month >= 4 && month <= 6) { qStart = 4; qStartYear = now.getFullYear(); }
  else if (month >= 7 && month <= 9) { qStart = 7; qStartYear = now.getFullYear(); }
  else if (month >= 10 && month <= 12) { qStart = 10; qStartYear = now.getFullYear(); }
  else { qStart = 1; qStartYear = now.getFullYear(); }
  const qEnd = qStart + 2;
  const qEndYear = qEnd > 12 ? qStartYear + 1 : qStartYear;
  const qEndMonth = qEnd > 12 ? qEnd - 12 : qEnd;
  const lastDay = new Date(qEndYear, qEndMonth, 0).getDate();
  return {
    from: `${qStartYear}-${String(qStart).padStart(2, "0")}-01`,
    to: `${qEndYear}-${String(qEndMonth).padStart(2, "0")}-${lastDay}`,
    label: "This Quarter",
  };
}

function getThisWeek() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  return {
    from: mon.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
    label: "This Week",
  };
}

export default function ReportsPage() {
  const [from, setFrom] = useState(() => getCurrentFY().from);
  const [to, setTo] = useState(() => getCurrentFY().to);
  const [activePeriod, setActivePeriod] = useState("fy");
  const [tab, setTab] = useState("sales");

  function setPeriod(key: string, period: { from: string; to: string }) {
    setFrom(period.from);
    setTo(period.to);
    setActivePeriod(key);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setActivePeriod("custom"); }} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setActivePeriod("custom"); }} className="w-40" />
          </div>
        </div>
      </div>

      {/* Quick period buttons */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "fy", ...getCurrentFY() },
          { key: "lastfy", ...getLastFY() },
          { key: "quarter", ...getThisQuarter() },
          { key: "month", ...getThisMonth() },
          { key: "week", ...getThisWeek() },
        ].map((p) => (
          <Button key={p.key} variant={activePeriod === p.key ? "default" : "outline"} size="sm"
            onClick={() => setPeriod(p.key, p)}>
            {p.label}
          </Button>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="financial">P&L</TabsTrigger>
          <TabsTrigger value="supplier">Supplier Ledger</TabsTrigger>
          <TabsTrigger value="customer">Customer Ledger</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="gst">GST</TabsTrigger>
        </TabsList>

        <TabsContent value="sales"><SalesReport from={from} to={to} /></TabsContent>
        <TabsContent value="inventory"><InventoryReport /></TabsContent>
        <TabsContent value="financial"><FinancialReport from={from} to={to} /></TabsContent>
        <TabsContent value="supplier"><LedgerReport type="supplier" /></TabsContent>
        <TabsContent value="customer"><LedgerReport type="customer" /></TabsContent>
        <TabsContent value="payroll"><PayrollReport from={from} to={to} /></TabsContent>
        <TabsContent value="returns"><ReturnsReport from={from} to={to} /></TabsContent>
        <TabsContent value="gst"><GSTReport from={from} to={to} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============ SALES REPORT ============
function SalesReport({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/sales?from=${from}&to=${to}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { setData(json?.data ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [from, to]);

  if (loading) return <p className="text-gray-500 py-4">Loading...</p>;
  if (!data) return <p className="text-red-500">Failed to load</p>;

  const summary = data.summary as Record<string, number>;
  const chartData = data.chartData as { date: string; sales: number; invoiceCount: number }[];
  const invoices = data.invoices as Record<string, unknown>[];
  const discountAnalysis = data.discountAnalysis as {
    byProduct: { name: string; sku: string; totalDiscount: number; qty: number; count: number }[];
    byOperator: { name: string; totalDiscount: number; invoiceCount: number }[];
  } | undefined;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <div className="grid grid-cols-6 gap-4 flex-1">
          <Card><CardContent className="py-3 text-center">
            <p className="text-xl font-bold">Rs.{summary.totalSales?.toFixed(0)}</p>
            <p className="text-xs text-gray-500">Gross Sales</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 text-center">
            <p className="text-xl font-bold text-red-600">Rs.{summary.totalRefunds?.toFixed(0)}</p>
            <p className="text-xs text-gray-500">Returns ({summary.returnCount ?? 0})</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 text-center">
            <p className="text-xl font-bold text-green-700">Rs.{summary.netSales?.toFixed(0)}</p>
            <p className="text-xs text-gray-500">Net Sales</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 text-center">
            <p className="text-xl font-bold text-green-600">Rs.{summary.totalCollected?.toFixed(0)}</p>
            <p className="text-xs text-gray-500">Collected</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 text-center">
            <p className="text-xl font-bold text-red-600">Rs.{summary.totalOutstanding?.toFixed(0)}</p>
            <p className="text-xs text-gray-500">Outstanding</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 text-center">
            <p className="text-xl font-bold text-amber-600">Rs.{summary.totalDiscount?.toFixed(0)}</p>
            <p className="text-xs text-gray-500">Discounts</p>
          </CardContent></Card>
        </div>
        <Button variant="outline" size="sm" className="ml-4"
          onClick={() => window.open(`/api/reports/sales?from=${from}&to=${to}&format=excel`)}>
          <Download className="mr-1 h-4 w-4" /> Excel
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Sales Trend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => [`Rs.${Number(value).toFixed(0)}`, "Sales"]} />
              <Bar dataKey="sales" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Operator</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.slice(0, 50).map((inv: Record<string, unknown>, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-sm">{inv.invoiceNumber as string}</TableCell>
                  <TableCell className="text-sm">{new Date(inv.date as string).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</TableCell>
                  <TableCell className="text-sm">{(inv.customer as Record<string, string> | null)?.name ?? "Walk-in"}</TableCell>
                  <TableCell className="text-right">Rs.{Number(inv.grandTotal).toFixed(0)}</TableCell>
                  <TableCell className="text-right">Rs.{Number(inv.amountPaid).toFixed(0)}</TableCell>
                  <TableCell className="text-sm text-gray-500">{(inv.operator as Record<string, string>)?.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Discount Analysis */}
      {discountAnalysis && summary.totalDiscount > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4">
            {/* By Product */}
            <Card>
              <CardHeader><CardTitle>Discounts by Product</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Total Discount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discountAnalysis.byProduct.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.sku}</p>
                        </TableCell>
                        <TableCell className="text-right">{p.qty}</TableCell>
                        <TableCell className="text-right text-red-600">Rs.{p.totalDiscount.toFixed(0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* By Operator */}
            <Card>
              <CardHeader><CardTitle>Discounts by Operator</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operator</TableHead>
                      <TableHead className="text-right">Invoices</TableHead>
                      <TableHead className="text-right">Total Discount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discountAnalysis.byOperator.map((op, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{op.name}</TableCell>
                        <TableCell className="text-right">{op.invoiceCount}</TableCell>
                        <TableCell className="text-right text-red-600">Rs.{op.totalDiscount.toFixed(0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ============ INVENTORY REPORT ============
function InventoryReport() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("stock");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/inventory?type=${type}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { setData(json?.data ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [type]);

  if (loading) return <p className="text-gray-500 py-4">Loading...</p>;
  if (!data) return <p className="text-red-500">Failed to load</p>;

  const summary = data.summary as Record<string, number>;
  const products = data.products as Record<string, unknown>[];

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-2 items-center">
        {["stock", "lowstock", "expiry"].map((t) => (
          <Button key={t} variant={type === t ? "default" : "outline"} size="sm" onClick={() => setType(t)}>
            {t === "stock" ? "All Stock" : t === "lowstock" ? "Low Stock" : "Near Expiry"}
          </Button>
        ))}
        <Button variant="outline" size="sm" className="ml-auto"
          onClick={() => window.open(`/api/reports/inventory?type=${type}&format=excel`)}>
          <Download className="mr-1 h-4 w-4" /> Excel
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold">{summary.totalProducts}</p>
          <p className="text-xs text-gray-500">Products</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold">Rs.{summary.totalStockValue?.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Stock Value (Cost)</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold">Rs.{summary.totalRetailValue?.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Retail Value</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold text-red-600">{summary.lowStockCount}</p>
          <p className="text-xs text-gray-500">Low Stock Items</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Selling Price</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p: Record<string, unknown>, i: number) => (
                <TableRow key={i}>
                  <TableCell>
                    <p className="font-medium text-sm">{p.name as string}</p>
                    <p className="text-xs text-gray-400">{p.sku as string}</p>
                  </TableCell>
                  <TableCell className="text-sm">{p.category as string}</TableCell>
                  <TableCell className="text-right">{Number(p.totalQty)}</TableCell>
                  <TableCell className="text-right">Rs.{Number(p.totalValue).toFixed(0)}</TableCell>
                  <TableCell className="text-right">Rs.{Number(p.sellingPrice).toFixed(0)}</TableCell>
                  <TableCell>
                    {(p.isLowStock as boolean) && <Badge variant="destructive" className="mr-1">Low</Badge>}
                    {(p.isNearExpiry as boolean) && <Badge variant="secondary">Expiry</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ FINANCIAL REPORT (P&L) ============
function FinancialReport({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/financial?from=${from}&to=${to}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { setData(json?.data ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [from, to]);

  if (loading) return <p className="text-gray-500 py-4">Loading...</p>;
  if (!data) return <p className="text-red-500">Failed to load</p>;

  const expenseByCategory = data.expenseByCategory as { category: string; amount: number }[];
  const cashFlow = data.cashFlow as Record<string, number>;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm"
          onClick={() => window.open(`/api/reports/financial?from=${from}&to=${to}&format=excel`)}>
          <Download className="mr-1 h-4 w-4" /> Excel
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* P&L Statement */}
        <Card>
          <CardHeader><CardTitle>Profit & Loss</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Gross Revenue (Sales)</span>
              <span className="font-medium">Rs.{Number(data.grossRevenue).toFixed(0)}</span>
            </div>
            {Number(data.totalRefunds) > 0 && (
              <div className="flex justify-between text-red-600">
                <span className="ml-4">Return Refunds ({data.returnCount as number})</span>
                <span>− Rs.{Number(data.totalRefunds).toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>Net Revenue</span>
              <span>Rs.{Number(data.revenue).toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span className="ml-4">Invoices: {data.invoiceCount as number}</span>
              <span>Discounts: Rs.{Number(data.discountTotal).toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>Cost of Goods Sold</span>
              <span>− Rs.{Number(data.cogs).toFixed(0)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-medium">
              <span>Gross Profit</span>
              <span className={Number(data.grossProfit) >= 0 ? "text-green-600" : "text-red-600"}>
                Rs.{Number(data.grossProfit).toFixed(0)}
              </span>
            </div>
            <Separator />
            {expenseByCategory.map((e) => (
              <div key={e.category} className="flex justify-between text-red-600">
                <span className="ml-4">{e.category}</span>
                <span>− Rs.{e.amount.toFixed(0)}</span>
              </div>
            ))}
            <div className="flex justify-between text-red-600">
              <span>Total Expenses</span>
              <span>− Rs.{Number(data.totalExpenses).toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>Staff Salaries</span>
              <span>− Rs.{Number(data.totalSalaries).toFixed(0)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Net Profit</span>
              <span className={Number(data.netProfit) >= 0 ? "text-green-700" : "text-red-700"}>
                Rs.{Number(data.netProfit).toFixed(0)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Expense Breakdown + Cash Flow */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Expense Breakdown</CardTitle></CardHeader>
            <CardContent>
              {expenseByCategory.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No expenses</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={expenseByCategory} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={70}>
                      {expenseByCategory.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `Rs.${Number(v).toFixed(0)}`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Cash Flow</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Customer Collections (In)</span>
                <span className="text-green-600 font-medium">Rs.{cashFlow.customerCollections?.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Supplier Payments (Out)</span>
                <span className="text-red-600 font-medium">Rs.{cashFlow.supplierPayments?.toFixed(0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============ LEDGER REPORT (Supplier / Customer) ============
function LedgerReport({ type }: { type: "supplier" | "customer" }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/ledger?type=${type}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { setData(json?.data ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [type]);

  if (loading) return <p className="text-gray-500 py-4">Loading...</p>;
  if (!data) return <p className="text-red-500">Failed to load</p>;

  const summary = data.summary as Record<string, number>;
  const ledger = data.ledger as Record<string, unknown>[];
  const isSupplier = type === "supplier";

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <div className={`grid ${isSupplier ? "grid-cols-5" : "grid-cols-3"} gap-4 flex-1`}>
          <Card><CardContent className="py-3 text-center">
            <p className="text-xl font-bold">{isSupplier ? summary.supplierCount : summary.customerCount}</p>
            <p className="text-xs text-gray-500">{isSupplier ? "Suppliers" : "Customers"}</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 text-center">
            <p className="text-xl font-bold">Rs.{(isSupplier ? summary.totalPurchases : summary.totalCustomerSales)?.toFixed(0)}</p>
            <p className="text-xs text-gray-500">{isSupplier ? "Total Purchases" : "Total Sales"}</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 text-center">
            <p className="text-xl font-bold text-red-600">Rs.{(isSupplier ? summary.totalOutstanding : summary.totalReceivable)?.toFixed(0)}</p>
            <p className="text-xs text-gray-500">{isSupplier ? "Payable" : "Receivable"}</p>
          </CardContent></Card>
          {isSupplier && summary.totalOverpayment > 0 && (
            <Card><CardContent className="py-3 text-center">
              <p className="text-xl font-bold text-green-600">Rs.{summary.totalOverpayment?.toFixed(0)}</p>
              <p className="text-xs text-gray-500">Overpaid</p>
            </CardContent></Card>
          )}
          {isSupplier && summary.totalPendingAdvance > 0 && (
            <Card><CardContent className="py-3 text-center">
              <p className="text-xl font-bold text-amber-600">Rs.{summary.totalPendingAdvance?.toFixed(0)}</p>
              <p className="text-xs text-gray-500">Pending Advances</p>
            </CardContent></Card>
          )}
        </div>
        <Button variant="outline" size="sm" className="ml-4"
          onClick={() => window.open(`/api/reports/ledger?type=${type}&format=excel`)}>
          <Download className="mr-1 h-4 w-4" /> Excel
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isSupplier ? "Supplier" : "Customer"}</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">{isSupplier ? "Purchases" : "Sales"}</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                {isSupplier && <TableHead className="text-right">Overpaid</TableHead>}
                {isSupplier && <TableHead className="text-right">Advance</TableHead>}
                <TableHead className="text-center">Invoices</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((l: Record<string, unknown>, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-sm">{l.name as string}</TableCell>
                  <TableCell className="text-sm">{(l.phone as string) ?? "—"}</TableCell>
                  <TableCell className="text-right">Rs.{Number(isSupplier ? l.totalPurchases : l.totalSales).toFixed(0)}</TableCell>
                  <TableCell className="text-right">Rs.{Number(l.totalPaid).toFixed(0)}</TableCell>
                  <TableCell className="text-right">
                    {Number(l.outstanding) > 0 ? (
                      <span className="text-red-600 font-medium">Rs.{Number(l.outstanding).toFixed(0)}</span>
                    ) : "—"}
                  </TableCell>
                  {isSupplier && (
                    <TableCell className="text-right">
                      {Number(l.overpayment) > 0 ? (
                        <span className="text-green-600 font-medium">Rs.{Number(l.overpayment).toFixed(0)}</span>
                      ) : "—"}
                    </TableCell>
                  )}
                  {isSupplier && (
                    <TableCell className="text-right">
                      {Number(l.pendingAdvance) > 0 ? (
                        <span className="text-amber-600">Rs.{Number(l.pendingAdvance).toFixed(0)}</span>
                      ) : "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-center">{l.invoiceCount as number}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ PAYROLL REPORT ============
function PayrollReport({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/payroll?from=${from}&to=${to}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { setData(json?.data ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [from, to]);

  if (loading) return <p className="text-gray-500 py-4">Loading...</p>;
  if (!data) return <p className="text-red-500">Failed to load</p>;

  const summary = data.summary as Record<string, number>;
  const records = data.records as Record<string, unknown>[];
  const pendingAdvances = data.pendingAdvances as Record<string, unknown>[];

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <div className="grid grid-cols-4 gap-4 flex-1">
          <Card><CardContent className="py-3 text-center">
            <p className="text-xl font-bold">Rs.{summary.totalNetPayable?.toFixed(0)}</p>
            <p className="text-xs text-gray-500">Total Payable</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 text-center">
            <p className="text-xl font-bold text-green-600">Rs.{summary.totalPaid?.toFixed(0)}</p>
            <p className="text-xs text-gray-500">Total Paid</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 text-center">
            <p className="text-xl font-bold text-red-600">Rs.{summary.totalPendingAdvances?.toFixed(0)}</p>
            <p className="text-xs text-gray-500">Pending Advances</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 text-center">
            <p className="text-xl font-bold">{summary.recordCount}</p>
            <p className="text-xs text-gray-500">Settlements</p>
          </CardContent></Card>
        </div>
        <Button variant="outline" size="sm" className="ml-4"
          onClick={() => window.open(`/api/reports/payroll?from=${from}&to=${to}&format=excel`)}>
          <Download className="mr-1 h-4 w-4" /> Excel
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Weekly Settlements</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-center">Days</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">On-Call</TableHead>
                <TableHead className="text-right">Advances</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r: Record<string, unknown>, i: number) => {
                const emp = r.employee as Record<string, string>;
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <p className="font-medium text-sm">{emp.name}</p>
                      <p className="text-xs text-gray-400">{emp.role}</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(r.periodStart as string).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      {" — "}
                      {new Date(r.periodEnd as string).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {r.presentDays as number}P {(r.halfDays as number) > 0 ? `${r.halfDays}H ` : ""}{(r.onCallDays as number) > 0 ? `${r.onCallDays}OC` : ""}
                    </TableCell>
                    <TableCell className="text-right">Rs.{Number(r.baseSalary).toFixed(0)}</TableCell>
                    <TableCell className="text-right">{Number(r.onCallAmount) > 0 ? `Rs.${Number(r.onCallAmount).toFixed(0)}` : "—"}</TableCell>
                    <TableCell className="text-right text-red-600">
                      {Number(r.totalAdvances) > 0 ? `-Rs.${Number(r.totalAdvances).toFixed(0)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">Rs.{Number(r.netPayable).toFixed(0)}</TableCell>
                    <TableCell><Badge variant={r.status === "PAID" ? "default" : "secondary"}>{r.status as string}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pendingAdvances.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Pending Advances</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingAdvances.map((a: Record<string, unknown>, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{(a.employee as Record<string, string>)?.name}</TableCell>
                    <TableCell className="text-sm">{new Date(a.date as string).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</TableCell>
                    <TableCell className="text-right font-medium">Rs.{Number(a.amount).toFixed(0)}</TableCell>
                    <TableCell className="text-sm text-gray-500">{(a.reason as string) ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ RETURNS REPORT ============
function ReturnsReport({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/returns?from=${from}&to=${to}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { setData(json?.data ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [from, to]);

  if (loading) return <p className="text-gray-500 py-4">Loading...</p>;
  if (!data) return <p className="text-red-500">Failed to load</p>;

  const cust = data.customer as {
    summary: Record<string, number>;
    productBreakdown: { name: string; sku: string; qty: number; refund: number; reasons: Record<string, number> }[];
    topReasons: { reason: string; qty: number }[];
  };
  const sup = data.supplier as {
    summary: Record<string, number>;
    productBreakdown: { name: string; sku: string; qty: number; cost: number; reasons: Record<string, number> }[];
  };

  return (
    <div className="space-y-6 mt-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm"
          onClick={() => window.open(`/api/reports/returns?from=${from}&to=${to}&format=excel`)}>
          <Download className="mr-1 h-4 w-4" /> Excel
        </Button>
      </div>

      {/* Customer Returns */}
      <h2 className="text-lg font-semibold">Customer Returns</h2>
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold">{cust.summary.totalReturns}</p>
          <p className="text-xs text-gray-500">Total Returns</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold text-green-600">{cust.summary.approved}</p>
          <p className="text-xs text-gray-500">Approved</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold text-amber-600">{cust.summary.pending}</p>
          <p className="text-xs text-gray-500">Pending</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold text-red-600">Rs.{cust.summary.totalRefund?.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Total Refunded</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Products returned by customers */}
        <Card>
          <CardHeader><CardTitle>Products Returned (Customer)</CardTitle></CardHeader>
          <CardContent className="p-0">
            {cust.productBreakdown.length === 0 ? (
              <p className="text-gray-400 text-center py-4 text-sm">No customer returns</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Refund</TableHead>
                    <TableHead>Top Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cust.productBreakdown.map((p, i) => {
                    const topReason = Object.entries(p.reasons).sort((a, b) => b[1] - a[1])[0];
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.sku}</p>
                        </TableCell>
                        <TableCell className="text-right">{p.qty}</TableCell>
                        <TableCell className="text-right">Rs.{p.refund.toFixed(0)}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{topReason?.[0] ?? "—"}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Return reasons breakdown */}
        <Card>
          <CardHeader><CardTitle>Return Reasons</CardTitle></CardHeader>
          <CardContent>
            {cust.topReasons.length === 0 ? (
              <p className="text-gray-400 text-center py-4 text-sm">No data</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={cust.topReasons} dataKey="qty" nameKey="reason" cx="50%" cy="50%" outerRadius={65}>
                      {cust.topReasons.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {cust.topReasons.map((r, i) => (
                    <div key={r.reason} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="flex-1">{r.reason}</span>
                      <span className="text-gray-500">{r.qty} items</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Supplier Returns */}
      <h2 className="text-lg font-semibold">Supplier Returns</h2>
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold">{sup.summary.totalReturns}</p>
          <p className="text-xs text-gray-500">Total Returns</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold">Rs.{sup.summary.totalAmount?.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Total Value</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold text-green-600">Rs.{sup.summary.creditReceived?.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Credit Received</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold text-amber-600">Rs.{sup.summary.pendingCredit?.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Pending Credit</p>
        </CardContent></Card>
      </div>

      {sup.productBreakdown.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Products Returned (Supplier)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Top Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sup.productBreakdown.map((p, i) => {
                  const topReason = Object.entries(p.reasons).sort((a, b) => b[1] - a[1])[0];
                  return (
                    <TableRow key={i}>
                      <TableCell>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.sku}</p>
                      </TableCell>
                      <TableCell className="text-right">{p.qty}</TableCell>
                      <TableCell className="text-right">Rs.{p.cost.toFixed(0)}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{topReason?.[0] ?? "—"}</Badge></TableCell>
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

// ============ GST REPORT ============
function GSTReport({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/gst?from=${from}&to=${to}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { setData(json?.data ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [from, to]);

  if (loading) return <p className="text-gray-500 py-4">Loading...</p>;
  if (!data) return <p className="text-red-500">Failed to load</p>;

  const summary = data.summary as Record<string, number>;
  const b2c = data.b2cSummary as { taxRate: number; taxableValue: number; cgst: number; sgst: number; igst: number; totalTax: number; invoiceCount: number }[];
  const hsn = data.hsnSummary as { hsnCode: string; description: string; qty: number; taxRate: number; taxableValue: number; cgst: number; sgst: number; igst: number; totalTax: number; totalValue: number }[];
  const invoices = data.invoiceDetails as { invoiceNumber: string; date: string; customer: string; taxableValue: number; cgst: number; sgst: number; igst: number; totalTax: number; grandTotal: number }[];

  return (
    <div className="space-y-6 mt-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {summary.totalInvoices === 0
            ? "No GST-enabled invoices in this period. Enable GST in Settings to start collecting tax."
            : `${summary.totalInvoices} GST invoices`}
        </p>
        <Button variant="outline" size="sm"
          onClick={() => window.open(`/api/reports/gst?from=${from}&to=${to}&format=excel`)}>
          <Download className="mr-1 h-4 w-4" /> Excel
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold">Rs.{summary.totalTaxableValue?.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Taxable Value</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold text-blue-600">Rs.{summary.totalCGST?.toFixed(0)}</p>
          <p className="text-xs text-gray-500">CGST</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold text-blue-600">Rs.{summary.totalSGST?.toFixed(0)}</p>
          <p className="text-xs text-gray-500">SGST</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold text-purple-600">Rs.{summary.totalIGST?.toFixed(0)}</p>
          <p className="text-xs text-gray-500">IGST</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-xl font-bold text-red-600">Rs.{summary.totalTax?.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Total Tax</p>
        </CardContent></Card>
      </div>

      {b2c.length > 0 && (
        <Card>
          <CardHeader><CardTitle>B2C Summary (GSTR-1 Table 7)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tax Rate (%)</TableHead>
                  <TableHead className="text-right">Taxable Value</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">IGST</TableHead>
                  <TableHead className="text-right">Total Tax</TableHead>
                  <TableHead className="text-center">Invoices</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {b2c.map((row) => (
                  <TableRow key={row.taxRate}>
                    <TableCell className="font-medium">{row.taxRate}%</TableCell>
                    <TableCell className="text-right">Rs.{row.taxableValue.toFixed(2)}</TableCell>
                    <TableCell className="text-right">Rs.{row.cgst.toFixed(2)}</TableCell>
                    <TableCell className="text-right">Rs.{row.sgst.toFixed(2)}</TableCell>
                    <TableCell className="text-right">Rs.{row.igst.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">Rs.{row.totalTax.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{row.invoiceCount}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-gray-50">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">Rs.{b2c.reduce((s, r) => s + r.taxableValue, 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">Rs.{b2c.reduce((s, r) => s + r.cgst, 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">Rs.{b2c.reduce((s, r) => s + r.sgst, 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">Rs.{b2c.reduce((s, r) => s + r.igst, 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">Rs.{b2c.reduce((s, r) => s + r.totalTax, 0).toFixed(2)}</TableCell>
                  <TableCell className="text-center">{summary.totalInvoices}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {hsn.length > 0 && (
        <Card>
          <CardHeader><CardTitle>HSN Summary (GSTR-1 Table 12)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>HSN Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-center">Rate (%)</TableHead>
                  <TableHead className="text-right">Taxable Value</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">Total Tax</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hsn.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.hsnCode}</TableCell>
                    <TableCell className="text-sm">{row.description}</TableCell>
                    <TableCell className="text-right">{row.qty}</TableCell>
                    <TableCell className="text-center">{row.taxRate}%</TableCell>
                    <TableCell className="text-right">Rs.{row.taxableValue.toFixed(2)}</TableCell>
                    <TableCell className="text-right">Rs.{row.cgst.toFixed(2)}</TableCell>
                    <TableCell className="text-right">Rs.{row.sgst.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">Rs.{row.totalTax.toFixed(2)}</TableCell>
                    <TableCell className="text-right">Rs.{row.totalValue.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {invoices.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Invoice Tax Details</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">Total Tax</TableHead>
                  <TableHead className="text-right">Grand Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-sm">{new Date(inv.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</TableCell>
                    <TableCell className="text-sm">{inv.customer}</TableCell>
                    <TableCell className="text-right">Rs.{inv.taxableValue.toFixed(2)}</TableCell>
                    <TableCell className="text-right">Rs.{inv.cgst.toFixed(2)}</TableCell>
                    <TableCell className="text-right">Rs.{inv.sgst.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">Rs.{inv.totalTax.toFixed(2)}</TableCell>
                    <TableCell className="text-right">Rs.{inv.grandTotal.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
