"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  parseExcelFile,
  autoDetectMappings,
  validateImportData,
  SYSTEM_FIELDS,
  type ExcelRow,
  type ColumnMapping,
} from "@/lib/excel-import";
import { toast } from "sonner";
import { Upload, ArrowRight, Check, AlertCircle, Download } from "lucide-react";

type Step = "upload" | "mapping" | "preview" | "result";

export default function ImportProductsPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    total: number;
    errors: { row: number; name: string; error: string }[];
  } | null>(null);

  // Step 1: Upload
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const parsed = parseExcelFile(buffer);

    if (parsed.rows.length === 0) {
      toast.error("The Excel file appears to be empty");
      return;
    }

    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMappings(autoDetectMappings(parsed.headers));
    setStep("mapping");
  }

  // Step 2: Update mapping
  function updateMapping(excelColumn: string, systemField: string) {
    setMappings((prev) =>
      prev.map((m) =>
        m.excelColumn === excelColumn ? { ...m, systemField } : m
      )
    );
  }

  // Step 3: Build preview data
  function getMappedProducts() {
    return rows.map((row) => {
      const product: Record<string, unknown> = {};
      for (const mapping of mappings) {
        if (mapping.systemField) {
          product[mapping.systemField] = row[mapping.excelColumn];
        }
      }
      return product;
    });
  }

  // Step 4: Import
  async function handleImport() {
    setImporting(true);

    const products = getMappedProducts();
    const res = await fetch("/api/products/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products }),
    });

    const json = await res.json();
    setImporting(false);

    if (!res.ok) {
      toast.error(json.error || "Import failed");
      return;
    }

    setResult(json.data);
    setStep("result");
    toast.success(`Imported ${json.data.imported} products`);
  }

  const validationErrors = step === "preview" ? validateImportData(rows, mappings) : [];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Products from Excel</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload your existing inventory Excel file to import products
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "mapping", "preview", "result"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="h-4 w-4 text-gray-300" />}
            <Badge variant={step === s ? "default" : "secondary"}>
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </Badge>
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Excel File</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => window.open("/api/products/import-template")}>
                <Download className="mr-1 h-4 w-4" /> Download Template
              </Button>
            </div>
            <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 cursor-pointer hover:border-gray-400 transition-colors">
              <Upload className="h-10 w-10 text-gray-400 mb-3" />
              <p className="text-sm text-gray-600">Click to select an Excel file (.xlsx, .xls)</p>
              <p className="text-xs text-gray-400 mt-1">
                Columns: name, category, sellingPrice, stock, unitPrice, brand, distributor, unit, bundleSize, mrp, hsnCode
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === "mapping" && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
            <p className="text-sm text-gray-500">
              Match your Excel columns to system fields. Auto-detected mappings are pre-selected.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Excel Column</TableHead>
                  <TableHead>Sample Data</TableHead>
                  <TableHead>Map To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {headers.map((header) => {
                  const mapping = mappings.find((m) => m.excelColumn === header);
                  const sampleValue = rows[0]?.[header];
                  return (
                    <TableRow key={header}>
                      <TableCell className="font-medium">{header}</TableCell>
                      <TableCell className="text-gray-500 text-sm max-w-48 truncate">
                        {String(sampleValue ?? "—")}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping?.systemField ?? ""}
                          onValueChange={(v) => updateMapping(header, v ?? "")}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Skip this column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Skip</SelectItem>
                            {SYSTEM_FIELDS.map((f) => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label} {f.required ? "*" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex gap-2">
              <Button onClick={() => setStep("preview")}>
                Next: Preview
              </Button>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Import ({rows.length} products)</CardTitle>
            {validationErrors.length > 0 && (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                {validationErrors.length} validation warnings
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-96 overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    {mappings
                      .filter((m) => m.systemField)
                      .map((m) => (
                        <TableHead key={m.excelColumn}>
                          {SYSTEM_FIELDS.find((f) => f.key === m.systemField)?.label ?? m.systemField}
                        </TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-gray-400">{i + 1}</TableCell>
                      {mappings
                        .filter((m) => m.systemField)
                        .map((m) => (
                          <TableCell key={m.excelColumn} className="text-sm">
                            {String(row[m.excelColumn] ?? "—")}
                          </TableCell>
                        ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {rows.length > 50 && (
              <p className="text-xs text-gray-500">
                Showing first 50 of {rows.length} rows
              </p>
            )}

            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importing..." : `Import ${rows.length} Products`}
              </Button>
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Result */}
      {step === "result" && result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-700">{result.imported}</p>
                <p className="text-sm text-green-600">Imported</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
                <p className="text-sm text-amber-600">Skipped</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-700">{result.total}</p>
                <p className="text-sm text-gray-600">Total</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="border rounded-md max-h-48 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.errors.map((err, i) => (
                      <TableRow key={i}>
                        <TableCell>{err.row}</TableCell>
                        <TableCell>{err.name}</TableCell>
                        <TableCell className="text-red-600 text-sm">{err.error}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <Button onClick={() => router.push("/products")}>
              View Products
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
