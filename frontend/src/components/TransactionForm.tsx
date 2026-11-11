import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { errorMessage } from "../api/client";
import {
  useCategories,
  useCreateTransaction,
  useDeleteTransaction,
  useParseEntry,
  useUpdateTransaction,
} from "../api/hooks";
import type { Transaction, TransactionInput, TxKind } from "../api/types";
import {
  formatAmountInput,
  formatVND,
  MAX_VND,
  parseMoney,
  todayISO,
} from "../lib/format";
import { useRoast } from "../roast/context";
import { MoneyInput, SelectField } from "./fields";
import { Alert, Button, TextField } from "./ui";
import { categoryIcon } from "../lib/categoryIcon";

const transactionSchema = z.object({
  kind: z.enum(["expense", "income"]),
  amount: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập số tiền.")
    .refine(
      (v) => parseMoney(v) !== null,
      "Không hiểu số tiền, thử 45k hoặc 45000.",
    )
    .refine((v) => (parseMoney(v) ?? 0) > 0, "Số tiền phải lớn hơn 0.")
    .refine(
      (v) => (parseMoney(v) ?? 0) <= MAX_VND,
      `Tối đa ${formatVND(MAX_VND)}.`,
    ),
  category_id: z.string().min(1, "Vui lòng chọn danh mục."),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Vui lòng chọn ngày.")
    .refine((d) => d <= todayISO(), "Không chọn ngày trong tương lai."),
  note: z.string().trim().max(200, "Ghi chú tối đa 200 ký tự."),
});
type TransactionFormValues = z.infer<typeof transactionSchema>;

function toTransactionInput(v: TransactionFormValues): TransactionInput {
  return {
    kind: v.kind,
    amount: parseMoney(v.amount)!,
    category_id: Number(v.category_id),
    date: v.date,
    note: v.note.trim() || null,
  };
}

const KINDS: { value: TxKind; label: string }[] = [
  { value: "expense", label: "Khoản chi" },
  { value: "income", label: "Khoản thu" },
];

/** Form to add (no `initial`) or edit a transaction. */
export function TransactionForm({
  initial,
  onDone,
}: {
  initial?: Transaction;
  onDone: () => void;
}) {
  const categories = useCategories();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const parse = useParseEntry();
  const { watchForRoast } = useRoast();
  const [quickText, setQuickText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      kind: initial?.kind ?? "expense",
      amount: initial ? formatAmountInput(initial.amount) : "",
      category_id: initial ? String(initial.category_id) : "",
      date: initial?.date ?? todayISO(),
      note: initial?.note ?? "",
    },
  });

  const kind = useWatch({ control, name: "kind" });
  const amountText = useWatch({ control, name: "amount" });
  const options = categories.data?.filter((c) => c.kind === kind) ?? [];
  const mutation = initial ? update : create;
  const busy = mutation.isPending || remove.isPending;

  const onSubmit = handleSubmit((values) => {
    const body = toTransactionInput(values);
    if (initial) {
      update.mutate({ id: initial.id, ...body }, { onSuccess: onDone });
    } else {
      create.mutate(body, {
        onSuccess: (res) => {
          if (res.roast_pending) watchForRoast();
          onDone();
        },
      });
    }
  });

  const quickFill = () => {
    if (!quickText.trim()) return;
    parse.mutate(quickText.trim(), {
      onSuccess: (entry) => {
        const opts = { shouldValidate: true };
        setValue("kind", entry.kind, opts);
        setValue("amount", formatAmountInput(entry.amount), opts);
        const match =
          categories.data?.find(
            (c) => c.kind === entry.kind && c.name === entry.category,
          ) ??
          categories.data?.find(
            (c) => c.kind === entry.kind && c.name === "Khác",
          );
        setValue("category_id", match ? String(match.id) : "", opts);
        setValue("note", entry.note, opts);
      },
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {!initial && (
        <div className="rounded-xl bg-surface p-3">
          <label
            htmlFor="quick-entry"
            className="mb-1 block text-sm font-medium"
          >
            ⚡ Nhập nhanh bằng AI
          </label>
          <div className="flex gap-2">
            <input
              id="quick-entry"
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  quickFill();
                }
              }}
              placeholder="vd: trà sữa 45k"
              maxLength={200}
              className="min-w-0 flex-1 rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green"
            />
            <Button
              variant="secondary"
              onClick={quickFill}
              disabled={parse.isPending || !quickText.trim()}
            >
              {parse.isPending ? "Đang đọc…" : "Điền"}
            </Button>
          </div>
          <p className="mt-1 text-xs text-navy/60">
            {parse.isError
              ? errorMessage(parse.error)
              : parse.isSuccess
                ? `Đã điền ${formatVND(parse.data.amount)}. Kiểm tra lại rồi bấm Lưu.`
                : "AI chỉ điền sẵn form, bạn vẫn cần bấm Lưu."}
          </p>
        </div>
      )}

      <fieldset>
        <legend className="sr-only">Loại giao dịch</legend>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-navy-50 p-1">
          {KINDS.map((k) => (
            <label
              key={k.value}
              className="cursor-pointer rounded-md py-2 text-center text-sm font-semibold text-navy/70 has-checked:bg-white has-checked:text-navy has-checked:shadow-sm"
            >
              <input
                type="radio"
                value={k.value}
                className="sr-only"
                {...register("kind", {
                  onChange: () => setValue("category_id", ""),
                })}
              />
              {k.label}
            </label>
          ))}
        </div>
      </fieldset>

      <MoneyInput
        label="Số tiền"
        {...register("amount")}
        value={amountText}
        error={errors.amount?.message}
      />

      <SelectField
        label="Danh mục"
        {...register("category_id")}
        error={errors.category_id?.message}
      >
        <option value="">— Chọn danh mục —</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {categoryIcon(c.icon)} {c.name}
          </option>
        ))}
      </SelectField>

      <TextField
        label="Ngày"
        type="date"
        max={todayISO()}
        {...register("date")}
        error={errors.date?.message}
      />

      <TextField
        label="Ghi chú (không bắt buộc)"
        placeholder="vd: trà sữa với bạn"
        maxLength={200}
        {...register("note")}
        error={errors.note?.message}
      />

      {(mutation.isError || remove.isError) && (
        <Alert>{errorMessage(mutation.error ?? remove.error)}</Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="flex-1" disabled={busy}>
          {mutation.isPending ? "Đang lưu…" : "Lưu"}
        </Button>
        {initial &&
          (confirmDelete ? (
            <Button
              className="bg-danger! text-white!"
              disabled={busy}
              onClick={() => remove.mutate(initial.id, { onSuccess: onDone })}
            >
              Bấm lần nữa để xoá
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="text-danger"
              onClick={() => setConfirmDelete(true)}
            >
              Xoá
            </Button>
          ))}
      </div>
    </form>
  );
}
