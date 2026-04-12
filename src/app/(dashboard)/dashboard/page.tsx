"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  IndianRupee, ShoppingCart, TrendingUp, AlertTriangle,
  Package, Users, FileText, RotateCcw, ClipboardList, Wallet,
} from "lucide-react";

interface DashboardData {
  todaySales: number;
  weekSales: number;
  monthSales: number;
  todayInvoiceCount: number;
  monthInvoiceCount: number;
  monthExpenses: number;
  pendingPayables: number;
  pendingReceivables: number;
  pendingReturns: number;
  pendingWriteOffs: number;
  openEnquiries: number;
  totalCustomers: number;
  totalProducts: number;
  lowStockList: { id: string; name: string; sku: string; stock: number; threshold: number }[];
  topProductsList: { productId: string; name: string; totalQty: number; totalRevenue: number }[];
  recentInvoices: {
    id: string; invoiceNumber: string; grandTotal: string; date: string;
    customer: { name: string } | null;
  }[];
  salesChart: { date: string; label: string; total: number }[];
  supplierDueList?: {
    id: string;
    invoiceNumber: string;
    supplierName: string;
    outstanding: number;
    dueDate: string;
    daysLeft: number;
    isOverdue: boolean;
  }[];
  businessHealth?: {
    revenueGrowth: number;
    lastMonthRevenue: number;
    avgBillValue: number;
    lastAvgBill: number;
    grossMarginPct: number;
    discountPct: number;
    totalDiscounts: number;
    newCustomersThisMonth: number;
    returningCustomers: number;
    uniqueCustomersThisMonth: number;
    deadStockValue: number;
    deadStockCount: number;
    deadStockTop5: { name: string; stock: number; value: number }[];
    returnRate: number;
    monthReturns: number;
    enquiryConversion: number;
    monthEnquiries: number;
    convertedEnquiries: number;
    receivablesAging: { under30: number; under60: number; over60: number };
  };
}

