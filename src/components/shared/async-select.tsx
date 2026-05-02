"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
  allowClear?: boolean;
}

/**
 * A searchable Select that shows the correct display name and supports
 * typing-to-filter. Falls back to placeholder while options are loading.
 */
export function AsyncSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  className,
  showCode = false,
  allowClear = false,
}: AsyncSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.id === value);
  const displayLabel = selectedOption
    ? `${selectedOption.name}${showCode && selectedOption.code ? ` (${selectedOption.code})` : ""}${selectedOption.extra ? ` ${selectedOption.extra}` : ""}`
    : "";

  // Filter + sort options by search term
  const filteredOptions = [...options]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((o) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return o.name.toLowerCase().includes(q) || (o.code?.toLowerCase().includes(q) ?? false);
    });

  // Click outside handler
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  function selectOption(opt: Option) {
    onValueChange(opt.id);
    setOpen(false);
    setSearch("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filteredOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filteredOptions[highlight];
      if (opt) selectOption(opt);
    } else if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-1 pr-2 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          !selectedOption && "text-muted-foreground"
        )}
      >
        <span className="truncate text-left flex-1">
          {selectedOption ? displayLabel : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {allowClear && selectedOption && (
            <span
              role="button"
              tabIndex={-1}
              className="text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onValueChange(""); }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md">
          <div className="p-1.5 border-b">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setHighlight(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Type to search..."
              className="w-full h-7 px-2 text-sm outline-none bg-transparent"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-2 px-2 text-sm text-muted-foreground">No options found</div>
            ) : (
              filteredOptions.map((o, idx) => (
                <button
                  key={o.id}
                  type="button"
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => selectOption(o)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md py-1 px-2 text-sm text-left",
                    idx === highlight ? "bg-accent text-accent-foreground" : "",
                    o.id === value ? "font-medium" : ""
                  )}
                >
                  <span className="truncate">
                    {o.name}
                    {showCode && o.code ? ` (${o.code})` : ""}
                    {o.extra ? ` ${o.extra}` : ""}
                  </span>
                  {o.id === value && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
