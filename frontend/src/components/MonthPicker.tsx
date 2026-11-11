import { currentMonth, formatMonth, shiftMonth } from "../lib/format";

/** Month picker with ‹ › buttons. Cannot go past the current month. */
export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (month: string) => void;
}) {
  const isCurrent = value >= currentMonth();
  const btn =
    "grid size-9 place-items-center rounded-lg text-lg text-navy hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-navy/5">
      <button
        type="button"
        className={btn}
        onClick={() => onChange(shiftMonth(value, -1))}
        aria-label="Tháng trước"
      >
        ‹
      </button>
      <span
        className="min-w-32 text-center text-sm font-semibold"
        aria-live="polite"
      >
        {formatMonth(value)}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(shiftMonth(value, 1))}
        disabled={isCurrent}
        aria-label="Tháng sau"
      >
        ›
      </button>
    </div>
  );
}
