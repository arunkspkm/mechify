"use client";

import { useEffect, useRef } from "react";

/**
 * Detects barcode scanner input — rapid keystrokes ending with Enter.
 * Barcode scanners type characters very fast (< 50ms between keys).
 */
export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;

      if (e.key === "Enter" && bufferRef.current.length >= 3) {
        // Barcode complete
        onScan(bufferRef.current);
        bufferRef.current = "";
        e.preventDefault();
      } else if (timeDiff > 100) {
        // Too slow — reset buffer (human typing)
        bufferRef.current = e.key.length === 1 ? e.key : "";
      } else {
        // Fast input — likely scanner
        if (e.key.length === 1) {
          bufferRef.current += e.key;
        }
      }

      lastKeyTimeRef.current = now;
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onScan]);
}