const PIE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then((json) => { setData(json.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading dashboard...</p>;
  if (!data) return <p className="text-red-600">Failed to load dashboard</p>;

  const monthProfit = data.monthSales - data.monthExpenses;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-500">Business overview</p>
      </div>

      {/* Row 1: Sales KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <IndianRupee className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Rs.{data.todaySales.toFixed(0)}</p>
                <p className="text-xs text-gray-500">Today&apos;s Sales ({data.todayInvoiceCount} bills)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Rs.{data.weekSales.toFixed(0)}</p>
                <p className="text-xs text-gray-500">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Rs.{data.monthSales.toFixed(0)}</p>
                <p className="text-xs text-gray-500">This Month ({data.monthInvoiceCount} bills)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${monthProfit >= 0 ? "bg-green-100" : "bg-red-100"}`}>
                <Wallet className={`h-5 w-5 ${monthProfit >= 0 ? "text-green-600" : "text-red-600"}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${monthProfit >= 0 ? "" : "text-red-600"}`}>
                  Rs.{monthProfit.toFixed(0)}
                </p>
                <p className="text-xs text-gray-500">Month Profit (Sales − Expenses)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Payables/Receivables + Action items */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xl font-bold text-red-600">Rs.{data.pendingPayables.toFixed(0)}</p>
            <p className="text-xs text-gray-500">Supplier Payables</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xl font-bold text-amber-600">Rs.{data.pendingReceivables.toFixed(0)}</p>
            <p className="text-xs text-gray-500">Customer Receivables</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <Link href="/returns">
              <p className="text-xl font-bold">{data.pendingReturns}</p>
              <p className="text-xs text-gray-500">Pending Returns</p>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <Link href="/enquiries">
              <p className="text-xl font-bold">{data.openEnquiries}</p>
              <p className="text-xs text-gray-500">Open Enquiries</p>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xl font-bold">{data.totalProducts}</p>
            <p className="text-xs text-gray-500">Active Products</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Sales chart + Top products */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader><CardTitle>Daily Sales (Last 30 Days)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.salesChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value) => [`Rs.${Number(value).toFixed(0)}`, "Sales"]}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top Products (This Month)</CardTitle></CardHeader>
          <CardContent>
            {data.topProductsList.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No sales this month</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={data.topProductsList}
                      dataKey="totalRevenue"
                      nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={35} outerRadius={65}
                    >
                      {data.topProductsList.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `Rs.${Number(value).toFixed(0)}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {data.topProductsList.map((p, i) => (
                    <div key={p.productId} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-gray-500">Rs.{p.totalRevenue.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Low stock + Recent invoices */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.lowStockList.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">All products well stocked</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lowStockList.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/products/${p.id}`} className="text-blue-600 hover:underline text-sm">
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={p.stock === 0 ? "destructive" : "secondary"}>
                          {p.stock}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-500">{p.threshold}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Invoices</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link href={`/billing/invoices/${inv.id}`} className="text-blue-600 hover:underline text-sm">
                        {inv.invoiceNumber}
                      </Link>
                      <p className="text-[10px] text-gray-400">
                        {new Date(inv.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{inv.customer?.name ?? "Walk-in"}</TableCell>
                    <TableCell className="text-right font-medium">Rs.{Number(inv.grandTotal).toFixed(0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Payments Due */}
      {data.supplierDueList && data.supplierDueList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-amber-500" /> Supplier Payments Due
              <Badge variant="destructive" className="ml-auto">{data.supplierDueList.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.supplierDueList.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm font-medium">{item.supplierName}</TableCell>
                    <TableCell>
                      <Link href={`/purchase-invoices/${item.id}`} className="text-blue-600 hover:underline text-sm">
                        {item.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-medium">Rs.{item.outstanding.toFixed(0)}</TableCell>
                    <TableCell className="text-right">
                      {item.isOverdue ? (
                        <Badge variant="destructive" className="text-xs">
                          {Math.abs(item.daysLeft)}d overdue
                        </Badge>
                      ) : item.daysLeft === 0 ? (
                        <Badge variant="destructive" className="text-xs">Today</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                          {item.daysLeft}d left
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Business Health */}
      {data.businessHealth && (() => {
        const h = data.businessHealth;
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Business Health</h2>

            {/* Growth & Profitability */}
            <div className="grid grid-cols-5 gap-4">
              <Card>
                <CardContent className="py-4 text-center">
                  <p className={`text-2xl font-bold ${h.revenueGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {h.revenueGrowth > 0 ? "+" : ""}{h.revenueGrowth}%
                  </p>
                  <p className="text-xs text-gray-500">Revenue Growth</p>
                  <p className="text-[10px] text-gray-400">vs last month (Rs.{h.lastMonthRevenue.toFixed(0)})</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-bold">Rs.{h.avgBillValue}</p>
                  <p className="text-xs text-gray-500">Avg Bill Value</p>
                  {h.lastAvgBill > 0 && (
                    <p className={`text-[10px] ${h.avgBillValue >= h.lastAvgBill ? "text-green-500" : "text-red-500"}`}>
                      {h.avgBillValue >= h.lastAvgBill ? "↑" : "↓"} vs Rs.{h.lastAvgBill} last month
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className={`text-2xl font-bold ${h.grossMarginPct >= 30 ? "text-green-600" : h.grossMarginPct >= 20 ? "text-amber-600" : "text-red-600"}`}>
                    {h.grossMarginPct}%
                  </p>
                  <p className="text-xs text-gray-500">Gross Margin</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className={`text-2xl font-bold ${h.discountPct <= 5 ? "text-green-600" : h.discountPct <= 10 ? "text-amber-600" : "text-red-600"}`}>
                    {h.discountPct}%
                  </p>
                  <p className="text-xs text-gray-500">Discount Leakage</p>
                  <p className="text-[10px] text-gray-400">Rs.{h.totalDiscounts.toFixed(0)} this month</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className={`text-2xl font-bold ${h.returnRate <= 2 ? "text-green-600" : h.returnRate <= 5 ? "text-amber-600" : "text-red-600"}`}>
                    {h.returnRate}%
                  </p>
                  <p className="text-xs text-gray-500">Return Rate</p>
                  <p className="text-[10px] text-gray-400">{h.monthReturns} returns this month</p>
                </CardContent>
              </Card>
            </div>

            {/* Customers & Inventory */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="py-4 text-center">
                  <p className="text-2xl font-bold">{h.uniqueCustomersThisMonth}</p>
                  <p className="text-xs text-gray-500">Customers This Month</p>
                  <p className="text-[10px] text-gray-400">{h.newCustomersThisMonth} new · {h.returningCustomers} returning</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className={`text-2xl font-bold ${h.deadStockValue > 0 ? "text-red-600" : "text-green-600"}`}>
                    Rs.{h.deadStockValue.toFixed(0)}
                  </p>
                  <p className="text-xs text-gray-500">Dead Stock ({h.deadStockCount} items)</p>
                  <p className="text-[10px] text-gray-400">No sales in 60+ days</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center">
                  <p className={`text-2xl font-bold ${h.enquiryConversion >= 50 ? "text-green-600" : "text-amber-600"}`}>
                    {h.enquiryConversion}%
                  </p>
                  <p className="text-xs text-gray-500">Enquiry Conversion</p>
                  <p className="text-[10px] text-gray-400">{h.convertedEnquiries} of {h.monthEnquiries} converted</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs text-gray-500 mb-2">Receivables Aging</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">&lt; 30 days:</span>
                      <span>Rs.{h.receivablesAging.under30.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-600">30-60 days:</span>
                      <span className="text-amber-600">Rs.{h.receivablesAging.under60.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">&gt; 60 days:</span>
                      <span className="text-red-600 font-medium">Rs.{h.receivablesAging.over60.toFixed(0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Dead Stock Details */}
            {h.deadStockTop5.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Dead Stock — No Sales in 60+ Days</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {h.deadStockTop5.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm font-medium">{p.name}</TableCell>
                          <TableCell className="text-right">{p.stock}</TableCell>
                          <TableCell className="text-right text-red-600">Rs.{p.value.toFixed(0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })()}
    </div>
  );
}
