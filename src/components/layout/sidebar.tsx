"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  Database,
  Package,
  Warehouse,
  ShoppingCart,
  FileText,
  Clock,
  Users,
  Settings,
  LogOut,
  UserCircle,
  Receipt,
  Truck,
  FileInput,
  ClipboardList,
  ShoppingBag,
  RotateCcw,
  HardHat,
  CalendarCheck,
  Wallet,
  BarChart3,
  Tag,
  Bell,
} from "lucide-react";

const ownerNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Master Data", href: "/master-data", icon: Database },
  { label: "Products", href: "/products", icon: Package },
  { label: "Inventory", href: "/inventory", icon: Warehouse },
  { label: "Suppliers", href: "/suppliers", icon: Truck },
  { label: "PO Orders", href: "/purchase-orders", icon: ShoppingBag },
  { label: "Purchases", href: "/purchase-invoices", icon: FileInput },
  { label: "Billing", href: "/billing", icon: ShoppingCart },
  { label: "Invoices", href: "/billing/invoices", icon: Receipt },
  { label: "Price Labels", href: "/billing/price-labels", icon: Tag },
  { label: "Estimates", href: "/estimates", icon: FileText },
  { label: "Enquiries", href: "/enquiries", icon: ClipboardList },
  { label: "Returns", href: "/returns", icon: RotateCcw },
  { label: "Shifts", href: "/shifts", icon: Clock },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Employees", href: "/employees", icon: HardHat },
  { label: "Attendance", href: "/attendance", icon: CalendarCheck },
  { label: "Expenses", href: "/expenses", icon: Wallet },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Users", href: "/users", icon: UserCircle },
];

const operatorNavItems = [
  { label: "Billing", href: "/billing", icon: ShoppingCart },
  { label: "Invoices", href: "/billing/invoices", icon: Receipt },
  { label: "Estimates", href: "/estimates", icon: FileText },
  { label: "Enquiries", href: "/enquiries", icon: ClipboardList },
  { label: "Returns", href: "/returns", icon: RotateCcw },
  { label: "Shifts", href: "/shifts", icon: Clock },
  { label: "Customers", href: "/customers", icon: Users },
];

const managerNavItems = [
  ...operatorNavItems,
  { label: "Employees", href: "/employees", icon: HardHat },
  { label: "Attendance", href: "/attendance", icon: CalendarCheck },
  { label: "Expenses", href: "/expenses", icon: Wallet },
  { label: "Reports", href: "/reports", icon: BarChart3 },
];

interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // Poll for notifications every 30 seconds
  useEffect(() => {
    if (!session?.user?.id) return;
    function fetchNotifications() {
      fetch("/api/notifications")
        .then((r) => r.ok ? r.json() : null)
        .then((json) => {
          if (json) {
            setNotifications(json.data ?? []);
            setUnreadCount(json.unreadCount ?? 0);
          }
        })
        .catch(() => {});
    }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  // Close panel on outside click
  useEffect(() => {
    if (!bellOpen) return;
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [bellOpen]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markAllRead" }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markRead", notificationId: id }),
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  const role = session?.user?.role;
  const navItems = role === "OWNER" ? ownerNavItems : role === "MANAGER" ? managerNavItems : operatorNavItems;

  return (
    <div className="flex h-full w-64 flex-col border-r bg-white overflow-visible">
      {/* Logo + Notifications */}
      <div className="flex h-16 items-center justify-between border-b px-6">
        <Link href="/" className="text-xl font-bold text-gray-900">
          Mechify
        </Link>
        <div ref={bellRef} className="relative">
          <button type="button" onClick={() => setBellOpen(!bellOpen)} className="relative p-1 text-gray-500 hover:text-gray-900">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute left-0 top-10 w-80 bg-white border rounded-lg shadow-xl z-[9999] max-h-96 overflow-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-sm font-semibold text-gray-900">Notifications</span>
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No notifications</p>
              ) : (
                notifications.slice(0, 15).map((n) => (
                  <div key={n.id}
                    className={`px-4 py-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${!n.read ? "bg-blue-50" : ""}`}
                    onClick={() => {
                      markRead(n.id);
                      setBellOpen(false);
                      if (n.link) window.location.href = n.link;
                    }}>
                    <p className={`text-sm leading-snug ${!n.read ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>{n.title}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-snug">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(n.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User info + logout */}
      <div className="border-t p-4">
        <div className="mb-2 text-sm">
          <p className="font-medium text-gray-900">{session?.user?.name}</p>
          <p className="text-xs text-gray-500">
            {role === "OWNER" ? "Owner" : role === "MANAGER" ? "Manager" : "Counter Operator"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-600"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
