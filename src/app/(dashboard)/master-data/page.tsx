"use client";

import { useState } from "react";
import { MasterDataType } from "@prisma/client";
import { MASTER_DATA_TYPE_LABELS } from "@/types/master-data";
import { MasterDataTable } from "@/components/master-data/master-data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const types = Object.entries(MASTER_DATA_TYPE_LABELS) as [
  MasterDataType,
  string,
][];

export default function MasterDataPage() {
  const [selectedType, setSelectedType] = useState<MasterDataType>("CATEGORY");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Master Data</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage categories, units, brands, vehicle makes/models, and more
        </p>
      </div>

      <div className="max-w-xs">
        <Select
          value={selectedType}
          onValueChange={(v) => setSelectedType(v as MasterDataType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {types.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <MasterDataTable key={selectedType} type={selectedType} />
    </div>
  );
}
