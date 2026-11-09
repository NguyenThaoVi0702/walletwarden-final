import { useState } from "react";
import { errorMessage } from "../api/client";
import { useMonthlyReport } from "../api/hooks";
import { BudgetProgress } from "../components/BudgetProgress";
import { MonthPicker } from "../components/MonthPicker";
import { Spinner } from "../components/Spinner";
import { Alert, Button, Card, PageHeader } from "../components/ui";
import { currentMonth, formatDate, formatVND } from "../lib/format";
import { AI_DISCLAIMER } from "./Advisor";

export default function ReportPage() {
  const [month, setMonth] = useState(currentMonth);
  const report = useMonthlyReport(month);
  const data = report.data;

  return (
    <>
      <PageHeader
        title="Báo cáo tháng"
        actions={<MonthPicker value={month} onChange={setMonth} />}
      />

      {report.isPending && (
        <Spinner label="AI đang viết báo cáo… (có thể mất vài giây)" />
      )}
      {report.error && (
        <div className="space-y-2">
          <Alert>{errorMessage(report.error)}</Alert>
          <Button variant="ghost" onClick={() => report.refetch()}>
            Thử lại
          </Button>
        </div>
      )}

      {data && (
        <div className="space-y-4 md:space-y-6">
          <Card className="bg-navy! text-white">
            <p className="text-xs font-semibold tracking-wide text-green uppercase">
              Tổng kết
            </p>
            <h2 className="mt-1 text-xl font-bold md:text-2xl">
              {data.headline}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/85">
              {data.commentary}
            </p>
            {data.fallback && (
              <span className="mt-3 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80">
                chế độ dự phòng
              </span>
            )}
          </Card>

          <Card className="border-l-4 border-green">
            <p className="text-sm font-semibold text-green-700">
              💡 Gợi ý tiết kiệm
            </p>
            <p className="mt-1 text-sm leading-relaxed">{data.saving_tip}</p>
          </Card>

          <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-4 font-semibold">Danh mục chi nhiều nhất</h2>
              <ul className="space-y-4">
                {data.top_categories.map((c) => (
                  <li key={c.name}>
                    {c.budget ? (
                      <BudgetProgress
                        label={c.name}
                        spent={c.spent}
                        limit={c.budget}
                      />
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{c.name}</span>
                        <span className="tabular-nums">
                          {formatVND(c.spent)}
                        </span>
                      </div>
                    )}
                  </li>
                ))}
                {data.top_categories.length === 0 && (
                  <li className="text-sm text-navy/60">Chưa có khoản chi.</li>
                )}
              </ul>
            </Card>

            <Card>
              <h2 className="mb-2 font-semibold">Khoản chi lớn nhất</h2>
              <ol className="divide-y divide-navy/5">
                {data.biggest_expenses.map((e, i) => (
                  <li
                    key={`${e.day}-${i}`}
                    className="flex items-center gap-3 py-2.5 text-sm"
                  >
                    <span className="grid size-6 place-items-center rounded-full bg-navy-50 text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium">{e.category}</span>
                      <span className="block text-xs text-navy/60">
                        {formatDate(e.day)}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatVND(e.amount)}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>

          <p className="rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy/80">
            {AI_DISCLAIMER}
          </p>
        </div>
      )}
    </>
  );
}
