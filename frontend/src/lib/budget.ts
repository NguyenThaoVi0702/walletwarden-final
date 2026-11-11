export type BudgetLevel = "ok" | "warning" | "over";

/** Rounded percentage used; 0 when there is no limit. */
export function usagePct(spent: number, limit: number): number {
  return limit > 0 ? Math.round((spent / limit) * 100) : 0;
}

/** Below 80%: ok (green) · from 80%: warning (yellow) · from 100%: over (red). */
export function budgetLevel(pct: number): BudgetLevel {
  if (pct >= 100) return "over";
  if (pct >= 80) return "warning";
  return "ok";
}
