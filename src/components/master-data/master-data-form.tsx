"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AsyncSelect } from "@/components/shared/async-select";
import { MasterDataType } from "@prisma/client";
import {
  MasterDataItem,
  METADATA_FIELDS,
  HIERARCHICAL_TYPES,
} from "@/types/master-data";

interface MasterDataFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: MasterDataType;
  editItem?: MasterDataItem | null;
  parentOptions?: MasterDataItem[];
  onSave: () => void;
}

export function MasterDataForm({
  open,
  onOpenChange,
  type,
  editItem,
  parentOptions,
  onSave,
}: MasterDataFormProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const metadataFields = METADATA_FIELDS[type] ?? [];
  const parentType = HIERARCHICAL_TYPES[type];

  useEffect(() => {
    if (editItem) {
      setName(editItem.name);
      setCode(editItem.code ?? "");
      setParentId(editItem.parentId ?? "");
      const meta: Record<string, string> = {};
      for (const field of metadataFields) {
        meta[field.key] = String(
          (editItem.metadata as Record<string, unknown>)?.[field.key] ?? ""
        );
      }
      setMetadata(meta);
    } else {
      setName("");
      setCode("");
      setParentId("");
      setMetadata({});
    }
    setError("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editItem, open, type]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const metaObj: Record<string, unknown> = {};
    for (const field of metadataFields) {
      if (metadata[field.key]) {
        metaObj[field.key] =
          field.type === "number" ? Number(metadata[field.key]) : metadata[field.key];
      }
    }

    const body = editItem
      ? {
          id: editItem.id,
          name,
          code: code || null,
          parentId: parentId || null,
          metadata: Object.keys(metaObj).length > 0 ? metaObj : null,
        }
      : {
          type,
          name,
          code: code || null,
          parentId: parentId || null,
          metadata: Object.keys(metaObj).length > 0 ? metaObj : null,
        };

    const res = await fetch("/api/master-data", {
      method: editItem ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to save");
      return;
    }

    onSave();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editItem ? "Edit" : "Add"} Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Code (optional)</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g., pcs, mtr"
            />
          </div>

          {parentType && parentOptions && (
            <div className="space-y-2">
              <Label>
                Parent ({parentType.replace("_", " ").toLowerCase()})
              </Label>
              <AsyncSelect
                value={parentId}
                onValueChange={setParentId}
                options={(parentOptions ?? []).map((item) => ({ id: item.id, name: item.name }))}
                placeholder="Select parent..."
              />
            </div>
          )}

          {metadataFields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                type="number"
                value={metadata[field.key] ?? ""}
                onChange={(e) =>
                  setMetadata((prev) => ({
                    ...prev,
                    [field.key]: e.target.value,
                  }))
                }
              />
            </div>
          ))}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
