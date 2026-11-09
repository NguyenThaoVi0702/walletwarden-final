import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { downloadFile, errorMessage } from "../api/client";
import { useCategories, useTransactions } from "../api/hooks";
import type { Transaction, TxKind } from "../api/types";
import { Modal } from "../components/Modal";
import { MonthPicker } from "../components/MonthPicker";
import { Spinner } from "../components/Spinner";
import { TransactionForm } from "../components/TransactionForm";
import { Alert, Button, Card, PageHeader } from "../components/ui";
import { currentMonth, formatDayHeading, formatVND } from "../lib/format";
import { categoryIcon } from "../lib/categoryIcon";

type KindFilter = "all" | TxKind;

const KIND_TABS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "expense", label: "Chi" },
  { value: "income", label: "Thu" },
];

export default function TransactionsPage() {
  const [params, setParams] = useSearchParams();
  const [month, setMonth] = useState(currentMonth);
  const [kind, setKind] = useState<KindFilter>("all");
  const [categoryId, setCategoryId] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // /transactions?new=1 (từ nút "Thêm giao dịch" ở Dashboard) → mở form thêm ngay.
  const creating = params.get("new") === "1";
  const openCreate = () => setParams({ new: "1" }, { replace: true });
  const closeForm = () => {
    setEditing(null);
    if (creating) setParams({}, { replace: true });
  };

  const txs = useTransactions(month);
  const cats = useCategories();
  const catById = new Map(cats.data?.map((c) => [c.id, c]));

  const filtered = (txs.data ?? []).filter(
    (t) =>
      (kind === "all" || t.kind === kind) &&
      (!categoryId || t.category_id === Number(categoryId)),
  );
  const income = filtered
    .filter((t) => t.kind === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = filtered
    .filter((t) => t.kind === "expense")
    .reduce((s, t) => s + t.amount, 0);

  const byDate = new Map<string, Transaction[]>();
  for (const t of filtered)
    byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]);

  const exportCsv = async () => {
    setExportError(null);
    try {
      await downloadFile(
        "/api/transactions/export",
        `walletwarden-${month}.csv`,
        { month },
      );
    } catch (err) {
      setExportError(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Giao dịch"
        actions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={exportCsv}
              disabled={!txs.data?.length}
            >
              Xuất CSV
            </Button>
            <Button onClick={openCreate}>+ Thêm giao dịch</Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <MonthPicker value={month} onChange={setMonth} />
        <div
          role="group"
          aria-label="Lọc theo loại"
          className="inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-navy/5"
        >
          {KIND_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={kind === tab.value}
              onClick={() => {
                setKind(tab.value);
                setCategoryId("");
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                kind === tab.value
                  ? "bg-navy text-white"
                  : "text-navy/70 hover:bg-navy-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Lọc theo danh mục"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-xl border-0 bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-navy/5 outline-none focus:ring-2 focus:ring-green"
        >
          <option value="">Mọi danh mục</option>
          {cats.data
            ?.filter((c) => kind === "all" || c.kind === kind)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {categoryIcon(c.icon)} {c.name}
              </option>
            ))}
        </select>
      </div>

      {exportError && (
        <div className="mb-4">
          <Alert>{exportError}</Alert>
        </div>
      )}

      {txs.isPending && <Spinner />}
      {txs.error && <Alert>{errorMessage(txs.error)}</Alert>}

      {txs.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Card className="p-3! md:p-4!">
              <p className="text-navy/60">Tổng thu</p>
              <p className="font-bold text-green-700 tabular-nums">
                +{formatVND(income)}
              </p>
            </Card>
            <Card className="p-3! md:p-4!">
              <p className="text-navy/60">Tổng chi</p>
              <p className="font-bold tabular-nums">−{formatVND(expense)}</p>
            </Card>
          </div>

          {filtered.length === 0 ? (
            <Card className="text-center text-sm text-navy/60">
              Chưa có giao dịch nào.{" "}
              <button
                type="button"
                onClick={openCreate}
                className="font-semibold text-green-700 hover:underline"
              >
                Thêm giao dịch đầu tiên
              </button>
            </Card>
          ) : (
            [...byDate].map(([date, items]) => (
              <section key={date}>
                <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-navy/60">
                  {formatDayHeading(date)}
                </h2>
                <Card className="p-0! md:p-0!">
                  <ul className="divide-y divide-navy/5">
                    {items.map((t) => {
                      const cat = catById.get(t.category_id);
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => setEditing(t)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface"
                            aria-label={`Sửa ${t.note || cat?.name || "giao dịch"} ${formatVND(t.amount)}`}
                          >
                            <span
                              aria-hidden
                              className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-lg"
                            >
                              {categoryIcon(cat?.icon)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {t.note || cat?.name}
                              </span>
                              <span className="block text-xs text-navy/60">
                                {cat?.name}
                              </span>
                            </span>
                            <span
                              className={`text-sm font-semibold tabular-nums ${
                                t.kind === "income"
                                  ? "text-green-700"
                                  : "text-navy"
                              }`}
                            >
                              {t.kind === "income" ? "+" : "−"}
                              {formatVND(t.amount)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </section>
            ))
          )}
        </div>
      )}

      {(creating || editing) && (
        <Modal
          title={editing ? "Sửa giao dịch" : "Thêm giao dịch"}
          onClose={closeForm}
        >
          <TransactionForm initial={editing ?? undefined} onDone={closeForm} />
        </Modal>
      )}
    </>
  );
}
