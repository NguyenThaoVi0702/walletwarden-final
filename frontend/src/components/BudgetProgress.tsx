import { budgetLevel, usagePct, type BudgetLevel } from "../lib/budget";
import { formatVND } from "../lib/format";
import { categoryIcon } from "../lib/categoryIcon";

const BAR: Record<BudgetLevel, string> = {
  ok: "bg-green",
  warning: "bg-warning",
  over: "bg-danger",
};

/** Thanh tiến độ ngân sách. Trạng thái luôn có chữ đi kèm, không chỉ dựa vào màu. */
export function BudgetProgress({
  label,
  spent,
  limit,
  icon,
  color,
  pct: serverPct,
}: {
  label: string;
  spent: number;
  limit: number;
  icon?: string;
  /** Màu danh mục: thanh tô màu danh mục, trạng thái (sắp chạm / vượt) đọc qua chữ và icon. */
  color?: string;
  /** `usage_pct` backend đã tính; không có thì tự tính từ spent/limit. */
  pct?: number;
}) {
  const pct = serverPct ?? usagePct(spent, limit);
  const level = budgetLevel(pct);
  const remaining = limit - spent;

  return (
    <div data-level={level}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate font-medium">
          {icon !== undefined && <span aria-hidden>{categoryIcon(icon)} </span>}
          {label}
        </span>
        <span className="shrink-0 tabular-nums text-navy/70">
          {formatVND(spent)} / {formatVND(limit)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Ngân sách ${label}`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${pct}%`}
        className="h-2.5 overflow-hidden rounded-full bg-navy-50"
      >
        <div
          className={`h-full rounded-full transition-all ${color ? "" : BAR[level]}`}
          style={{
            width: `${Math.min(pct, 100)}%`,
            ...(color ? { backgroundColor: color } : {}),
          }}
        />
      </div>
      <p
        className={`mt-1 text-xs ${level === "over" ? "font-semibold text-danger" : "text-navy/60"}`}
      >
        {level === "over"
          ? `⛔ Vượt ${formatVND(-remaining)} (${pct}%)`
          : level === "warning"
            ? `⚠️ Sắp chạm hạn mức · còn ${formatVND(remaining)} (${pct}%)`
            : `Còn ${formatVND(remaining)} (${pct}%)`}
      </p>
    </div>
  );
}
