import { z } from "zod";

/**
 * Format Zod validation errors into a human-readable string.
 * Shows the first error for each field.
 */
export function formatValidationError(error: z.ZodError): string {
  const flat = error.flatten();
  const messages: string[] = [];

  // Field-level errors
  const fieldErrors = flat.fieldErrors as Record<string, string[] | undefined>;
  for (const [field, errs] of Object.entries(fieldErrors)) {
    if (errs && errs.length > 0) {
      messages.push(`${field}: ${errs[0]}`);
    }
  }

  // Form-level errors
  if (flat.formErrors && flat.formErrors.length > 0) {
    messages.push(...flat.formErrors);
  }

  return messages.length > 0 ? messages.join(". ") : "Validation failed";
}
