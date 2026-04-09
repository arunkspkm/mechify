"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Download, Database, RefreshCw } from "lucide-react";

interface Backup {
  name: string;
  size: number;
  sizeHuman: string;
  createdAt: string;
}

export default function BackupPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function fetchBackups() {
    setLoading(true);
    const res = await fetch("/api/backup");
    const json = await res.json();
    setBackups(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchBackups();
  }, []);

  async function handleCreateBackup() {
    setCreating(true);
    const res = await fetch("/api/backup", { method: "POST" });
    setCreating(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Backup failed");
      return;
    }

    toast.success("Backup created successfully");
    fetchBackups();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/settings" className="text-sm text-blue-600 flex items-center gap-1 mb-1">
          <ArrowLeft className="h-3 w-3" /> Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Database Backup</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create and manage database backups
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Backup Now</CardTitle>
            <Button onClick={handleCreateBackup} disabled={creating}>
              <Database className="mr-1 h-4 w-4" />
              {creating ? "Creating..." : "Create Backup"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Creates a full database backup (PostgreSQL dump). Store backups safely — they contain all your business data.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Backup History</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchBackups}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500 py-4">Loading...</p>
          ) : backups.length === 0 ? (
            <p className="text-gray-500 py-4">No backups found. Create your first backup above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((b) => (
                  <TableRow key={b.name}>
                    <TableCell className="font-medium text-sm">{b.name}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(b.createdAt).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{b.sizeHuman}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
