"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

interface AutocompleteOption {
  id: string;
  name: string;
}

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  fetchUrl: string;
  placeholder?: string;
  id?: string;
}

/**
 * Text input with autocomplete dropdown from an API.
 * User can pick a suggestion or type a new value.
 */
export function AutocompleteInput({
  value,
  onChange,
  fetchUrl,
  placeholder,
  id,
}: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<AutocompleteOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions on input change
  useEffect(() => {
    if (value.length < 1) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${fetchUrl}?q=${encodeURIComponent(value)}&limit=8`);
        const json = await res.json();
        setSuggestions(json.data ?? []);
        setShowDropdown(true);
        setHighlightIndex(-1);
      } catch {
        setSuggestions([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [value, fetchUrl]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(name: string) {
    onChange(name);
    setShowDropdown(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightIndex].name);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => value.length > 0 && suggestions.length > 0 && setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                i === highlightIndex ? "bg-blue-50 text-blue-900" : "hover:bg-gray-50"
              }`}
              onMouseDown={() => handleSelect(s.name)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
