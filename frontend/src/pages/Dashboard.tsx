import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import {
  useBudgets,
  useCategories,
  useDashboard,
  useTransactions,
} from "../api/hooks";
import { useAuth } from "../auth/useAuth";
import { BudgetProgress } from "../components/BudgetProgress";
import { CategoryDonutChart, DailyExpenseChart } from "../components/charts";
import { MonthPicker } from "../components/MonthPicker";
import { Spinner } from "../components/Spinner";
import { Alert, Button, Card, PageHeader } from "../components/ui";
import { currentMonth, formatDate, formatVND } from "../lib/format";
import { categoryColor } from "../lib/categoryColor";
import { categoryIcon } from "../lib/categoryIcon";

function Stat({
  label,
  value,
  tone,
  className = "",
}: {
  label: string;
  value: number;
  tone: string;
  className?: string;
}) {
  return (
    <Card className={`p-3! md:p-6! ${className}`}>
      <p className="text-xs text-navy/60 md:text-sm">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums md:text-2xl ${tone}`}>
        {formatVND(value)}
      </p>
    </Card>
  );
}

/** Số ngày cần vẽ: tháng hiện tại → tới hôm nay; tháng cũ → cả tháng. */
function daysToShow(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return month === currentMonth()
    ? new Date().getDate()
    : new Date(y, m, 0).getDate();
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth);
  const dash = useDashboard(month);
  const budgets = useBudgets(month);
  const txs = useTransactions(month);
  const cats = useCategories();
  const catById = new Map(cats.data?.map((c) => [c.id, c]));

  // Ngân sách sắp/đã vượt lên đầu.
  const watchList = [...(budgets.data?.categories ?? [])]
    .sort((a, b) => b.usage_pct - a.usage_pct)
    .slice(0, 3);

  return (
    <>
      <PageHeader
        title={`Chào ${user?.display_name ?? "bạn"} 👋`}
        subtitle="Tình hình thu chi của bạn"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MonthPicker value={month} onChange={setMonth} />
            <Button onClick={() => navigate("/transactions?new=1")}>
              + Thêm giao dịch
            </Button>
          </div>
        }
      />

      {dash.isPending && <Spinner />}
      {dash.error && <Alert>{errorMessage(dash.error)}</Alert>}

      {dash.data && (
        <div className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-6">
            <Stat label="Thu" value={dash.data.income} tone="text-green-700" />
            <Stat label="Chi" value={dash.data.expense} tone="text-navy" />
            <Stat
              label="Còn lại"
              className="col-span-2 sm:col-span-1"
              value={dash.data.balance}
              tone={dash.data.balance >= 0 ? "text-navy" : "text-danger"}
            />
          </div>

          <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-semibold">Chi theo danh mục</h2>
              {dash.data.by_category.length ? (
                <CategoryDonutChart
                  data={dash.data.by_category}
                  categories={cats.data}
                />
              ) : (
                <p className="text-sm text-navy/60">
                  Chưa có khoản chi nào trong tháng.
                </p>
              )}
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Ngân sách</h2>
                <Link
                  to="/budgets"
                  className="text-sm font-semibold text-green-700 hover:underline"
                >
                  Quản lý
                </Link>
              </div>
              {budgets.data && (budgets.data.total || watchList.length) ? (
                <div className="space-y-4">
                  {budgets.data.total ? (
                    <BudgetProgress
                      label="Tổng chi tiêu"
                      spent={budgets.data.total.spent}
                      limit={budgets.data.total.limit}
                      pct={budgets.data.total.usage_pct}
                    />
                  ) : null}
                  {watchList.map((b) => (
                    <BudgetProgress
                      key={b.category_id}
                      label={b.name ?? "Danh mục"}
                      icon={
                        b.category_id
                          ? catById.get(b.category_id)?.icon
                          : undefined
                      }
                      color={
                        b.category_id
                          ? categoryColor(catById.get(b.category_id))
                          : undefined
                      }
                      spent={b.spent}
                      limit={b.limit}
                      pct={b.usage_pct}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-navy/60">
                  Chưa đặt ngân sách.{" "}
                  <Link
                    to="/budgets"
                    className="font-semibold text-green-700 hover:underline"
                  >
                    Đặt ngay
                  </Link>
                </p>
              )}
            </Card>
          </div>

          <Card>
            <h2 className="mb-3 font-semibold">Chi theo ngày</h2>
            <DailyExpenseChart
              data={dash.data.daily}
              month={month}
              lastDay={daysToShow(month)}
              byCategory={dash.data.by_category}
              categories={cats.data}
            />
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Giao dịch gần đây</h2>
              <Link
                to="/transactions"
                className="text-sm font-semibold text-green-700 hover:underline"
              >
                Xem tất cả
              </Link>
            </div>
            <ul className="divide-y divide-navy/5">
              {txs.data?.slice(0, 5).map((t) => {
                const cat = catById.get(t.category_id);
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <span aria-hidden className="text-lg">
                      {categoryIcon(cat?.icon)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {t.note || cat?.name}
                      </span>
                      <span className="block text-xs text-navy/60">
                        {formatDate(t.date)}
                      </span>
                    </span>
                    <span
                      className={`text-sm font-semibold tabular-nums ${t.kind === "income" ? "text-green-700" : ""}`}
                    >
                      {t.kind === "income" ? "+" : "−"}
                      {formatVND(t.amount)}
                    </span>
                  </li>
                );
              })}
              {txs.data?.length === 0 && (
                <li className="py-2 text-sm text-navy/60">
                  Chưa có giao dịch.
                </li>
              )}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
