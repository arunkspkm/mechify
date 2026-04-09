/**
 * Generate a short SKU from product name + brand.
 * Takes first 3 chars of each word, uppercase, hyphen separated, max 16 chars.
 *
 * Examples:
 * - "Door Visor AStar Kartier" → "DOO-VIS-AST-KAR"
 * - "Indicator Bulb OSRAM" → "IND-BUL-OSR"
 * - "Speaker Cable 2.5mm Havells" → "SPE-CAB-2.5-HAV"
 * - "7D Mat Innova Protekt" → "7D-MAT-INN-PRO"
 */
export function generateSku(productName: string, brandName?: string): string {
  const parts = [productName, brandName].filter(Boolean).join(" ");

  // Split into words, take first 3 chars of each
  const words = parts
    .replace(/[^a-zA-Z0-9\s.]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.toUpperCase().slice(0, 3));

  // Join with hyphens, truncate to 16 chars
  let sku = words.join("-");
  if (sku.length > 16) {
    // Trim from the end, keeping whole segments
    const segments: string[] = [];
    let len = 0;
    for (const word of words) {
      const needed = segments.length > 0 ? word.length + 1 : word.length; // +1 for hyphen
      if (len + needed > 16) break;
      segments.push(word);
      len += needed;
    }
    sku = segments.join("-");
  }

  // Ensure not empty
  return sku || productName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
}
