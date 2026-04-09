/**
 * Safe fetch wrapper that handles errors consistently.
 * Returns { data, error } to avoid uncaught JSON parse errors.
 */
export async function fetchJson<T = Record<string, unknown>>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      return { data: null, error: err.error ?? `HTTP ${res.status}` };
    }
    const json = await res.json();
    return { data: json as T, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

/**
 * POST/PATCH helper with JSON body
 */
export async function postJson<T = Record<string, unknown>>(
  url: string,
  body: unknown,
  method: "POST" | "PATCH" | "DELETE" = "POST"
): Promise<{ data: T | null; error: string | null }> {
  return fetchJson<T>(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
