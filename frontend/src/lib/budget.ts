export type BudgetLevel = "ok" | "warning" | "over";

/** % đã dùng, làm tròn. Không có hạn mức → 0. */
export function usagePct(spent: number, limit: number): number {
  return limit > 0 ? Math.round((spent / limit) * 100) : 0;
}

/** Dưới 80%: ok (xanh lá) · từ 80%: warning (vàng) · từ 100%: over (đỏ). */
export function budgetLevel(pct: number): BudgetLevel {
  if (pct >= 100) return "over";
  if (pct >= 80) return "warning";
  return "ok";
}
