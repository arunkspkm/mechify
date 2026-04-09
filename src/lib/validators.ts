import { z } from "zod";

/**
 * Indian mobile number validation.
 * Accepts: 10-digit numbers starting with 6-9, optionally prefixed with +91 or 0.
 * Examples: 9876543210, +919876543210, 09876543210
 */
export const indianPhoneSchema = z
  .string()
  .transform((val) => {
    // Strip spaces, dashes, and common prefixes
    let cleaned = val.replace(/[\s-]/g, "");
    if (cleaned.startsWith("+91")) cleaned = cleaned.slice(3);
    if (cleaned.startsWith("91") && cleaned.length === 12) cleaned = cleaned.slice(2);
    if (cleaned.startsWith("0") && cleaned.length === 11) cleaned = cleaned.slice(1);
    return cleaned;
  })
  .refine((val) => /^[6-9]\d{9}$/.test(val), {
    message: "Invalid mobile number. Enter a 10-digit Indian mobile number.",
  });

/**
 * Optional phone — allows empty/null, validates if provided.
 */
export const optionalPhoneSchema = z
  .string()
  .optional()
  .nullable()
  .transform((val) => {
    if (!val || val.trim() === "") return null;
    // Strip spaces, dashes, and common prefixes
    let cleaned = val.replace(/[\s-]/g, "");
    if (cleaned.startsWith("+91")) cleaned = cleaned.slice(3);
    if (cleaned.startsWith("91") && cleaned.length === 12) cleaned = cleaned.slice(2);
    if (cleaned.startsWith("0") && cleaned.length === 11) cleaned = cleaned.slice(1);
    return cleaned;
  })
  .refine((val) => val === null || /^[6-9]\d{9}$/.test(val), {
    message: "Invalid mobile number. Enter a 10-digit Indian mobile number.",
  });
