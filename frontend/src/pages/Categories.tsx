import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { errorMessage } from "../api/client";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "../api/hooks";
import type { Category, TxKind } from "../api/types";
import { ColorPicker } from "../components/ColorPicker";
import { SelectField } from "../components/fields";
import { Spinner } from "../components/Spinner";
import { Alert, Button, Card, PageHeader, TextField } from "../components/ui";
import { categoryColor, suggestColor } from "../lib/categoryColor";
import { categoryIcon } from "../lib/categoryIcon";

const schema = z.object({
  icon: z.string().trim().min(1, "Chọn 1 emoji.").max(8, "Chỉ 1 emoji."),
  name: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên.")
    .max(40, "Tối đa 40 ký tự."),
  kind: z.enum(["expense", "income"]),
});
type FormValues = z.infer<typeof schema>;

const KIND_LABEL: Record<TxKind, string> = { expense: "Chi", income: "Thu" };

function AddCategoryForm({ existing }: { existing: Category[] }) {
  const create = useCreateCategory();
  const [color, setColor] = useState<string | null>(null);
  const shown = color ?? suggestColor(existing);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { icon: "📦", name: "", kind: "expense" },
  });

  return (
    <Card>
      <h2 className="mb-3 font-semibold">Thêm danh mục</h2>
      <form
        noValidate
        onSubmit={handleSubmit((v) =>
          create.mutate(
            { ...v, color: shown },
            {
              onSuccess: () => {
                reset({ icon: "📦", name: "", kind: v.kind });
                setColor(null);
              },
            },
          ),
        )}
        className="grid gap-3 sm:grid-cols-[5rem_1fr_9rem_auto] sm:items-start"
      >
        <TextField
          label="Icon"
          maxLength={8}
          {...register("icon")}
          error={errors.icon?.message}
        />
        <TextField
          label="Tên danh mục"
          placeholder="vd: Cà phê"
          {...register("name")}
          error={errors.name?.message}
        />
        <SelectField label="Loại" {...register("kind")}>
          <option value="expense">Chi</option>
          <option value="income">Thu</option>
        </SelectField>
        <Button type="submit" className="sm:mt-6" disabled={create.isPending}>
          Thêm
        </Button>
        <div className="sm:col-span-4">
          <p className="mb-1 text-sm font-medium">Màu trên biểu đồ</p>
          <ColorPicker value={shown} onChange={setColor} />
        </div>
      </form>
      {create.isError && (
        <div className="mt-3">
          <Alert>{errorMessage(create.error)}</Alert>
        </div>
      )}
    </Card>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [icon, setIcon] = useState(categoryIcon(category.icon));
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(categoryColor(category));
  const error = update.error ?? remove.error;

  const save = () => {
    if (!name.trim() || !icon.trim()) return;
    update.mutate(
      { id: category.id, name: name.trim(), icon: icon.trim(), color },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <li className="py-2">
      {editing ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              aria-label="Icon"
              value={icon}
              maxLength={8}
              onChange={(e) => setIcon(e.target.value)}
              className="w-12 rounded-lg border border-navy/20 px-2 py-1.5 text-center"
            />
            <input
              aria-label="Tên danh mục"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              className="min-w-0 flex-1 rounded-lg border border-navy/20 px-2 py-1.5 text-sm"
            />
            <Button
              className="px-3! py-1.5!"
              onClick={save}
              disabled={update.isPending}
            >
              Lưu
            </Button>
            <Button
              variant="ghost"
              className="px-2! py-1.5!"
              onClick={() => setEditing(false)}
            >
              Huỷ
            </Button>
          </div>
          <ColorPicker
            label={`Màu của ${category.name}`}
            value={color}
            onChange={setColor}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-9 place-items-center rounded-full text-lg ring-2"
            style={{
              backgroundColor: `${categoryColor(category)}1f`,
              ["--tw-ring-color" as string]: categoryColor(category),
            }}
          >
            {categoryIcon(category.icon)}
          </span>
          <span className="flex-1 text-sm font-medium">
            {category.name}
            {category.is_default && (
              <span className="ml-2 rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-normal text-navy/60">
                mặc định
              </span>
            )}
          </span>
          <Button
            variant="ghost"
            className="px-2! py-1!"
            onClick={() => setEditing(true)}
            aria-label={`Sửa ${category.name}`}
          >
            Sửa
          </Button>
          {confirm ? (
            <Button
              className="bg-danger! px-2! py-1! text-white!"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(category.id, {
                  onSettled: () => setConfirm(false),
                })
              }
            >
              Xác nhận xoá
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="px-2! py-1! text-danger"
              onClick={() => setConfirm(true)}
              aria-label={`Xoá ${category.name}`}
            >
              Xoá
            </Button>
          )}
        </div>
      )}
      {error && (
        <p className="mt-1 text-xs text-danger">{errorMessage(error)}</p>
      )}
    </li>
  );
}

export default function CategoriesPage() {
  const { data, isPending, error } = useCategories();

  return (
    <>
      <PageHeader
        title="Danh mục"
        subtitle="Danh mục dùng khi ghi thu chi và đặt ngân sách"
      />
      <div className="space-y-4 md:space-y-6">
        <AddCategoryForm existing={data ?? []} />
        {isPending && <Spinner />}
        {error && <Alert>{errorMessage(error)}</Alert>}
        {data && (
          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            {(["expense", "income"] as const).map((kind) => (
              <Card key={kind}>
                <h2 className="mb-1 font-semibold">{KIND_LABEL[kind]}</h2>
                <ul className="divide-y divide-navy/5">
                  {data
                    .filter((c) => c.kind === kind)
                    .map((c) => (
                      <CategoryRow key={c.id} category={c} />
                    ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
