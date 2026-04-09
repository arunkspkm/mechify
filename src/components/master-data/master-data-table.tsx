"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { MasterDataType } from "@prisma/client";
import {
  MasterDataItem,
  METADATA_FIELDS,
  HIERARCHICAL_TYPES,
} from "@/types/master-data";
import { MasterDataForm } from "./master-data-form";
import { Pencil, Plus, Search } from "lucide-react";

interface MasterDataTableProps {
  type: MasterDataType;
}

export function MasterDataTable({ type }: MasterDataTableProps) {
  const [items, setItems] = useState<MasterDataItem[]>([]);
  const [parentOptions, setParentOptions] = useState<MasterDataItem[]>([]);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<MasterDataItem | null>(null);
  const [loading, setLoading] = useState(true);

  const parentType = HIERARCHICAL_TYPES[type];
  const metadataFields = METADATA_FIELDS[type] ?? [];

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ type });
    if (showInactive) params.set("includeInactive", "true");
    if (search) params.set("search", search);

    const res = await fetch(`/api/master-data?${params}`);
    const json = await res.json();
    setItems(json.data ?? []);
    setLoading(false);
  }, [type, showInactive, search]);

  const fetchParentOptions = useCallback(async () => {
    if (!parentType) return;
    const res = await fetch(`/api/master-data?type=${parentType}`);
    const json = await res.json();
    setParentOptions(json.data ?? []);
  }, [parentType]);

  useEffect(() => {
    fetchData();
    fetchParentOptions();
  }, [fetchData, fetchParentOptions]);

  async function toggleActive(item: MasterDataItem) {
    await fetch("/api/master-data", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, active: !item.active }),
    });
    fetchData();
  }

  function handleEdit(item: MasterDataItem) {
    setEditItem(item);
    setFormOpen(true);
  }

  function handleAdd() {
    setEditItem(null);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            Show inactive
          </label>
          <Button onClick={handleAdd} size="sm">
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {metadataFields.length > 0 && (
                <TableHead>
                  {metadataFields.map((f) => f.label).join(", ")}
                </TableHead>
              )}
              {parentType && <TableHead>Parent</TableHead>}
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                  No entries found. Click &quot;Add&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} className={!item.active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  {metadataFields.length > 0 && (
                    <TableCell>
                      {metadataFields
                        .map(
                          (f) =>
                            (item.metadata as Record<string, unknown>)?.[f.key] ?? "—"
                        )
                        .join(", ")}
                    </TableCell>
                  )}
                  {parentType && (
                    <TableCell>{item.parent?.name ?? "—"}</TableCell>
                  )}
                  <TableCell className="text-gray-500">
                    {item.code ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.active ? "default" : "secondary"}>
                      {item.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={item.active}
                        onCheckedChange={() => toggleActive(item)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Form Dialog */}
      <MasterDataForm
        open={formOpen}
        onOpenChange={setFormOpen}
        type={type}
        editItem={editItem}
        parentOptions={parentOptions}
        onSave={fetchData}
      />
    </div>
  );
}
