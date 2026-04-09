/**
 * Role hierarchy: OWNER > MANAGER > COUNTER_OPERATOR
 *
 * OWNER: Full access to everything
 * MANAGER: Counter access + attendance, employees, advances, expenses, reports, return approval
 * COUNTER_OPERATOR: Billing, invoices, estimates, shifts, customers, enquiries, returns (create only)
 */

export function isOwner(role: string): boolean {
  return role === "OWNER";
}

export function isManagerOrAbove(role: string): boolean {
  return role === "OWNER" || role === "MANAGER";
}

export function isAuthenticated(role: string): boolean {
  return role === "OWNER" || role === "MANAGER" || role === "COUNTER_OPERATOR";
}
