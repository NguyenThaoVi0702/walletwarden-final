import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { formatVND, parseMoney } from "../lib/format";

const FIELD =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green disabled:bg-surface";

function FieldShell({
  id,
  label,
  error,
  hint,
  className = "",
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-navy/60">{hint}</p>
      )}
    </div>
  );
}

export const SelectField = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }
>(function SelectField({ label, error, className, children, ...props }, ref) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} className={className}>
      <select
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
        className={`${FIELD} ${error ? "border-danger" : "border-navy/20"}`}
      >
        {children}
      </select>
    </FieldShell>
  );
});

/**
 * Ô nhập tiền dạng chữ: gõ "45k", "1tr2", "1.500.000"… và thấy ngay số tiền hiểu được.
 * Giá trị form vẫn là chuỗi; schema Zod dùng `parseMoney` để chuyển thành số nguyên VND.
 */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "value"> & {
    label: string;
    error?: string;
    value?: string;
  }
>(function MoneyInput({ label, error, className, value, ...props }, ref) {
  const id = useId();
  const parsed = value ? parseMoney(value) : null;
  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      className={className}
      hint={
        parsed !== null
          ? `= ${formatVND(parsed)}`
          : "Gõ 45k, 1tr2 hoặc 1.500.000"
      }
    >
      <input
        ref={ref}
        id={id}
        inputMode="text"
        autoComplete="off"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
        className={`${FIELD} tabular-nums ${error ? "border-danger" : "border-navy/20"}`}
      />
    </FieldShell>
  );
});
