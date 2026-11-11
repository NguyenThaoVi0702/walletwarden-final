import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { errorMessage } from "../api/client";
import { useBudgets, useCategories, useSaveBudgets } from "../api/hooks";
import type { BudgetStatus, Category } from "../api/types";
import { BudgetProgress } from "../components/BudgetProgress";
import { categoryColor } from "../lib/categoryColor";
import { MoneyInput } from "../components/fields";
import { MonthPicker } from "../components/MonthPicker";
import { Spinner } from "../components/Spinner";
import { Alert, Button, Card, PageHeader } from "../components/ui";
import {
  currentMonth,
  formatAmountInput,
  formatVND,
  MAX_VND,
  parseMoney,
} from "../lib/format";
import { categoryIcon } from "../lib/categoryIcon";

/** Empty = no limit set. */
const optionalMoney = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || (parseMoney(v) ?? 0) > 0,
    "Số tiền không hợp lệ (vd: 1tr5).",
  )
  .refine(
    (v) => v === "" || (parseMoney(v) ?? 0) <= MAX_VND,
    `Tối đa ${formatVND(MAX_VND)}.`,
  );

const schema = z.object({
  total: optionalMoney,
  limits: z.record(z.string(), optionalMoney),
});
type FormValues = z.infer<typeof schema>;

const key = (id: number) => `c${id}`;
const toText = (n: number | null | undefined) =>
  n ? formatAmountInput(n) : "";

function BudgetOverview({
  status,
  categories,
}: {
  status: BudgetStatus;
  categories: Category[];
}) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  if (!status.total && status.categories.length === 0) {
    return (
      <Card className="text-center text-sm text-navy/60">
        Chưa đặt ngân sách cho tháng này. Nhập hạn mức ở bên dưới để bắt đầu
        theo dõi.
      </Card>
    );
  }
  return (
    <Card>
      <h2 className="mb-4 font-semibold">Tiến độ</h2>
      <div className="space-y-4">
        {status.total ? (
          <BudgetProgress
            label="Tổng chi tiêu"
            spent={status.total.spent}
            limit={status.total.limit}
            pct={status.total.usage_pct}
          />
        ) : null}
        {status.categories.map((c) => (
          <BudgetProgress
            key={c.category_id}
            label={c.name ?? "Danh mục"}
            icon={c.category_id ? byId.get(c.category_id)?.icon : undefined}
            color={
              c.category_id ? categoryColor(byId.get(c.category_id)) : undefined
            }
            spent={c.spent}
            limit={c.limit}
            pct={c.usage_pct}
          />
        ))}
      </div>
    </Card>
  );
}

function BudgetForm({
  month,
  status,
  categories,
}: {
  month: string;
  status: BudgetStatus;
  categories: Category[];
}) {
  const save = useSaveBudgets();
  const expenseCats = categories.filter((c) => c.kind === "expense");
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      total: toText(status.total?.limit),
      limits: Object.fromEntries(
        expenseCats.map((c) => [
          key(c.id),
          toText(status.categories.find((x) => x.category_id === c.id)?.limit),
        ]),
      ),
    },
  });

  const values = useWatch({ control });
  const total = parseMoney(values.total ?? "") ?? 0;
  const sumLimits = expenseCats.reduce(
    (s, c) => s + (parseMoney(values.limits?.[key(c.id)] ?? "") ?? 0),
    0,
  );

  const onSubmit = handleSubmit((v) =>
    save.mutate(
      {
        month,
        total: v.total ? parseMoney(v.total) : null,
        categories: expenseCats
          .filter((c) => v.limits[key(c.id)])
          .map((c) => ({
            category_id: c.id,
            limit: parseMoney(v.limits[key(c.id)])!,
          })),
      },
      { onSuccess: () => reset(v) },
    ),
  );

  return (
    <Card>
      <h2 className="mb-1 font-semibold">Đặt hạn mức</h2>
      <p className="mb-4 text-sm text-navy/60">
        Để trống danh mục nào thì danh mục đó không giới hạn.
      </p>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <MoneyInput
          label="Ngân sách tổng cả tháng"
          {...register("total")}
          value={values.total}
          error={errors.total?.message}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {expenseCats.map((c) => (
            <MoneyInput
              key={c.id}
              label={`${categoryIcon(c.icon)} ${c.name}`}
              {...register(`limits.${key(c.id)}`)}
              value={values.limits?.[key(c.id)]}
              error={errors.limits?.[key(c.id)]?.message}
            />
          ))}
        </div>

        {total > 0 && sumLimits > total && (
          <Alert tone="info">
            Tổng hạn mức các danh mục ({formatVND(sumLimits)}) đang lớn hơn ngân
            sách tổng ({formatVND(total)}).
          </Alert>
        )}
        {save.isError && <Alert>{errorMessage(save.error)}</Alert>}
        {save.isSuccess && !isDirty && (
          <p className="text-sm text-green-700">✓ Đã lưu ngân sách.</p>
        )}

        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Đang lưu…" : "Lưu ngân sách"}
        </Button>
      </form>
    </Card>
  );
}

export default function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth);
  const budgets = useBudgets(month);
  const categories = useCategories();
  const error = budgets.error ?? categories.error;

  return (
    <>
      <PageHeader
        title="Ngân sách"
        actions={<MonthPicker value={month} onChange={setMonth} />}
      />
      {(budgets.isPending || categories.isPending) && !error && <Spinner />}
      {error && <Alert>{errorMessage(error)}</Alert>}
      {budgets.data && categories.data && (
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2 lg:items-start">
          <BudgetOverview status={budgets.data} categories={categories.data} />
          {/* key theo tháng: đổi tháng thì nạp lại giá trị form */}
          <BudgetForm
            key={month}
            month={month}
            status={budgets.data}
            categories={categories.data}
          />
        </div>
      )}
    </>
  );
}
