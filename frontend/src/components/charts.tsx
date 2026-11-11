import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { Category, CategoryAmount, DailyAmount } from "../api/types";
import { categoryColor, OTHER_COLOR } from "../lib/categoryColor";
import { categoryIcon } from "../lib/categoryIcon";
import { formatCompactVND, formatDate, formatVND } from "../lib/format";

// Data color is the category color chosen by the user. A light grid and axes keep the data prominent;
// a 2px white border separates slices and stacked segments.
const GRID_COLOR = "rgba(14, 47, 81, 0.08)";
const TICK = { fill: "rgba(14, 47, 81, 0.6)", fontSize: 12 };
const GAP = "#ffffff";
/** At most 7 categories get their own color; the rest are grouped as "Còn lại" (gray). */
const MAX_SERIES = 7;
const REST_ID = -1;

type Series = { id: number; name: string; icon: string; color: string };

function seriesOf(categories: Category[] | undefined) {
  const byId = new Map(categories?.map((c) => [c.id, c]));
  return (id: number, name?: string): Series => {
    if (id === REST_ID)
      return { id, name: "Còn lại", icon: "📦", color: OTHER_COLOR };
    const c = byId.get(id);
    return {
      id,
      name: c?.name ?? name ?? "Khác",
      icon: categoryIcon(c?.icon),
      color: categoryColor(c ?? (name ? { id, name } : undefined)),
    };
  };
}

/** The largest categories keep their color; the tail is grouped as "Còn lại". */
function topCategories(data: CategoryAmount[]): Set<number> {
  const sorted = [...data].sort((a, b) => b.amount - a.amount);
  const keep = sorted.length > MAX_SERIES + 1 ? MAX_SERIES : sorted.length;
  return new Set(sorted.slice(0, keep).map((c) => c.category_id));
}

const pctOf = (part: number, total: number) =>
  total ? Math.round((part / total) * 100) : 0;

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

