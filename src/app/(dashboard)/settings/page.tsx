"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, Database, Shield, Receipt } from "lucide-react";

interface Config {
  shopName: string;
  shopAddress: string | null;
  shopPhone: string | null;
  gstEnabled: boolean;
  gstNumber: string | null;
  loyaltyEnabled: boolean;
  loyaltyPointsPerRupee: string;
  loyaltyRedemptionValue: string;
  pointExpiryMonths: number;
  invoicePrefix: string;
  estimatePrefix: string;
  financialYearStartMonth: number;
  defaultDiscountMax: string;
  expiryAlertDays: number;
  defaultCreditLimit: string;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        setConfig(json.data);
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopName: config.shopName,
        shopAddress: config.shopAddress || null,
        shopPhone: config.shopPhone || null,
        gstEnabled: config.gstEnabled,
        gstNumber: config.gstNumber || null,
        loyaltyEnabled: config.loyaltyEnabled,
        loyaltyPointsPerRupee: Number(config.loyaltyPointsPerRupee),
        loyaltyRedemptionValue: Number(config.loyaltyRedemptionValue),
        pointExpiryMonths: config.pointExpiryMonths,
        invoicePrefix: config.invoicePrefix,
        estimatePrefix: config.estimatePrefix,
        financialYearStartMonth: config.financialYearStartMonth,
        defaultDiscountMax: Number(config.defaultDiscountMax),
        expiryAlertDays: config.expiryAlertDays,
        defaultCreditLimit: Number(config.defaultCreditLimit),
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to save");
      return;
    }

    toast.success("Settings saved");
  }

  function update(field: string, value: unknown) {
    setConfig((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  if (loading || !config) return <p className="text-gray-500">Loading settings...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Business configuration</p>
        </div>
        <div className="flex gap-2">
          <Link href="/settings/backup">
            <Button variant="outline" size="sm">
              <Database className="mr-1 h-4 w-4" /> Backup
            </Button>
          </Link>
          <Link href="/settings/bulk-tax-update">
            <Button variant="outline" size="sm">
              <Receipt className="mr-1 h-4 w-4" /> Bulk Tax Update
            </Button>
          </Link>
        </div>
      </div>

      {/* Shop Details */}
      <Card>
        <CardHeader><CardTitle>Shop Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Shop Name</Label>
            <Input value={config.shopName} onChange={(e) => update("shopName", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={config.shopAddress ?? ""} onChange={(e) => update("shopAddress", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={config.shopPhone ?? ""} onChange={(e) => update("shopPhone", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* GST */}
      <Card>
        <CardHeader><CardTitle>GST Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={config.gstEnabled} onCheckedChange={(v) => update("gstEnabled", v)} />
            <Label>Enable GST on invoices</Label>
          </div>
          <p className="text-xs text-gray-500">
            When enabled, CGST + SGST tax breakdowns appear on invoices based on product HSN codes.
          </p>
          {config.gstEnabled && (
            <div className="space-y-2">
              <Label>GST Number</Label>
              <Input value={config.gstNumber ?? ""} onChange={(e) => update("gstNumber", e.target.value)} placeholder="e.g., 29AABCU9603R1ZM" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loyalty Program */}
      <Card>
        <CardHeader><CardTitle>Loyalty Program</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={config.loyaltyEnabled} onCheckedChange={(v) => update("loyaltyEnabled", v)} />
            <Label>Enable Loyalty Points</Label>
          </div>
          <p className="text-xs text-gray-500">
            Customers earn points on every purchase. Points can be redeemed as discount at POS.
          </p>
          {config.loyaltyEnabled && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Points Per Rupee</Label>
                <Input type="number" min="0" step="0.001" value={config.loyaltyPointsPerRupee}
                  onChange={(e) => update("loyaltyPointsPerRupee", e.target.value)} />
                <p className="text-xs text-gray-500">e.g., 0.01 = 1 pt per Rs.100</p>
              </div>
              <div className="space-y-2">
                <Label>Redemption Value (Rs/pt)</Label>
                <Input type="number" min="0" step="0.1" value={config.loyaltyRedemptionValue}
                  onChange={(e) => update("loyaltyRedemptionValue", e.target.value)} />
                <p className="text-xs text-gray-500">e.g., 1 = 1 pt = Rs.1 off</p>
              </div>
              <div className="space-y-2">
                <Label>Point Expiry (months)</Label>
                <Input type="number" min="0" value={config.pointExpiryMonths}
                  onChange={(e) => update("pointExpiryMonths", Number(e.target.value))} />
                <p className="text-xs text-gray-500">0 = never expire</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Settings */}
      <Card>
        <CardHeader><CardTitle>Invoice & Estimate</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Invoice Prefix</Label>
            <Input value={config.invoicePrefix} onChange={(e) => update("invoicePrefix", e.target.value)} />
            <p className="text-xs text-gray-500">e.g., MEC → MEC/2026-27/0001</p>
          </div>
          <div className="space-y-2">
            <Label>Estimate Prefix</Label>
            <Input value={config.estimatePrefix} onChange={(e) => update("estimatePrefix", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Financial Year Start Month</Label>
            <Input type="number" min="1" max="12" value={config.financialYearStartMonth} onChange={(e) => update("financialYearStartMonth", Number(e.target.value))} />
            <p className="text-xs text-gray-500">4 = April (Indian FY)</p>
          </div>
        </CardContent>
      </Card>

      {/* Business Rules */}
      <Card>
        <CardHeader><CardTitle>Business Rules</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Max Discount % (default)</Label>
            <Input type="number" min="0" max="100" value={config.defaultDiscountMax} onChange={(e) => update("defaultDiscountMax", e.target.value)} />
            <p className="text-xs text-gray-500">Counter operators can&apos;t exceed this without owner approval</p>
          </div>
          <div className="space-y-2">
            <Label>Expiry Alert Days</Label>
            <Input type="number" min="1" value={config.expiryAlertDays} onChange={(e) => update("expiryAlertDays", Number(e.target.value))} />
            <p className="text-xs text-gray-500">Alert when products expire within these days</p>
          </div>
          <div className="space-y-2">
            <Label>Default Credit Limit (Rs.)</Label>
            <Input type="number" min="0" value={config.defaultCreditLimit} onChange={(e) => update("defaultCreditLimit", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="mr-1 h-4 w-4" />
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
