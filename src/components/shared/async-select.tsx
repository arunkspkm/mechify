"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Option {
  id: string;
  name: string;
  code?: string | null;
  extra?: string;
}

interface AsyncSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  showCode?: boolean;
}

/**
 * A Select that shows the correct display name even when options
 * are loaded asynchronously. Falls back to placeholder while loading.
 */
export function AsyncSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  className,
  showCode = false,
}: AsyncSelectProps) {
  // Find the display label for the current value
  const selectedOption = options.find((o) => o.id === value);
  const displayLabel = selectedOption
    ? `${selectedOption.name}${showCode && selectedOption.code ? ` (${selectedOption.code})` : ""}${selectedOption.extra ? ` ${selectedOption.extra}` : ""}`
    : "";

  return (
    <Select value={value} onValueChange={(v) => onValueChange(v ?? "")}>
      <SelectTrigger className={className}>
        {value && displayLabel ? (
          <span className="truncate">{displayLabel}</span>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {[...options].sort((a, b) => a.name.localeCompare(b.name)).map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
            {showCode && o.code ? ` (${o.code})` : ""}
            {o.extra ? ` ${o.extra}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