/** Spending by category: donut chart with a legend table of the exact figures. */
export function CategoryDonutChart({
  data,
  categories,
}: {
  data: CategoryAmount[];
  categories: Category[] | undefined;
}) {
  const series = seriesOf(categories);
  const total = data.reduce((s, c) => s + c.amount, 0);
  const keep = topCategories(data);
  const rest = data
    .filter((c) => !keep.has(c.category_id))
    .reduce((s, c) => s + c.amount, 0);
  const slices = [
    ...[...data]
      .filter((c) => keep.has(c.category_id))
      .sort((a, b) => b.amount - a.amount)
      .map((c) => ({ ...series(c.category_id, c.name), amount: c.amount })),
    ...(rest ? [{ ...series(REST_ID), amount: rest }] : []),
  ];

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,11rem)_1fr]">
      <div className="relative mx-auto aspect-square w-44 sm:w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="amount"
              nameKey="name"
              innerRadius="62%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              stroke={GAP}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.id} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                const s = payload?.[0]?.payload as
                  (Series & { amount: number }) | undefined;
                if (!active || !s) return null;
                return (
                  <div className="rounded-lg bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-navy/10">
                    <p className="flex items-center gap-1.5 text-xs text-navy/70">
                      <Dot color={s.color} /> {s.name}
                    </p>
                    <p className="font-semibold tabular-nums">
                      {formatVND(s.amount)} · {pctOf(s.amount, total)}%
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="text-[11px] text-navy/60">Tổng chi</span>
          <span className="text-sm font-bold tabular-nums">
            {formatCompactVND(total)}
          </span>
        </div>
      </div>

      <ul className="space-y-1.5 text-sm" aria-label="Chi theo danh mục">
        {slices.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <Dot color={s.color} />
            <span className="min-w-0 flex-1 truncate">
              <span aria-hidden>{s.icon}</span> {s.name}
            </span>
            <span className="font-medium tabular-nums">
              {formatVND(s.amount)}
            </span>
            <span className="w-10 text-right text-navy/60 tabular-nums">
              {pctOf(s.amount, total)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type DayRow = {
  day: string;
  date: string;
  expense: number;
  [seriesKey: `c${number}`]: number;
};

/** Spending by day: one stacked column per day, split by category. */
export function DailyExpenseChart({
  data,
  month,
  lastDay,
  byCategory,
  categories,
}: {
  data: DailyAmount[];
  month: string;
  lastDay: number;
  /** Month total by category: sets the stacking order and which categories get a color. */
  byCategory: CategoryAmount[];
  categories: Category[] | undefined;
}) {
  const series = seriesOf(categories);
  const keep = topCategories(byCategory);
  const order = [...byCategory]
    .sort((a, b) => b.amount - a.amount)
    .map((c) => c.category_id)
    .filter((id) => keep.has(id));
  const hasRest = byCategory.some((c) => !keep.has(c.category_id));
  // The largest segment (top category of the month) sits at the bottom, next to the axis.
  const stack = [...order, ...(hasRest ? [REST_ID] : [])].map((id) =>
    series(id, byCategory.find((c) => c.category_id === id)?.name),
  );

  const byDate = new Map(data.map((d) => [d.date, d]));
  const rows: DayRow[] = Array.from({ length: lastDay }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const d = byDate.get(date);
    const row: DayRow = {
      day: String(i + 1),
      date: formatDate(date),
      expense: d?.expense ?? 0,
    };
    const parts = d?.categories ?? [];
    for (const s of stack) row[`c${s.id}`] = 0;
    for (const p of parts) {
      const key = keep.has(p.category_id) ? p.category_id : REST_ID;
      row[`c${key}`] = (row[`c${key}`] ?? 0) + p.amount;
    }
    // Older data without a category split: put the whole day in "Còn lại".
    if (!parts.length && row.expense) row[`c${REST_ID}`] = row.expense;
    return row;
  });
  if (!hasRest && rows.some((r) => r[`c${REST_ID}`]))
    stack.push(series(REST_ID));

  return (
    <>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            barCategoryGap={2}
          >
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis
              dataKey="day"
              tick={TICK}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              tickFormatter={formatCompactVND}
              tick={TICK}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              content={<DayTooltip stack={stack} />}
              cursor={{ fill: "rgba(14, 47, 81, 0.04)" }}
            />
            {stack.map((s) => (
              <Bar
                key={s.id}
                dataKey={`c${s.id}`}
                name={s.name}
                stackId="day"
                fill={s.color}
                stroke={GAP}
                strokeWidth={1}
                maxBarSize={16}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {stack.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy/70">
          {stack.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <Dot color={s.color} /> {s.name}
            </li>
          ))}
        </ul>
      )}
      <table className="sr-only">
        <caption>Chi tiêu theo ngày</caption>
        <tbody>
          {rows
            .filter((r) => r.expense > 0)
            .map((r) => (
              <tr key={r.day}>
                <th scope="row">{r.date}</th>
                <td>{formatVND(r.expense)}</td>
                <td>
                  {stack
                    .filter((s) => r[`c${s.id}`])
                    .map((s) => `${s.name}: ${formatVND(r[`c${s.id}`])}`)
                    .join(", ")}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </>
  );
}

function DayTooltip({
  active,
  payload,
  stack,
}: Partial<TooltipContentProps<number, string>> & { stack: Series[] }) {
  const row = payload?.[0]?.payload as DayRow | undefined;
  if (!active || !row || !row.expense) return null;
  const parts = stack
    .map((s) => ({ ...s, amount: row[`c${s.id}`] ?? 0 }))
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return (
    <div className="min-w-44 rounded-lg bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-navy/10">
      <p className="flex justify-between gap-3 text-xs text-navy/60">
        <span>{row.date}</span>
        <span className="font-semibold text-navy tabular-nums">
          {formatVND(row.expense)}
        </span>
      </p>
      <ul className="mt-1 space-y-0.5">
        {parts.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5 text-xs">
            <Dot color={s.color} />
            <span className="flex-1">{s.name}</span>
            <span className="tabular-nums">{formatVND(s.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
